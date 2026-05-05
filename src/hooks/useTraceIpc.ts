import { useEffect } from 'react';
import {
  emitTraceWindowReady,
  onAgentComplete,
  onAgentTurn,
  onStreamDelta,
  onThinkingDelta,
  onTraceConversationChanged,
  onTracePrompt,
  onTraceSyncConversations,
  onTraceThinkingEnd,
  onTraceThinkingStart,
} from '@/hooks/useIpc';
import { useTraceStore } from '@/stores/traceStore';
import { CHAT_HISTORY_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import type { Conversation, TraceState } from '@/types';

const TRACE_FLUSH_INTERVAL_MS = 50;

const getAgentStatusFromTurns = (
  turns: Conversation['turns'] | undefined,
): TraceState['agentStatus'] => {
  const latestTurn = turns?.[turns.length - 1];
  if (!latestTurn) return 'idle';
  return latestTurn.status;
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
      const store = useTraceStore.getState();
      thinkingBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        store.appendThinking({ conversationId, messageId, delta });
      });
      responseBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        store.appendResponse({ conversationId, messageId, delta });
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
        onAgentTurn((event) => useTraceStore.getState().startTurn(event)),
        onTracePrompt((event) => useTraceStore.getState().addPrompt(event)),
        onTraceThinkingStart((event) => useTraceStore.getState().startThinking(event)),
        onTraceThinkingEnd((event) => {
          flushNow();
          useTraceStore.getState().endThinking(event);
        }),
        onThinkingDelta((event) =>
          appendBuffered(thinkingBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onStreamDelta((event) =>
          appendBuffered(responseBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onAgentComplete((event) => {
          flushNow();
          useTraceStore.getState().endTurn(event);
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
