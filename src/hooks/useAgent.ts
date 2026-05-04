import { useCallback, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  onAgentComplete,
  onAgentTurn,
  onStreamDelta,
  onStreamEnd,
  onStreamError,
  onToolCall,
  onToolResult,
  runAgent,
  stopAgent,
} from '@/hooks/useIpc';

type AgentListenerRegistry = {
  installed: boolean;
  unlisteners: Array<() => void>;
};

const agentListenerRegistryKey = '__codeAgentListeners__';

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
      onAgentTurn((event) => {
        useAgentStore.getState().setTurnCount(event.turnCount);
      }),
      onAgentComplete((event) => {
        const { updateMessage, setStreaming } = useChatStore.getState();
        const isError = event.status === 'error';
        updateMessage(event.conversationId, event.messageId, {
          ...(isError ? { content: event.reason } : {}),
          status: isError ? 'error' : 'complete',
        });
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
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const setRunning = useAgentStore((state) => state.setRunning);
  const resetAgent = useAgentStore((state) => state.reset);

  useEffect(() => {
    ensureAgentListeners();
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      let convId = activeConversationId;
      if (!convId) {
        const workDir = agentMode === 'code' ? (selectedWorkDir ?? undefined) : undefined;
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
      selectedWorkDir,
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
