import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentMode, Message, Conversation } from '@/types';
import { messages as appMessages } from '@/i18n';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

const recentStreamDeltas = new Map<string, { delta: string; at: number }>();
const DUPLICATE_DELTA_WINDOW_MS = 20;

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  selectedWorkDir: string | null;

  // Actions
  createConversation: (workDir?: string) => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (
    id: string,
    fallbackFilter?: { agentMode: AgentMode; workDir?: string | null },
  ) => void;
  getActiveConversation: () => Conversation | undefined;
  getFilteredConversations: () => Conversation[];
  setSelectedWorkDir: (path: string | null) => void;

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  appendToMessage: (conversationId: string, messageId: string, delta: string) => void;
  appendThinkingToMessage: (conversationId: string, messageId: string, delta: string) => void;

  // Streaming state
  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;
}

function normalizePersistedConversations(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.status === 'streaming' || message.status === 'pending'
        ? {
            ...message,
            status: 'error',
            content: message.content || appMessages.messages.interrupted,
          }
        : message,
    ),
  }));
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
        const id = generateId();
        const conversation: Conversation = {
          id,
          title: appMessages.conversations.newConversation,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          workDir,
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      setActiveConversation: (id: string | null) => set({ activeConversationId: id }),

      deleteConversation: (id: string, fallbackFilter?: { agentMode: AgentMode; workDir?: string | null }) =>
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const fallbackConversations = fallbackFilter
            ? filtered.filter((conversation) =>
                fallbackFilter.agentMode === 'code'
                  ? conversation.workDir === fallbackFilter.workDir
                  : !conversation.workDir,
              )
            : filtered;
          return {
            conversations: filtered,
            activeConversationId:
              state.activeConversationId === id
                ? fallbackConversations[0]?.id ?? filtered[0]?.id ?? null
                : state.activeConversationId,
          };
        }),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
      },

      getFilteredConversations: () => {
        const { conversations } = get();
        // Filtering is done at the component level using useSettingsStore
        return conversations;
      },

      setSelectedWorkDir: (path: string | null) => set({ selectedWorkDir: path }),

      addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const id = generateId();
        const fullMessage: Message = {
          ...message,
          id,
          timestamp: Date.now(),
        };
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, fullMessage],
                  updatedAt: Date.now(),
                  title:
                    c.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                      : c.title,
                }
              : c,
          ),
        }));
        return id;
      },

      updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        })),

      appendToMessage: (conversationId: string, messageId: string, delta: string) =>
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
            conversations: state.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) => {
                      if (m.id !== messageId) return m;
                      const content = m.content + delta;
                      const contentBlocks =
                        m.contentBlocks && m.contentBlocks.length > 0
                          ? m.contentBlocks.map((block, index) =>
                              index === 0 && block.type === 'text'
                                ? { ...block, text: content }
                                : block,
                            )
                          : [{ type: 'text' as const, text: content }];

                      return { ...m, content, contentBlocks };
                    }),
                  }
                : c,
            ),
          };
        }),

      appendThinkingToMessage: (conversationId: string, messageId: string, delta: string) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId
                      ? { ...m, thinkingContent: `${m.thinkingContent ?? ''}${delta}` }
                      : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        })),

      setStreaming: (isStreaming: boolean, messageId: string | null = null) =>
        set({ isStreaming, streamingMessageId: messageId }),
    }),
    {
      name: 'code-agent-chat-history',
      partialize: (state) => ({
        conversations: normalizePersistedConversations(state.conversations),
        activeConversationId: state.activeConversationId,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ChatState>;
        const conversations = normalizePersistedConversations(saved.conversations ?? []);
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
        };
      },
    },
  ),
);
