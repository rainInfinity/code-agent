import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentMode, Conversation, Message, TurnTrace } from '@/types';
import {
  createConversation,
  deleteConversation,
  setConversationTraceEnabled,
  appendTurn,
  updateLatestTurn,
  clearConversationTurns,
} from './conversationActions';
import {
  addMessage,
  updateMessage,
  appendToMessage,
  appendThinkingToMessage,
} from './messageActions';
import { normalizePersistedConversations } from './persistenceUtils';

export { normalizePersistedConversations };

const recentStreamDeltas = new Map<string, { delta: string; at: number }>();
const DUPLICATE_DELTA_WINDOW_MS = 20;
export const CHAT_HISTORY_STORAGE_KEY = 'code-agent-chat-history';
export const TRACE_CHAT_HISTORY_STORAGE_KEY = 'code-agent-trace-chat-history';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  selectedWorkDir: string | null;

  createConversation: (workDir?: string) => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (
    id: string,
    fallbackFilter?: { agentMode: AgentMode; workDir?: string | null },
  ) => void;
  getActiveConversation: () => Conversation | undefined;
  getFilteredConversations: () => Conversation[];
  setSelectedWorkDir: (path: string | null) => void;
  setConversationTraceEnabled: (
    conversationId: string,
    traceEnabled: boolean,
  ) => void;
  appendTurn: (conversationId: string, turn: TurnTrace) => void;
  updateLatestTurn: (
    conversationId: string,
    updater: (turn: TurnTrace) => TurnTrace,
  ) => void;
  clearConversationTurns: (conversationId: string) => void;

  addMessage: (
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp'>,
  ) => string;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => void;
  appendToMessage: (
    conversationId: string,
    messageId: string,
    delta: string,
  ) => void;
  appendThinkingToMessage: (
    conversationId: string,
    messageId: string,
    delta: string,
  ) => void;

  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;

  isTracePinned: boolean;
  setTracePinned: (isPinned: boolean) => void;
  isTraceDocked: boolean;
  setTraceDocked: (isDocked: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      streamingMessageId: null,
      selectedWorkDir: null,

      createConversation: (workDir?: string) => {
        const result = createConversation(get().conversations, workDir);
        set({
          conversations: result.conversations,
          activeConversationId: result.activeConversationId,
        });
        return result.id;
      },

      setActiveConversation: (id: string | null) =>
        set({ activeConversationId: id }),

      deleteConversation: (
        id: string,
        fallbackFilter?: { agentMode: AgentMode; workDir?: string | null },
      ) =>
        set((state) =>
          deleteConversation(
            state.conversations,
            state.activeConversationId,
            id,
            fallbackFilter,
          ),
        ),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
      },

      getFilteredConversations: () => get().conversations,

      setSelectedWorkDir: (path: string | null) =>
        set({ selectedWorkDir: path }),

      setConversationTraceEnabled: (
        conversationId: string,
        traceEnabled: boolean,
      ) =>
        set((state) => ({
          conversations: setConversationTraceEnabled(
            state.conversations,
            conversationId,
            traceEnabled,
          ),
        })),

      appendTurn: (conversationId: string, turn: TurnTrace) =>
        set((state) => ({
          conversations: appendTurn(
            state.conversations,
            conversationId,
            turn,
          ),
        })),

      updateLatestTurn: (
        conversationId: string,
        updater: (turn: TurnTrace) => TurnTrace,
      ) =>
        set((state) => ({
          conversations: updateLatestTurn(
            state.conversations,
            conversationId,
            updater,
          ),
        })),

      clearConversationTurns: (conversationId: string) =>
        set((state) => ({
          conversations: clearConversationTurns(
            state.conversations,
            conversationId,
          ),
        })),

      addMessage: (
        conversationId: string,
        message: Omit<Message, 'id' | 'timestamp'>,
      ) => {
        const result = addMessage(
          get().conversations,
          conversationId,
          message,
        );
        set({ conversations: result.conversations });
        return result.messageId;
      },

      updateMessage: (
        conversationId: string,
        messageId: string,
        updates: Partial<Message>,
      ) =>
        set((state) => ({
          conversations: updateMessage(
            state.conversations,
            conversationId,
            messageId,
            updates,
          ),
        })),

      appendToMessage: (
        conversationId: string,
        messageId: string,
        delta: string,
      ) =>
        set((state) => {
          const now = Date.now();
          const recent = recentStreamDeltas.get(messageId);

          if (
            recent &&
            recent.delta === delta &&
            now - recent.at < DUPLICATE_DELTA_WINDOW_MS
          ) {
            return state;
          }

          recentStreamDeltas.set(messageId, { delta, at: now });

          return {
            conversations: appendToMessage(
              state.conversations,
              conversationId,
              messageId,
              delta,
            ),
          };
        }),

      appendThinkingToMessage: (
        conversationId: string,
        messageId: string,
        delta: string,
      ) =>
        set((state) => ({
          conversations: appendThinkingToMessage(
            state.conversations,
            conversationId,
            messageId,
            delta,
          ),
        })),

      setStreaming: (isStreaming: boolean, messageId: string | null = null) =>
        set({ isStreaming, streamingMessageId: messageId }),

      isTracePinned: false,

      setTracePinned: (isPinned: boolean) => set({ isTracePinned: isPinned }),

      isTraceDocked: false,

      setTraceDocked: (isDocked: boolean) =>
        set({ isTraceDocked: isDocked }),
    }),
    {
      name:
        typeof window !== 'undefined' &&
        window.location.search.includes('window=trace')
          ? TRACE_CHAT_HISTORY_STORAGE_KEY
          : CHAT_HISTORY_STORAGE_KEY,
      partialize: (state) => ({
        conversations: normalizePersistedConversations(state.conversations),
        activeConversationId: state.activeConversationId,
        isTracePinned: state.isTracePinned,
        isTraceDocked: state.isTraceDocked,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ChatState>;
        const conversations = normalizePersistedConversations(
          saved.conversations ?? [],
        );
        const activeConversationId = conversations.some(
          (conversation) => conversation.id === saved.activeConversationId,
        )
          ? saved.activeConversationId ?? null
          : conversations[0]?.id ?? null;

        return {
          ...current,
          conversations,
          activeConversationId,
          isStreaming: false,
          streamingMessageId: null,
          isTracePinned: saved.isTracePinned ?? false,
          isTraceDocked: saved.isTraceDocked ?? false,
        };
      },
    },
  ),
);
