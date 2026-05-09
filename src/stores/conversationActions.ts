import type { AgentMode, Conversation, TurnTrace } from '@/types';
import { messages as appMessages } from '@/i18n';

let _generateId: () => string = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export function setGenerateId(fn: () => string) {
  _generateId = fn;
}

export function generateId(): string {
  return _generateId();
}

export function createConversation(
  conversations: Conversation[],
  workDir?: string,
): { conversations: Conversation[]; activeConversationId: string; id: string } {
  const id = generateId();
  const conversation: Conversation = {
    id,
    title: appMessages.conversations.newConversation,
    messages: [],
    turns: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workDir,
  };
  return {
    conversations: [conversation, ...conversations],
    activeConversationId: id,
    id,
  };
}

export function deleteConversation(
  conversations: Conversation[],
  activeConversationId: string | null,
  id: string,
  fallbackFilter?: { agentMode: AgentMode; workDir?: string | null },
): { conversations: Conversation[]; activeConversationId: string | null } {
  const filtered = conversations.filter((c) => c.id !== id);
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
      activeConversationId === id
        ? fallbackConversations[0]?.id ?? filtered[0]?.id ?? null
        : activeConversationId,
  };
}

export function appendTurn(
  conversations: Conversation[],
  conversationId: string,
  turn: TurnTrace,
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          turns: [...(conversation.turns ?? []), turn],
          turnsCleared: false,
          updatedAt: Date.now(),
        }
      : conversation,
  );
}

export function updateLatestTurn(
  conversations: Conversation[],
  conversationId: string,
  updater: (turn: TurnTrace) => TurnTrace,
): Conversation[] {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    const turns = conversation.turns ?? [];
    const turnIndex = turns.length - 1;
    if (turnIndex < 0) return conversation;

    return {
      ...conversation,
      turns: turns.map((turn, index) =>
        index === turnIndex ? updater(turn) : turn,
      ),
      updatedAt: Date.now(),
    };
  });
}

export function clearConversationTurns(
  conversations: Conversation[],
  conversationId: string,
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          turns: [],
          turnsCleared: true,
          updatedAt: Date.now(),
        }
      : conversation,
  );
}
