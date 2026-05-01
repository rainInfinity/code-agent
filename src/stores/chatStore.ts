import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, Conversation } from '@/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingMessageId: string | null;

  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => Conversation | undefined;

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  appendToMessage: (conversationId: string, messageId: string, delta: string) => void;

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
            content: message.content || 'Response interrupted.',
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

      createConversation: () => {
        const id = generateId();
        const conversation: Conversation = {
          id,
          title: 'New Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      setActiveConversation: (id: string) => set({ activeConversationId: id }),

      deleteConversation: (id: string) =>
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          return {
            conversations: filtered,
            activeConversationId:
              state.activeConversationId === id
                ? filtered[0]?.id ?? null
                : state.activeConversationId,
          };
        }),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
      },

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
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + delta } : m,
                  ),
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
