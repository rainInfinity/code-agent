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
    appendToMessage,
    updateMessage,
    setStreaming,
    createConversation,
  } = useChatStore();

  const isConfigured = useSettingsStore((s) => s.isConfigured());

  // Subscribe to Tauri events
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const setup = async () => {
      unsubscribers.push(
        await onStreamDelta((event) => {
          appendToMessage(event.conversationId, event.messageId, event.delta);
        })
      );

      unsubscribers.push(
        await onStreamEnd((event) => {
          updateMessage(event.conversationId, event.messageId, {
            content: event.fullContent,
            status: 'complete',
          });
          setStreaming(false);
        })
      );

      unsubscribers.push(
        await onStreamError((event) => {
          updateMessage(event.conversationId, event.messageId, {
            content: event.error,
            status: 'error',
          });
          setStreaming(false);
        })
      );
    };

    setup();

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [appendToMessage, updateMessage, setStreaming]);

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
    [activeConversationId, isStreaming, addMessage, createConversation, setStreaming, updateMessage]
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
