import { create } from 'zustand';
import type { AgentStatus, ToolCall } from '@/types';

interface AgentState {
  agentStatus: AgentStatus;
  currentSessionId: string | null;
  turnCount: number;
  pendingToolCalls: ToolCall[];
  setRunning: (sessionId: string) => void;
  setStatus: (status: AgentStatus) => void;
  setTurnCount: (turnCount: number) => void;
  addPendingToolCall: (toolCall: ToolCall) => void;
  clearPendingToolCall: (toolCallId: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentStatus: 'idle',
  currentSessionId: null,
  turnCount: 0,
  pendingToolCalls: [],

  setRunning: (sessionId) =>
    set({
      agentStatus: 'running',
      currentSessionId: sessionId,
      pendingToolCalls: [],
      turnCount: 0,
    }),

  setStatus: (agentStatus) => set({ agentStatus }),

  setTurnCount: (turnCount) => set({ turnCount }),

  addPendingToolCall: (toolCall) =>
    set((state) => ({
      pendingToolCalls: [...state.pendingToolCalls, toolCall],
    })),

  clearPendingToolCall: (toolCallId) =>
    set((state) => ({
      pendingToolCalls: state.pendingToolCalls.filter((toolCall) => toolCall.id !== toolCallId),
    })),

  reset: () =>
    set({
      agentStatus: 'idle',
      currentSessionId: null,
      turnCount: 0,
      pendingToolCalls: [],
    }),
}));
