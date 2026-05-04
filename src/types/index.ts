// ============================================================
// Core type definitions for Code Agent
// ============================================================

/** Role of a message participant */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Status of a message during streaming */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/** Agent operation mode */
export type AgentMode = 'chat' | 'code';
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result';
export type AgentStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'max_turns_reached' | 'error';

/** Working directory with its conversation management */
export interface WorkDir {
  path: string;
  name: string;
  addedAt: number;
}

/** A single message in a conversation */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  contentBlocks?: ContentBlock[];
  status: MessageStatus;
  timestamp: number;
  thinkingContent?: string;
  thinkingStartedAt?: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

/** A conversation consisting of messages */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  /** Working directory path — set when created in code mode */
  workDir?: string;
  traceEnabled?: boolean;
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
export type ProviderId = 'anthropic' | 'deepseek';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  chatPath: string;
  modelsPath: string;
  authHeaderName: string;
  authHeaderValuePrefix: string;
  apiKeyPrefix: string;
  apiKeyHelpKey: 'anthropic' | 'deepseek';
  extraHeaders?: Record<string, string>;
}

export interface ProviderSettings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>;
export type ProviderApiKeyConfiguredMap = Record<ProviderId, boolean>;

export interface Settings {
  activeProviderId: ProviderId;
  providers: ProviderSettingsMap;
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
  agentMode: AgentMode;
  workingDirectories: WorkDir[];
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

/** Thinking stream event payload */
export interface StreamThinkingEvent {
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

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface TracePromptEvent {
  conversationId: string;
  sessionId: string;
  turn: number;
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string;
    contentBlocks?: ContentBlock[];
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
  startTime: number;
  endTime?: number;
  status: 'running' | 'complete' | 'error';
  prompt?: {
    systemPrompt: string;
    messages: TracePromptEvent['messages'];
    tools: ToolDefinition[];
  };
  thinking: {
    content: string;
    startTime?: number;
    endTime?: number;
    status: 'idle' | 'streaming' | 'complete';
  };
  response: {
    content: string;
    startTime?: number;
    endTime?: number;
  };
}

export interface ConversationTrace {
  conversationId: string | null;
  turns: TurnTrace[];
}

export interface AgentTurnEvent {
  conversationId: string;
  sessionId: string;
  turnCount: number;
}

export interface AgentCompleteEvent {
  conversationId: string;
  sessionId: string;
  messageId: string;
  status: AgentStatus;
  reason: string;
}
