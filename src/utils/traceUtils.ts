import type {
  AgentStatus,
  AgentTurnEvent,
  ContentBlock,
  Message,
  ToolTrace,
  ToolTraceEvent,
  TurnTrace,
  TurnTraceStatus,
} from '@/types';

const toolTraceSort = (left: ToolTrace, right: ToolTrace) =>
  left.logicalIndex - right.logicalIndex ||
  (left.batchId ?? 0) - (right.batchId ?? 0) ||
  (left.batchIndex ?? 0) - (right.batchIndex ?? 0) ||
  left.toolCallId.localeCompare(right.toolCallId);

export const createTurnTrace = (
  event: AgentTurnEvent,
  startedAt = Date.now(),
): TurnTrace => ({
  turnNumber: event.turnCount,
  sessionId: event.sessionId,
  conversationId: event.conversationId,
  startTime: startedAt,
  status: 'running',
  thinking: {
    content: '',
    status: 'idle',
  },
  response: {
    content: '',
  },
  tools: [],
});

export const getTurnTraceStatus = (status: AgentStatus): TurnTraceStatus => {
  switch (status) {
    case 'cancelled':
      return 'cancelled';
    case 'max_turns_reached':
      return 'max_turns_reached';
    case 'error':
      return 'error';
    case 'running':
      return 'running';
    default:
      return 'complete';
  }
};

export const completeTurnTrace = (
  turn: TurnTrace,
  status: AgentStatus,
  inputTokens: number,
  outputTokens: number,
  completedAt = Date.now(),
): TurnTrace => ({
  ...turn,
  endTime: completedAt,
  status: getTurnTraceStatus(status),
  thinking: {
    ...turn.thinking,
    status: turn.thinking.status === 'streaming' ? 'complete' : turn.thinking.status,
    endTime: turn.thinking.endTime ?? completedAt,
  },
  response: {
    ...turn.response,
    endTime: completedAt,
  },
  usage: {
    inputTokens,
    outputTokens,
  },
});

export const buildLegacyToolFields = (toolTraces: ToolTrace[]) => ({
  toolCalls: toolTraces.map((toolTrace) => ({
    id: toolTrace.toolCallId,
    name: toolTrace.name,
    input: toolTrace.input,
  })),
  toolResults: toolTraces
    .filter((toolTrace) => toolTrace.status === 'completed' || toolTrace.status === 'failed')
    .map((toolTrace) => ({
      toolCallId: toolTrace.toolCallId,
      success: toolTrace.status === 'completed',
      output: toolTrace.output ?? '',
      error: toolTrace.error,
    })),
});

export const applyToolTraceEvent = (
  existing: ToolTrace[] | undefined,
  event: ToolTraceEvent,
): ToolTrace[] => {
  const previous = existing ?? [];
  const next = [...previous];
  const index = next.findIndex((toolTrace) => toolTrace.toolCallId === event.toolCallId);
  const current =
    index >= 0
      ? next[index]
      : {
          toolCallId: event.toolCallId,
          name: event.name,
          input: event.input,
          status: event.phase,
          logicalIndex: event.logicalIndex,
        };

  const updated: ToolTrace = {
    ...current,
    name: event.name,
    input: event.input,
    status: event.phase,
    logicalIndex: event.logicalIndex,
    batchId: event.batchId ?? current.batchId,
    batchIndex: event.batchIndex ?? current.batchIndex,
    isConcurrent: event.isConcurrent ?? current.isConcurrent,
    requestedAt:
      event.phase === 'requested'
        ? event.timestampMs
        : current.requestedAt ?? event.timestampMs,
    startedAt:
      event.phase === 'running'
        ? event.timestampMs
        : current.startedAt,
    completedAt:
      event.phase === 'completed' || event.phase === 'failed'
        ? event.timestampMs
        : current.completedAt,
    output:
      event.phase === 'completed'
        ? event.result?.output ?? current.output
        : current.output,
    error:
      event.phase === 'failed'
        ? event.result?.error ?? event.result?.output ?? current.error
        : current.error,
  };

  if (index >= 0) {
    next[index] = updated;
  } else {
    next.push(updated);
  }

  return next.sort(toolTraceSort);
};

export const getMessageToolTraces = (message: Message): ToolTrace[] => {
  if (message.toolTraces?.length) {
    return [...message.toolTraces].sort(toolTraceSort);
  }

  const toolCallMap = new Map<string, ToolTrace>();
  for (const [index, toolCall] of (message.toolCalls ?? []).entries()) {
    toolCallMap.set(toolCall.id, {
      toolCallId: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
      logicalIndex: index + 1,
      status: 'requested',
    });
  }

  for (const toolResult of message.toolResults ?? []) {
    const existing = toolCallMap.get(toolResult.toolCallId);
    const nextStatus = toolResult.success ? 'completed' : 'failed';
    toolCallMap.set(toolResult.toolCallId, {
      toolCallId: toolResult.toolCallId,
      name: existing?.name ?? toolResult.toolCallId,
      input: existing?.input ?? {},
      logicalIndex: existing?.logicalIndex ?? toolCallMap.size + 1,
      status: nextStatus,
      output: toolResult.success ? toolResult.output : existing?.output,
      error: toolResult.error,
    });
  }

  return [...toolCallMap.values()].sort(toolTraceSort);
};

export const applyToolTraceToMessage = (
  message: Message,
  event: ToolTraceEvent,
): Message => {
  const toolTraces = applyToolTraceEvent(message.toolTraces, event);
  return {
    ...message,
    toolTraces,
    ...buildLegacyToolFields(toolTraces),
  };
};

export const applyToolTraceToTurn = (
  turn: TurnTrace,
  event: ToolTraceEvent,
): TurnTrace => ({
  ...turn,
  tools: applyToolTraceEvent(turn.tools, event),
});

const summarizeToolInput = (input: Record<string, unknown>) => {
  const keys = Object.keys(input);
  if (keys.length === 0) return '{}';
  return JSON.stringify(input);
};

export const blockToDisplayText = (block: ContentBlock): string => {
  switch (block.type) {
    case 'text':
      return block.text;
    case 'thinking':
      return `Thinking: ${block.thinking}`;
    case 'tool_use':
      return `Tool use: ${block.name} ${summarizeToolInput(block.input)}`;
    case 'tool_result':
      return `${block.isError ? 'Tool error' : 'Tool result'}: ${block.content}`;
    default:
      return '';
  }
};

export const summarizeContentBlocks = (contentBlocks: ContentBlock[] | undefined): string => {
  const summary = (contentBlocks ?? [])
    .map((block) => blockToDisplayText(block).trim())
    .filter(Boolean)
    .join('\n');

  return summary.trim();
};
