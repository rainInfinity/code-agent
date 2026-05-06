import type { Conversation, Message } from '@/types';
import { upsertTrailingTextBlock, upsertTrailingThinkingBlock } from './contentBlockUtils';
import { generateId } from './conversationActions';

export function addMessage(
  conversations: Conversation[],
  conversationId: string,
  message: Omit<Message, 'id' | 'timestamp'>,
): { conversations: Conversation[]; messageId: string } {
  const id = generateId();
  const fullMessage: Message = {
    ...message,
    id,
    timestamp: Date.now(),
  };
  const next = conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          messages: [...c.messages, fullMessage],
          updatedAt: Date.now(),
          title:
            c.messages.length === 0 && message.role === 'user'
              ? message.content.slice(0, 50) +
                (message.content.length > 50 ? '...' : '')
              : c.title,
        }
      : c,
  );
  return { conversations: next, messageId: id };
}

export function updateMessage(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  updates: Partial<Message>,
): Conversation[] {
  return conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m,
          ),
          updatedAt: Date.now(),
        }
      : c,
  );
}

export function appendToMessage(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  delta: string,
): Conversation[] {
  return conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== messageId) return m;
            const content = m.content + delta;
            const contentBlocks = upsertTrailingTextBlock(
              m.contentBlocks,
              content,
            );
            return { ...m, content, contentBlocks };
          }),
        }
      : c,
  );
}

export function appendThinkingToMessage(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  delta: string,
): Conversation[] {
  return conversations.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== messageId) return m;

            const thinkingContent = `${m.thinkingContent ?? ''}${delta}`;

            return {
              ...m,
              thinkingContent,
              thinkingStartedAt: m.thinkingStartedAt ?? Date.now(),
              contentBlocks: upsertTrailingThinkingBlock(
                m.contentBlocks,
                thinkingContent,
              ),
            };
          }),
          updatedAt: Date.now(),
        }
      : c,
  );
}
