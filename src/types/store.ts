import type { Conversation } from '@/types/conversation';

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  isTracePinned: boolean;
  setTracePinned: (isPinned: boolean) => void;
}
