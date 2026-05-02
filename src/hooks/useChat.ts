import { useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  sendMessage as ipcSendMessage,
  stopStreaming as ipcStopStreaming,
  onStreamDelta,
  onStreamEnd,
  onStreamError,
} from '@/hooks/useIpc';

type StreamListenerRegistry = {
  installed: boolean;
  unlisteners: Array<() => void>;
};

const streamListenerRegistryKey = '__codeAgentStreamListeners__';

function getStreamListenerRegistry(): StreamListenerRegistry {
  const target = globalThis as typeof globalThis & {
    [streamListenerRegistryKey]?: StreamListenerRegistry;
  };

  if (!target[streamListenerRegistryKey]) {
    target[streamListenerRegistryKey] = {
      installed: false,
      unlisteners: [],
    };
  }

  return target[streamListenerRegistryKey];
}

function ensureStreamListeners() {
  const registry = getStreamListenerRegistry();
  if (registry.installed) return;
  registry.installed = true;

  const install = async () => {
    const unlisteners = await Promise.all([
      onStreamDelta((event) => {
        useChatStore.getState().appendToMessage(event.conversationId, event.messageId, event.delta);
      }),
      onStreamEnd((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        updateMessage(event.conversationId, event.messageId, {
          content: event.fullContent,
          status: 'complete',
        });
        setStreaming(false);
      }),
      onStreamError((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        updateMessage(event.conversationId, event.messageId, {
          content: event.error,
          status: 'error',
        });
        setStreaming(false);
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
    const registry = getStreamListenerRegistry();
    registry.unlisteners.forEach((unlisten) => unlisten());
    registry.unlisteners = [];
    registry.installed = false;
  });
}

/**
 * Hook that manages the full chat lifecycle:
 * - Subscribes to streaming events from the Rust backend
 * - Provides send/stop actions
 */
export function useChat() {
  const {
    activeConversationId,
    isStreaming,
    addMessage,
    updateMessage,
    setStreaming,
    createConversation,
  } = useChatStore();

  const isConfigured = useSettingsStore((s) => s.isConfigured());
  const activeProviderId = useSettingsStore((s) => s.activeProviderId);

  // Subscribe to Tauri events
  useEffect(() => {
    ensureStreamListeners();
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      let convId = activeConversationId;
      if (!convId) {
        convId = createConversation();
      }

      // Add user message
      addMessage(convId, {
        role: 'user',
        content: content.trim(),
        status: 'complete',
      });

      // Add placeholder assistant message
      const assistantMsgId = addMessage(convId, {
        role: 'assistant',
        content: '',
        status: 'streaming',
      });

      setStreaming(true, assistantMsgId);

      // Get all messages for context
      const conversation = useChatStore.getState().conversations.find((c) => c.id === convId);
      if (!conversation) return;

      const messages = conversation.messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.status === 'complete'))
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        await ipcSendMessage({
          providerId: activeProviderId,
          conversationId: convId,
          assistantMessageId: assistantMsgId,
          messages,
        });
      } catch (err) {
        updateMessage(convId, assistantMsgId, {
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          status: 'error',
        });
        setStreaming(false);
      }
    },
    [
      activeConversationId,
      activeProviderId,
      isStreaming,
      addMessage,
      createConversation,
      setStreaming,
      updateMessage,
    ]
  );

  const stop = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      await ipcStopStreaming(activeConversationId);
    } catch {
      // Ignore stop errors
    }
    setStreaming(false);
  }, [activeConversationId, setStreaming]);

  return { send, stop, isStreaming, isConfigured };
}
