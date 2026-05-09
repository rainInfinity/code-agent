import type { Conversation } from '@/types';
import { messages as appMessages } from '@/i18n';
import { migrateMessageContentBlocks } from './contentBlockUtils';
import { normalizeConversationTurns } from '@/utils/turns';

export function normalizePersistedConversations(
  conversations: Conversation[],
): Conversation[] {
  return conversations.map((conversation) => {
    const messages = conversation.messages.map((message) => {
      const normalizedMessage =
        message.status === 'streaming' || message.status === 'pending'
          ? {
              ...message,
              status: 'error' as const,
              content: message.content || appMessages.messages.interrupted,
            }
          : message;

      return migrateMessageContentBlocks(normalizedMessage);
    });

    return {
      ...conversation,
      messages,
      turns: normalizeConversationTurns(
        conversation.id,
        messages,
        conversation.turns,
        conversation.turnsCleared,
      ),
    };
  });
}
