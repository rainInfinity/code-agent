import type { ContentBlock } from './base';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

export type AgentMode = 'chat' | 'code';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  contentBlocks?: ContentBlock[];
  status: MessageStatus;
  timestamp: number;
  usage?: import('./base').TokenUsage;
  thinkingContent?: string;
  thinkingStartedAt?: number;
  toolTraces?: import('./trace').ToolTrace[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}
