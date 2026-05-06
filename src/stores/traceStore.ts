import { create } from 'zustand';
import { useChatStore } from '@/stores/chatStore';
import type { TraceState } from '@/types';

export const useTraceStore = create<TraceState>((set) => ({
  conversationId: null,
  sessionId: null,
  isPinned: useChatStore.getState().isTracePinned,
  alwaysOnTop: false,
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

  setAlwaysOnTop: (alwaysOnTop) => set({ alwaysOnTop }),

  setDocking: (docking) =>
    set({
      docking,
      alwaysOnTop: docking.alwaysOnTop,
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
