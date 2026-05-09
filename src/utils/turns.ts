import type {
  ContentBlock,
  Message,
  ToolTrace,
  TurnTrace,
  TurnTraceStatus,
} from '@/types';
import { getMessageToolTraces } from './traceUtils';

export type ProviderTranscriptMessage = {
  role: Message['role'];
  content: string;
  contentBlocks?: ContentBlock[];
};

const toolTraceSort = (left: ToolTrace, right: ToolTrace) =>
  left.logicalIndex - right.logicalIndex ||
  (left.batchId ?? 0) - (right.batchId ?? 0) ||
  (left.batchIndex ?? 0) - (right.batchIndex ?? 0) ||
  left.toolCallId.localeCompare(right.toolCallId);

const assistantPreludeBlocksFromTurn = (turn: TurnTrace): ContentBlock[] => {
  const blocks: ContentBlock[] = [];

  if (turn.thinking.content) {
    blocks.push({
      type: 'thinking',
      thinking: turn.thinking.content,
    });
  }

  for (const toolTrace of [...turn.tools].sort(toolTraceSort)) {
    blocks.push({
      type: 'tool_use',
      id: toolTrace.toolCallId,
      name: toolTrace.name,
      input: toolTrace.input,
    });
  }

  return blocks;
};

const assistantResponseBlocksFromTurn = (turn: TurnTrace): ContentBlock[] => {
  const blocks: ContentBlock[] = [];

  if (turn.tools.length === 0 && turn.thinking.content) {
    blocks.push({
      type: 'thinking',
      thinking: turn.thinking.content,
    });
  }

  if (turn.response.content) {
    blocks.push({
      type: 'text',
      text: turn.response.content,
    });
  }

  return blocks;
};

const toolResultBlocksFromTurn = (turn: TurnTrace): ContentBlock[] =>
  [...turn.tools]
    .sort(toolTraceSort)
    .filter((toolTrace) => toolTrace.status === 'completed' || toolTrace.status === 'failed')
    .map((toolTrace) => ({
      type: 'tool_result' as const,
      toolUseId: toolTrace.toolCallId,
      content:
        toolTrace.status === 'failed'
          ? toolTrace.error ?? toolTrace.output ?? ''
          : toolTrace.output ?? '',
      isError: toolTrace.status === 'failed',
    }));

const extractThinkingContent = (message: Message) => {
  const thinkingBlocks = (message.contentBlocks ?? [])
    .filter((block): block is Extract<ContentBlock, { type: 'thinking' }> => block.type === 'thinking')
    .map((block) => block.thinking)
    .filter(Boolean);

  if (thinkingBlocks.length > 0) {
    return thinkingBlocks.join('\n\n');
  }

  return message.thinkingContent ?? '';
};

const extractResponseContent = (message: Message) => {
  const textBlocks = (message.contentBlocks ?? [])
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .filter(Boolean);

  if (textBlocks.length > 0) {
    return textBlocks.join('\n\n');
  }

  return message.content;
};

const extractToolTraces = (message: Message): ToolTrace[] => {
  const existingToolTraces = getMessageToolTraces(message);
  if (existingToolTraces.length > 0) {
    return existingToolTraces;
  }

  const resultByToolUseId = new Map(
    (message.contentBlocks ?? [])
      .filter((block): block is Extract<ContentBlock, { type: 'tool_result' }> => block.type === 'tool_result')
      .map((block) => [block.toolUseId, block]),
  );

  return (message.contentBlocks ?? [])
    .filter((block): block is Extract<ContentBlock, { type: 'tool_use' }> => block.type === 'tool_use')
    .map((block, index) => {
      const result = resultByToolUseId.get(block.id);
      const failed = result?.isError === true;

      return {
        toolCallId: block.id,
        name: block.name,
        input: block.input,
        logicalIndex: index + 1,
        status: result ? (failed ? 'failed' : 'completed') : 'requested',
        output: result && !failed ? result.content : undefined,
        error: failed ? result?.content : undefined,
      } satisfies ToolTrace;
    });
};

const turnStatusFromMessageStatus = (status: Message['status']): TurnTraceStatus => {
  switch (status) {
    case 'error':
      return 'error';
    case 'streaming':
    case 'pending':
      return 'running';
    default:
      return 'complete';
  }
};

const buildLegacyFallbackTurn = (
  conversationId: string,
  message: Message,
  turnNumber: number,
): TurnTrace => {
  const thinkingContent = extractThinkingContent(message);
  const responseContent = extractResponseContent(message);
  const thinkingStatus =
    message.status === 'streaming' && !message.content ? 'streaming' : thinkingContent ? 'complete' : 'idle';
  const status = turnStatusFromMessageStatus(message.status);
  const completedAt = status === 'running' ? undefined : message.timestamp;
  const thinkingStartTime = thinkingContent ? message.thinkingStartedAt ?? message.timestamp : undefined;
  const responseStartTime = responseContent ? message.timestamp : undefined;

  return {
    turnNumber,
    sessionId: `legacy-session:${conversationId}:${message.id}`,
    conversationId,
    assistantMessageId: message.id,
    startTime: thinkingStartTime ?? responseStartTime ?? message.timestamp,
    endTime: completedAt,
    status,
    thinking: {
      content: thinkingContent,
      startTime: thinkingStartTime,
      endTime: thinkingStatus === 'streaming' ? undefined : thinkingStartTime ? completedAt : undefined,
      status: thinkingStatus,
    },
    response: {
      content: responseContent,
      startTime: responseStartTime,
      endTime: responseStartTime ? completedAt : undefined,
    },
    tools: extractToolTraces(message),
    usage: message.usage,
  };
};

const normalizeTurn = (turn: TurnTrace, assistantMessageId: string): TurnTrace => ({
  ...turn,
  assistantMessageId,
  thinking: {
    content: turn.thinking?.content ?? '',
    startTime: turn.thinking?.startTime,
    endTime: turn.thinking?.endTime,
    status: turn.thinking?.status ?? 'idle',
  },
  response: {
    content: turn.response?.content ?? '',
    startTime: turn.response?.startTime,
    endTime: turn.response?.endTime,
  },
  tools: [...(turn.tools ?? [])].sort(toolTraceSort),
});

const buildAssistantOrderMap = (messages: Message[]) =>
  new Map(
    messages
      .filter((message) => message.role === 'assistant')
      .map((message, index) => [message.id, index]),
  );

export const getTurnsForAssistantMessage = (
  turns: TurnTrace[] | undefined,
  assistantMessageId: string,
): TurnTrace[] =>
  (turns ?? [])
    .filter((turn) => turn.assistantMessageId === assistantMessageId)
    .sort(
      (left, right) =>
        left.startTime - right.startTime ||
        left.turnNumber - right.turnNumber ||
        left.sessionId.localeCompare(right.sessionId),
    );

export const normalizeConversationTurns = (
  conversationId: string,
  messages: Message[],
  turns: TurnTrace[] | undefined,
  turnsCleared = false,
): TurnTrace[] => {
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const assistantIds = assistantMessages.map((message) => message.id);
  const assistantOrder = buildAssistantOrderMap(messages);
  const rawTurns = turns ?? [];

  if (rawTurns.length === 0 && turnsCleared) {
    return [];
  }

  const groupAssignments = new Map<string, string | undefined>();
  let assistantCursor = 0;

  rawTurns.forEach((turn, index) => {
    const groupKey = turn.assistantMessageId || turn.sessionId || `legacy-turn:${index}`;
    if (groupAssignments.has(groupKey)) {
      return;
    }

    if (turn.assistantMessageId) {
      groupAssignments.set(groupKey, turn.assistantMessageId);
      const existingIndex = assistantIds.indexOf(turn.assistantMessageId);
      if (existingIndex >= assistantCursor) {
        assistantCursor = existingIndex + 1;
      }
      return;
    }

    const fallbackAssistantId =
      assistantIds[Math.min(assistantCursor, Math.max(assistantIds.length - 1, 0))];
    groupAssignments.set(groupKey, fallbackAssistantId);
    if (assistantIds.length > 1 && assistantCursor < assistantIds.length - 1) {
      assistantCursor += 1;
    }
  });

  const normalizedTurns = rawTurns
    .map((turn, index) => {
      const groupKey = turn.assistantMessageId || turn.sessionId || `legacy-turn:${index}`;
      const assistantMessageId = groupAssignments.get(groupKey);
      return assistantMessageId ? normalizeTurn(turn, assistantMessageId) : null;
    })
    .filter((turn): turn is TurnTrace => turn !== null);

  const existingAssistantIds = new Set(
    normalizedTurns.map((turn) => turn.assistantMessageId),
  );

  assistantMessages.forEach((message) => {
    if (existingAssistantIds.has(message.id)) {
      return;
    }

    normalizedTurns.push(
      buildLegacyFallbackTurn(conversationId, message, normalizedTurns.length + 1),
    );
  });

  return normalizedTurns.sort((left, right) => {
    const assistantOrderDiff =
      (assistantOrder.get(left.assistantMessageId) ?? Number.MAX_SAFE_INTEGER) -
      (assistantOrder.get(right.assistantMessageId) ?? Number.MAX_SAFE_INTEGER);
    if (assistantOrderDiff !== 0) {
      return assistantOrderDiff;
    }

    return (
      left.startTime - right.startTime ||
      left.turnNumber - right.turnNumber ||
      left.sessionId.localeCompare(right.sessionId)
    );
  });
};

export const buildProviderTranscript = (
  messages: Message[],
  turns: TurnTrace[] | undefined,
): ProviderTranscriptMessage[] => {
  const transcript: ProviderTranscriptMessage[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant') {
      transcript.push({
        role: message.role,
        content: message.content,
        contentBlocks: message.contentBlocks?.length ? message.contentBlocks : undefined,
      });
      continue;
    }

    const messageTurns = getTurnsForAssistantMessage(turns, message.id);
    if (messageTurns.length === 0) {
      transcript.push({
        role: message.role,
        content: message.content,
        contentBlocks: message.contentBlocks?.length ? message.contentBlocks : undefined,
      });
      continue;
    }

    for (const turn of messageTurns) {
      const toolUseBlocks = assistantPreludeBlocksFromTurn(turn);
      const toolResultBlocks = toolResultBlocksFromTurn(turn);
      const hasTools = turn.tools.length > 0;

      if (hasTools && toolUseBlocks.length > 0) {
        transcript.push({
          role: 'assistant',
          content: '',
          contentBlocks: toolUseBlocks,
        });
      }

      if (toolResultBlocks.length > 0) {
        transcript.push({
          role: 'user',
          content: '',
          contentBlocks: toolResultBlocks,
        });
      }

      const responseBlocks = hasTools
        ? assistantResponseBlocksFromTurn(turn)
        : turn.response.content
          ? assistantResponseBlocksFromTurn(turn)
          : toolUseBlocks;
      const responseContent = turn.response.content;

      if ((!hasTools && responseBlocks.length > 0) || responseContent) {
        transcript.push({
          role: 'assistant',
          content: responseContent,
          contentBlocks: responseBlocks.length > 0 ? responseBlocks : undefined,
        });
      }
    }
  }

  return transcript;
};
