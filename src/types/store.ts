import type { Conversation } from '@/types/conversation';

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  isTraceOpen: boolean;
  isTracePinned: boolean;
  isAlwaysOnTop: boolean;
  setTraceOpen: (isTraceOpen: boolean) => void;
  setTracePinned: (isPinned: boolean) => void;
  setAlwaysOnTop: (isAlwaysOnTop: boolean) => void;
}
