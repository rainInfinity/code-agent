import { create } from 'zustand';
import type {
  AgentCompleteEvent,
  AgentTurnEvent,
  StreamEvent,
  StreamThinkingEvent,
  TracePromptEvent,
  TraceThinkingEvent,
  TurnTrace,
} from '@/types';

interface TraceState {
  conversationId: string | null;
  sessionId: string | null;
  turns: TurnTrace[];
  agentStatus: 'idle' | 'running' | 'complete' | 'error';
  startTurn: (event: AgentTurnEvent) => void;
  addPrompt: (event: TracePromptEvent) => void;
  startThinking: (event: TraceThinkingEvent) => void;
  endThinking: (event: TraceThinkingEvent) => void;
  appendThinking: (event: StreamThinkingEvent) => void;
  appendResponse: (event: StreamEvent) => void;
  endTurn: (event: AgentCompleteEvent) => void;
  reset: (conversationId?: string | null) => void;
}

function updateTurn(
  turns: TurnTrace[],
  conversationId: string,
  updater: (turn: TurnTrace) => TurnTrace,
): TurnTrace[] {
  const index = [...turns].reverse().findIndex((turn) => turn.conversationId === conversationId);
  if (index === -1) return turns;
  const actualIndex = turns.length - 1 - index;
  return turns.map((turn, turnIndex) => (turnIndex === actualIndex ? updater(turn) : turn));
}

export const useTraceStore = create<TraceState>((set) => ({
  conversationId: null,
  sessionId: null,
  turns: [],
  agentStatus: 'idle',

  startTurn: (event) =>
    set((state) => {
      const shouldReset = state.conversationId !== event.conversationId;
      const turns = shouldReset ? [] : state.turns;
      return {
        conversationId: event.conversationId,
        sessionId: event.sessionId,
        agentStatus: 'running',
        turns: [
          ...turns,
          {
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
          },
        ],
      };
    }),

  addPrompt: (event) =>
    set((state) => ({
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        prompt: {
          systemPrompt: event.systemPrompt,
          messages: event.messages,
          tools: event.tools,
        },
      })),
    })),

  startThinking: (event) =>
    set((state) => ({
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        thinking: {
          ...turn.thinking,
          startTime: turn.thinking.startTime ?? Date.now(),
          status: 'streaming',
        },
      })),
    })),

  endThinking: (event) =>
    set((state) => ({
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        thinking: {
          ...turn.thinking,
          endTime: Date.now(),
          status: turn.thinking.content ? 'complete' : 'idle',
        },
      })),
    })),

  appendThinking: (event) =>
    set((state) => ({
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        thinking: {
          ...turn.thinking,
          content: `${turn.thinking.content}${event.delta}`,
          startTime: turn.thinking.startTime ?? Date.now(),
          status: 'streaming',
        },
      })),
    })),

  appendResponse: (event) =>
    set((state) => ({
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        response: {
          ...turn.response,
          content: `${turn.response.content}${event.delta}`,
          startTime: turn.response.startTime ?? Date.now(),
        },
      })),
    })),

  endTurn: (event) =>
    set((state) => ({
      agentStatus: event.status === 'error' ? 'error' : 'complete',
      turns: updateTurn(state.turns, event.conversationId, (turn) => ({
        ...turn,
        endTime: Date.now(),
        status: event.status === 'error' ? 'error' : 'complete',
        thinking: {
          ...turn.thinking,
          status: turn.thinking.status === 'streaming' ? 'complete' : turn.thinking.status,
          endTime: turn.thinking.endTime ?? Date.now(),
        },
        response: {
          ...turn.response,
          endTime: Date.now(),
        },
      })),
    })),

  reset: (conversationId = null) =>
    set({
      conversationId,
      sessionId: null,
      turns: [],
      agentStatus: 'idle',
    }),
}));
