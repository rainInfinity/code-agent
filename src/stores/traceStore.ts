import { create } from 'zustand';
import { useChatStore } from '@/stores/chatStore';
import type { TraceState } from '@/types';

export const useTraceStore = create<TraceState>((set) => ({
  conversationId: null,
  sessionId: null,
  isPinned: useChatStore.getState().isTracePinned,
  docking: {
    side: null,
    attachedWidth: 420,
    isDocked: false,
    alwaysOnTop: false,
    alwaysOnTopForced: false,
  },
  agentStatus: 'idle',

  setPinned: (isPinned) => {
    useChatStore.getState().setTracePinned(isPinned);
    set({ isPinned });
  },

  setDocking: (docking) =>
    set({
      docking,
    }),

  reset: (conversationId = null) =>
    set({
      conversationId,
      sessionId: null,
      agentStatus: 'idle',
    }),

  clearTurns: (conversationId) => {
    useChatStore.getState().clearConversationTurns(conversationId);
  },
}));
