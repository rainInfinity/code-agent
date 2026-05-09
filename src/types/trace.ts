import type { TokenUsage } from './base';

export type AgentStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'max_turns_reached' | 'error';

export type ToolTracePhase = 'requested' | 'running' | 'completed' | 'failed';

export type TurnTraceStatus = 'running' | 'complete' | 'cancelled' | 'max_turns_reached' | 'error';

export type TurnThinkingStatus = 'idle' | 'streaming' | 'complete';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolTrace {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolTracePhase;
  logicalIndex: number;
  batchId?: number;
  batchIndex?: number;
  isConcurrent?: boolean;
  requestedAt?: number;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
}

export interface TracePromptEvent {
  conversationId: string;
  sessionId: string;
  turn: number;
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string;
    contentBlocks?: import('./base').ContentBlock[];
  }>;
  tools: ToolDefinition[];
}

export interface TraceThinkingEvent {
  conversationId: string;
  sessionId: string;
  turn: number;
}

export interface TurnTrace {
  turnNumber: number;
  sessionId: string;
  conversationId: string;
  assistantMessageId: string;
  startTime: number;
  endTime?: number;
  status: TurnTraceStatus;
  prompt?: {
    systemPrompt: string;
    messages: TracePromptEvent['messages'];
    tools: ToolDefinition[];
  };
  thinking: {
    content: string;
    startTime?: number;
    endTime?: number;
    status: TurnThinkingStatus;
  };
  response: {
    content: string;
    startTime?: number;
    endTime?: number;
  };
  tools: ToolTrace[];
  usage?: TokenUsage;
}

export interface ConversationTrace {
  conversationId: string | null;
  turns: TurnTrace[];
}

export type TraceDockingSide = 'left' | 'right';

export interface TraceDockingState {
  side: TraceDockingSide | null;
  attachedWidth: number;
  isDocked: boolean;
  alwaysOnTop: boolean;
  alwaysOnTopForced: boolean;
}

export interface TraceState {
  conversationId: string | null;
  sessionId: string | null;
  isPinned: boolean;
  docking: TraceDockingState;
  agentStatus: AgentStatus;
  setPinned: (isPinned: boolean) => void;
  setDocking: (docking: TraceDockingState) => void;
  reset: (conversationId?: string | null) => void;
  clearTurns: (conversationId: string) => void;
}
