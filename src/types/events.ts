import type { AgentStatus, ToolDefinition, ToolTracePhase } from './trace';

export type { ToolDefinition };

export interface StreamEvent {
  conversationId: string;
  delta: string;
  messageId: string;
}

export interface StreamThinkingEvent {
  conversationId: string;
  delta: string;
  messageId: string;
}

export interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StreamErrorEvent {
  conversationId: string;
  messageId: string;
  error: string;
}

export interface ToolCallEvent {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  result: {
    success: boolean;
    output: string;
    error?: string;
  };
}

export interface ToolTraceEvent {
  conversationId: string;
  sessionId: string;
  turn: number;
  messageId: string;
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  phase: ToolTracePhase;
  logicalIndex: number;
  batchId?: number;
  batchIndex?: number;
  isConcurrent?: boolean;
  result?: {
    success: boolean;
    output: string;
    error?: string;
  };
  timestampMs: number;
}

export interface AgentTurnEvent {
  conversationId: string;
  sessionId: string;
  turnCount: number;
  assistantMessageId: string;
}

export interface AgentCompleteEvent {
  conversationId: string;
  sessionId: string;
  messageId: string;
  status: AgentStatus;
  reason: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AgentTurnCompleteEvent {
  conversationId: string;
  sessionId: string;
  turnCount: number;
  status: AgentStatus;
  reason: string;
  inputTokens: number;
  outputTokens: number;
}
