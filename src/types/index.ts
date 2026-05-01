// ============================================================
// Core type definitions for Code Agent
// ============================================================

/** Role of a message participant */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Status of a message during streaming */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/** A single message in a conversation */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

/** A conversation consisting of messages */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/** Tool call request from the LLM */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Result of a tool execution */
export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
  error?: string;
}

/** Application settings */
export interface Settings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
}

/** Chat state for Zustand store */
export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
}

/** LLM stream event payload from Rust backend */
export interface StreamEvent {
  conversationId: string;
  delta: string;
  messageId: string;
}

/** Stream end event payload */
export interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
}

/** Stream error event payload */
export interface StreamErrorEvent {
  conversationId: string;
  messageId: string;
  error: string;
}
