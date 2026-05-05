import { useCallback, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  onAgentComplete,
  onAgentTurn,
  onThinkingDelta,
  onStreamDelta,
  onStreamEnd,
  onStreamError,
  onToolCall,
  onToolResult,
  onTracePrompt,
  onTraceThinkingEnd,
  onTraceThinkingStart,
  onTraceWindowClosed,
  runAgent,
  stopAgent,
} from '@/hooks/useIpc';
import type {
  AgentCompleteEvent,
  AgentTurnEvent,
  StreamEvent,
  StreamThinkingEvent,
  TracePromptEvent,
  TraceThinkingEvent,
  TurnTrace,
} from '@/types';

type AgentListenerRegistry = {
  installed: boolean;
  unlisteners: Array<() => void>;
};

const agentListenerRegistryKey = '__codeAgentListeners__';

type BufferedDelta = {
  conversationId: string;
  messageId: string;
  delta: string;
  frameId: number | null;
};

type DeltaBuffer = Map<string, BufferedDelta>;

const getBufferKey = (conversationId: string, messageId: string) =>
  `${conversationId}:${messageId}`;

const requestFrame = (callback: FrameRequestCallback) => {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
};

const cancelFrame = (frameId: number) => {
  if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(frameId);
    return;
  }

  window.clearTimeout(frameId);
};

function flushBufferedDelta(
  buffer: DeltaBuffer,
  conversationId: string,
  messageId: string,
  append: (conversationId: string, messageId: string, delta: string) => void,
) {
  const key = getBufferKey(conversationId, messageId);
  const entry = buffer.get(key);
  if (!entry || !entry.delta) return;

  if (entry.frameId !== null) {
    cancelFrame(entry.frameId);
  }

  buffer.delete(key);
  append(entry.conversationId, entry.messageId, entry.delta);
}

function appendBufferedDelta(
  buffer: DeltaBuffer,
  conversationId: string,
  messageId: string,
  delta: string,
  append: (conversationId: string, messageId: string, delta: string) => void,
) {
  const key = getBufferKey(conversationId, messageId);
  const current = buffer.get(key) ?? {
    conversationId,
    messageId,
    delta: '',
    frameId: null,
  };

  current.delta += delta;

  if (current.frameId === null) {
    current.frameId = requestFrame(() => {
      const queued = buffer.get(key);
      if (queued) {
        queued.frameId = null;
      }
      flushBufferedDelta(buffer, conversationId, messageId, append);
    });
  }

  buffer.set(key, current);
}

function updateLatestTraceTurn(
  conversationId: string,
  updater: (turn: TurnTrace) => TurnTrace,
) {
  useChatStore.getState().updateLatestTurn(conversationId, updater);
}

function recordTraceTurnStart(event: AgentTurnEvent) {
  useChatStore.getState().appendTurn(event.conversationId, {
    turnNumber: event.turnCount,
    sessionId: event.sessionId,
    conversationId: event.conversationId,
    startTime: Date.now(),
    status: 'running',
    thinking: {
      content: '',
      status: 'idle',
    },
    response: {
      content: '',
    },
  });
}

function recordTracePrompt(event: TracePromptEvent) {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    prompt: {
      systemPrompt: event.systemPrompt,
      messages: event.messages,
      tools: event.tools,
    },
  }));
}

function recordTraceThinkingStart(event: TraceThinkingEvent) {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      startTime: turn.thinking.startTime ?? Date.now(),
      status: 'streaming',
    },
  }));
}

function recordTraceThinkingEnd(event: TraceThinkingEvent) {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      endTime: Date.now(),
      status: turn.thinking.content ? 'complete' : 'idle',
    },
  }));
}

function recordTraceThinkingDelta(event: StreamThinkingEvent) {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      content: `${turn.thinking.content}${event.delta}`,
      startTime: turn.thinking.startTime ?? Date.now(),
      status: 'streaming',
    },
  }));
}

function recordTraceResponseDelta(event: StreamEvent) {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    response: {
      ...turn.response,
      content: `${turn.response.content}${event.delta}`,
      startTime: turn.response.startTime ?? Date.now(),
    },
  }));
}

function recordTraceComplete(event: AgentCompleteEvent) {
  const completedAt = Date.now();
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    endTime: completedAt,
    status: event.status === 'error' ? 'error' : 'complete',
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
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
    },
  }));
}

function getAgentListenerRegistry(): AgentListenerRegistry {
  const target = globalThis as typeof globalThis & {
    [agentListenerRegistryKey]?: AgentListenerRegistry;
  };

  if (!target[agentListenerRegistryKey]) {
    target[agentListenerRegistryKey] = {
      installed: false,
      unlisteners: [],
    };
  }

  return target[agentListenerRegistryKey];
}

function ensureAgentListeners() {
  const registry = getAgentListenerRegistry();
  if (registry.installed) return;
  registry.installed = true;
  const streamDeltaBuffer: DeltaBuffer = new Map();
  const thinkingDeltaBuffer: DeltaBuffer = new Map();

  const install = async () => {
    const unlisteners = await Promise.all([
      onStreamDelta((event) => {
        appendBufferedDelta(
          streamDeltaBuffer,
          event.conversationId,
          event.messageId,
          event.delta,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendToMessage(conversationId, messageId, delta);
            recordTraceResponseDelta({ conversationId, messageId, delta });
          },
        );
      }),
      onThinkingDelta((event) => {
        appendBufferedDelta(
          thinkingDeltaBuffer,
          event.conversationId,
          event.messageId,
          event.delta,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendThinkingToMessage(conversationId, messageId, delta);
            recordTraceThinkingDelta({ conversationId, messageId, delta });
          },
        );
      }),
      onStreamEnd((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        flushBufferedDelta(
          streamDeltaBuffer,
          event.conversationId,
          event.messageId,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendToMessage(conversationId, messageId, delta);
            recordTraceResponseDelta({ conversationId, messageId, delta });
          },
        );
        flushBufferedDelta(
          thinkingDeltaBuffer,
          event.conversationId,
          event.messageId,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendThinkingToMessage(conversationId, messageId, delta);
            recordTraceThinkingDelta({ conversationId, messageId, delta });
          },
        );
        updateMessage(event.conversationId, event.messageId, {
          content: event.fullContent,
          status: 'complete',
          usage: {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
          },
        });
        setStreaming(false);
      }),
      onStreamError((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        flushBufferedDelta(
          streamDeltaBuffer,
          event.conversationId,
          event.messageId,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendToMessage(conversationId, messageId, delta);
            recordTraceResponseDelta({ conversationId, messageId, delta });
          },
        );
        flushBufferedDelta(
          thinkingDeltaBuffer,
          event.conversationId,
          event.messageId,
          (conversationId, messageId, delta) => {
            useChatStore.getState().appendThinkingToMessage(conversationId, messageId, delta);
            recordTraceThinkingDelta({ conversationId, messageId, delta });
          },
        );
        updateMessage(event.conversationId, event.messageId, {
          content: event.error,
          status: 'error',
        });
        setStreaming(false);
        useAgentStore.getState().reset();
      }),
      onToolCall((event) => {
        const toolCall = {
          id: event.toolCallId,
          name: event.name,
          input: event.input,
        };
        const { addPendingToolCall } = useAgentStore.getState();
        const { updateMessage } = useChatStore.getState();
        addPendingToolCall(toolCall);
        updateMessage(event.conversationId, event.messageId, {
          toolCalls: [
            ...(
              useChatStore
                .getState()
                .conversations.find((conversation) => conversation.id === event.conversationId)
                ?.messages.find((message) => message.id === event.messageId)?.toolCalls ?? []
            ),
            toolCall,
          ],
        });
      }),
      onToolResult((event) => {
        const { clearPendingToolCall } = useAgentStore.getState();
        const { updateMessage } = useChatStore.getState();
        clearPendingToolCall(event.toolCallId);
        const conversation = useChatStore
          .getState()
          .conversations.find((item) => item.id === event.conversationId);
        const message = conversation?.messages.find((item) => item.id === event.messageId);
        updateMessage(event.conversationId, event.messageId, {
          toolResults: [
            ...(message?.toolResults ?? []),
            {
              toolCallId: event.toolCallId,
              success: event.result.success,
              output: event.result.output,
              error: event.result.error,
            },
          ],
        });
      }),
      onTracePrompt(recordTracePrompt),
      onTraceThinkingStart(recordTraceThinkingStart),
      onTraceThinkingEnd(recordTraceThinkingEnd),
      onAgentTurn((event) => {
        recordTraceTurnStart(event);
        useAgentStore.getState().setTurnCount(event.turnCount);
      }),
      onAgentComplete((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        const isError = event.status === 'error';
        updateMessage(event.conversationId, event.messageId, {
          ...(isError ? { content: event.reason } : {}),
          status: isError ? 'error' : 'complete',
          usage: {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
          },
        });
        recordTraceComplete(event);
        setStreaming(false);
        useAgentStore.getState().reset();
      }),
    ]);

    registry.unlisteners.push(...unlisteners);
  };

  install().catch(() => {
    registry.installed = false;
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const registry = getAgentListenerRegistry();
    registry.unlisteners.forEach((unlisten) => unlisten());
    registry.unlisteners = [];
    registry.installed = false;
  });
}

export function useAgent() {
  const {
    activeConversationId,
    conversations,
    isStreaming,
    selectedWorkDir,
    addMessage,
    updateMessage,
    setStreaming,
    createConversation,
  } = useChatStore();

  const isConfigured = useSettingsStore((state) => state.isConfigured());
  const activeProviderId = useSettingsStore((state) => state.activeProviderId);
  const agentMode = useSettingsStore((state) => state.agentMode);
  const workingDirectories = useSettingsStore((state) => state.workingDirectories);
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const setRunning = useAgentStore((state) => state.setRunning);
  const resetAgent = useAgentStore((state) => state.reset);

  useEffect(() => {
    ensureAgentListeners();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onTraceWindowClosed(() => {
      const { activeConversationId: currentId, setConversationTraceEnabled } = useChatStore.getState();
      if (currentId) {
        setConversationTraceEnabled(currentId, false);
      }
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => {
        unlisten = undefined;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const effectiveWorkDir =
        agentMode === 'code'
          ? (selectedWorkDir && workingDirectories.some((dir) => dir.path === selectedWorkDir)
              ? selectedWorkDir
              : workingDirectories[0]?.path ?? null)
          : null;
      const visibleConversations =
        agentMode === 'code'
          ? (effectiveWorkDir
              ? conversations.filter((conversation) => conversation.workDir === effectiveWorkDir)
              : [])
          : conversations.filter((conversation) => !conversation.workDir);
      let convId = visibleConversations.some((conversation) => conversation.id === activeConversationId)
        ? activeConversationId
        : null;

      if (!convId) {
        if (agentMode === 'code' && !effectiveWorkDir) return;
        const workDir = agentMode === 'code' ? effectiveWorkDir ?? undefined : undefined;
        convId = createConversation(workDir);
      }

      addMessage(convId, {
        role: 'user',
        content: content.trim(),
        contentBlocks: [{ type: 'text', text: content.trim() }],
        status: 'complete',
      });

      const assistantMsgId = addMessage(convId, {
        role: 'assistant',
        content: '',
        contentBlocks: [],
        status: 'streaming',
      });

      setStreaming(true, assistantMsgId);

      const conversation = useChatStore.getState().conversations.find((item) => item.id === convId);
      if (!conversation) return;

      const messages = conversation.messages
        .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.status === 'complete'))
        .map((message) => ({
          role: message.role,
          content: message.content,
          contentBlocks: message.contentBlocks,
        }));

      try {
        const sessionId = await runAgent({
          providerId: activeProviderId,
          conversationId: convId,
          assistantMessageId: assistantMsgId,
          agentType: agentMode,
          workDir: effectiveWorkDir,
          messages,
        });
        setRunning(sessionId);
      } catch (err) {
        updateMessage(convId, assistantMsgId, {
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          status: 'error',
        });
        setStreaming(false);
        resetAgent();
      }
    },
    [
      activeConversationId,
      activeProviderId,
      agentMode,
      conversations,
      selectedWorkDir,
      workingDirectories,
      isStreaming,
      addMessage,
      createConversation,
      setStreaming,
      setRunning,
      updateMessage,
      resetAgent,
    ],
  );

  const stop = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      await stopAgent(currentSessionId);
    } catch {
      resetAgent();
      setStreaming(false);
    }
  }, [currentSessionId, resetAgent, setStreaming]);

  return { send, stop, isStreaming, isConfigured };
}
