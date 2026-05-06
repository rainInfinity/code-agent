import { useEffect } from 'react';
import {
  emitTraceWindowReady,
  getTraceDockingState,
  onAgentComplete,
  onAgentTurn,
  onAgentTurnComplete,
  onStreamDelta,
  onThinkingDelta,
  onToolTrace,
  onTraceConversationChanged,
  onTraceDockingChanged,
  onTracePrompt,
  onTraceSyncConversations,
  onTraceThinkingEnd,
  onTraceThinkingStart,
} from '@/hooks/useIpc';
import { useTraceStore } from '@/stores/traceStore';
import { CHAT_HISTORY_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import type {
  AgentTurnCompleteEvent,
  AgentTurnEvent,
  Conversation,
  StreamEvent,
  StreamThinkingEvent,
  ToolTraceEvent,
  TracePromptEvent,
  TraceState,
  TraceThinkingEvent,
  TurnTrace,
} from '@/types';
import {
  applyToolTraceToMessage,
  applyToolTraceToTurn,
  createTurnTrace,
  getTurnTraceStatus,
} from '@/utils/traceUtils';

const TRACE_FLUSH_INTERVAL_MS = 50;

const getAgentStatusFromTurns = (
  turns: Conversation['turns'] | undefined,
): TraceState['agentStatus'] => {
  const latestTurn = turns?.[turns.length - 1];
  if (!latestTurn) return 'idle';
  return latestTurn.status;
};

const updateLatestTraceTurn = (
  conversationId: string,
  updater: (turn: TurnTrace) => TurnTrace,
) => {
  useChatStore.getState().updateLatestTurn(conversationId, updater);
};

const recordTraceTurnStart = (event: AgentTurnEvent) => {
  useChatStore.getState().appendTurn(event.conversationId, createTurnTrace(event));
  useTraceStore.setState({
    conversationId: event.conversationId,
    sessionId: event.sessionId,
    agentStatus: 'running',
  });
};

const recordTracePrompt = (event: TracePromptEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    prompt: {
      systemPrompt: event.systemPrompt,
      messages: event.messages,
      tools: event.tools,
    },
  }));
};

const recordTraceThinkingStart = (event: TraceThinkingEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      startTime: turn.thinking.startTime ?? Date.now(),
      status: 'streaming',
    },
  }));
};

const recordTraceThinkingEnd = (event: TraceThinkingEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      endTime: Date.now(),
      status: turn.thinking.content ? 'complete' : 'idle',
    },
  }));
};

const recordTraceThinkingDelta = (event: StreamThinkingEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    thinking: {
      ...turn.thinking,
      content: `${turn.thinking.content}${event.delta}`,
      startTime: turn.thinking.startTime ?? Date.now(),
      status: 'streaming',
    },
  }));
};

const recordTraceResponseDelta = (event: StreamEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    response: {
      ...turn.response,
      content: `${turn.response.content}${event.delta}`,
      startTime: turn.response.startTime ?? Date.now(),
    },
  }));
};

const recordTraceTool = (event: ToolTraceEvent) => {
  updateLatestTraceTurn(event.conversationId, (turn) => applyToolTraceToTurn(turn, event));

  const conversation = useChatStore
    .getState()
    .conversations.find((item) => item.id === event.conversationId);
  const message = conversation?.messages.find((item) => item.id === event.messageId);
  if (!message) return;

  useChatStore
    .getState()
    .updateMessage(event.conversationId, event.messageId, applyToolTraceToMessage(message, event));
};

const recordTraceTurnComplete = (event: AgentTurnCompleteEvent) => {
  const completedAt = Date.now();
  updateLatestTraceTurn(event.conversationId, (turn) => ({
    ...turn,
    endTime: completedAt,
    status: getTurnTraceStatus(event.status),
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

  useTraceStore.setState({
    sessionId: event.sessionId,
    agentStatus: event.status,
  });
};

const mergeSyncedConversations = (incoming: Conversation[]) => {
  const existingById = new Map(
    useChatStore.getState().conversations.map((conversation) => [conversation.id, conversation]),
  );

  return incoming.map((conversation) => {
    const existing = existingById.get(conversation.id);
    const incomingTurns = conversation.turns ?? [];
    const existingTurns = existing?.turns ?? [];

    if (incomingTurns.length === 0 && existingTurns.length > 0) {
      return {
        ...conversation,
        turns: existingTurns,
      };
    }

    return conversation;
  });
};

type PersistedChatHistory = {
  state?: {
    conversations?: Conversation[];
    activeConversationId?: string | null;
  };
};

const readPersistedMainChatHistory = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedChatHistory;
    return parsed.state ?? null;
  } catch {
    return null;
  }
};

const syncTraceStateFromConversations = (conversationId: string | null) => {
  const conversation = useChatStore
    .getState()
    .conversations.find((item) => item.id === conversationId);
  const latestTurn = conversation?.turns?.[conversation.turns.length - 1];

  useTraceStore.setState({
    sessionId: latestTurn?.sessionId ?? null,
    agentStatus: getAgentStatusFromTurns(conversation?.turns),
  });
};

const hydrateTraceFromPersistedMainHistory = (preferredConversationId: string | null) => {
  const persisted = readPersistedMainChatHistory();
  if (!persisted?.conversations) return;

  const conversations = mergeSyncedConversations(persisted.conversations);
  useChatStore.setState({ conversations });

  const currentConversationId =
    preferredConversationId ??
    useTraceStore.getState().conversationId ??
    persisted.activeConversationId ??
    null;

  if (!useTraceStore.getState().conversationId && currentConversationId) {
    useTraceStore.getState().reset(currentConversationId);
  }

  syncTraceStateFromConversations(currentConversationId);
};

export function useTraceIpc() {
  useEffect(() => {
    let disposed = false;
    let cleanup: Array<() => void> = [];
    let flushTimer: number | undefined;
    const thinkingBuffer = new Map<string, string>();
    const responseBuffer = new Map<string, string>();

    const flushBuffers = () => {
      flushTimer = undefined;
      thinkingBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        recordTraceThinkingDelta({ conversationId, messageId, delta });
      });
      responseBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        recordTraceResponseDelta({ conversationId, messageId, delta });
      });
      thinkingBuffer.clear();
      responseBuffer.clear();
    };

    const flushNow = () => {
      if (flushTimer !== undefined) {
        window.clearTimeout(flushTimer);
      }
      flushBuffers();
    };

    const scheduleFlush = () => {
      if (flushTimer !== undefined) return;
      flushTimer = window.setTimeout(flushBuffers, TRACE_FLUSH_INTERVAL_MS);
    };

    const appendBuffered = (
      buffer: Map<string, string>,
      conversationId: string,
      messageId: string,
      delta: string,
    ) => {
      const key = `${conversationId}|${messageId}`;
      buffer.set(key, `${buffer.get(key) ?? ''}${delta}`);
      scheduleFlush();
    };

    const install = async () => {
      cleanup = await Promise.all([
        onTraceConversationChanged((event) => {
          useTraceStore.getState().reset(event.conversationId);
          syncTraceStateFromConversations(event.conversationId);
        }),
        onTraceSyncConversations((event) => {
          const conversations = mergeSyncedConversations(event.conversations);
          useChatStore.setState({ conversations });
          syncTraceStateFromConversations(useTraceStore.getState().conversationId);
        }),
        onTraceDockingChanged((event) => useTraceStore.getState().setDocking(event)),
        onAgentTurn(recordTraceTurnStart),
        onTracePrompt(recordTracePrompt),
        onTraceThinkingStart(recordTraceThinkingStart),
        onTraceThinkingEnd((event) => {
          flushNow();
          recordTraceThinkingEnd(event);
        }),
        onThinkingDelta((event) =>
          appendBuffered(thinkingBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onStreamDelta((event) =>
          appendBuffered(responseBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onToolTrace(recordTraceTool),
        onAgentTurnComplete((event) => {
          flushNow();
          recordTraceTurnComplete(event);
        }),
        onAgentComplete((event) => {
          flushNow();
          useTraceStore.setState({
            sessionId: event.sessionId,
            agentStatus: event.status,
          });
        }),
      ]);

      if (disposed) {
        cleanup.forEach((unlisten) => unlisten());
        cleanup = [];
      }
    };

    install()
      .then(() => {
        if (disposed) return;
        // After all listeners are installed, sync initial conversationId
        const currentId = useTraceStore.getState().conversationId;

        // Try reading from URL parameter (set by Rust when creating fresh window)
        if (!currentId) {
          const params = new URLSearchParams(window.location.search);
          const urlConversationId = params.get('conversationId');
          if (urlConversationId) {
            useTraceStore.getState().reset(urlConversationId);
          }
        }

        // Always request full state sync from main window — the trace window
        // has its own localStorage (Tauri per-webview storage), so we need the
        // main window to send the actual conversations data.
        hydrateTraceFromPersistedMainHistory(useTraceStore.getState().conversationId);
        getTraceDockingState()
          .then((state) => useTraceStore.getState().setDocking(state))
          .catch(() => {});
        emitTraceWindowReady().catch(() => {});
      })
      .catch(() => {
        cleanup = [];
      });

    return () => {
      disposed = true;
      if (flushTimer !== undefined) {
        window.clearTimeout(flushTimer);
      }
      flushBuffers();
      cleanup.forEach((unlisten) => unlisten());
    };
  }, []);
}
