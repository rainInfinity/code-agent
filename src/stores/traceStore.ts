import { create } from 'zustand';
import { useChatStore } from '@/stores/chatStore';
import type { TraceState, TurnTrace } from '@/types';

function updateLatestTurn(
  conversationId: string,
  updater: (turn: TurnTrace) => TurnTrace,
) {
  useChatStore.getState().updateLatestTurn(conversationId, updater);
}

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

  startTurn: (event) => {
    useChatStore.getState().appendTurn(event.conversationId, {
      turnNumber: event.turnCount,
      sessionId: event.sessionId,
      conversationId: event.conversationId,
      startTime: Date.now(),
      status: 'running',
      thinking: {
        content: '',
        status: 'idle',
      },
      response: {
        content: '',
      },
    });

    set({
      conversationId: event.conversationId,
      sessionId: event.sessionId,
      agentStatus: 'running',
    });
  },

  addPrompt: (event) =>
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      prompt: {
        systemPrompt: event.systemPrompt,
        messages: event.messages,
        tools: event.tools,
      },
    })),

  startThinking: (event) =>
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      thinking: {
        ...turn.thinking,
        startTime: turn.thinking.startTime ?? Date.now(),
        status: 'streaming',
      },
    })),

  endThinking: (event) =>
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      thinking: {
        ...turn.thinking,
        endTime: Date.now(),
        status: turn.thinking.content ? 'complete' : 'idle',
      },
    })),

  appendThinking: (event) =>
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      thinking: {
        ...turn.thinking,
        content: `${turn.thinking.content}${event.delta}`,
        startTime: turn.thinking.startTime ?? Date.now(),
        status: 'streaming',
      },
    })),

  appendResponse: (event) =>
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      response: {
        ...turn.response,
        content: `${turn.response.content}${event.delta}`,
        startTime: turn.response.startTime ?? Date.now(),
      },
    })),

  endTurn: (event) => {
    const completedAt = Date.now();
    updateLatestTurn(event.conversationId, (turn) => ({
      ...turn,
      endTime: completedAt,
      status: event.status === 'error' ? 'error' : 'complete',
      thinking: {
        ...turn.thinking,
        status: turn.thinking.status === 'streaming' ? 'complete' : turn.thinking.status,
        endTime: turn.thinking.endTime ?? completedAt,
      },
      response: {
        ...turn.response,
        endTime: completedAt,
      },
      usage: {
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
      },
    }));

    set({
      agentStatus: event.status === 'error' ? 'error' : 'complete',
      sessionId: event.sessionId,
    });
  },

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
