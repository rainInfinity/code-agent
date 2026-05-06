export type ContentBlockType = 'text' | 'thinking' | 'tool_use' | 'tool_result';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
