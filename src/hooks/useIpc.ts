// ============================================================
// IPC Layer — Type-safe wrappers around Tauri invoke / listen
// ============================================================
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  Conversation,
  ProviderId,
  ProviderSettingsMap,
  StreamEvent,
  StreamThinkingEvent,
  StreamEndEvent,
  StreamErrorEvent,
  ToolCallEvent,
  ToolResultEvent,
  ToolTraceEvent,
  TracePromptEvent,
  TraceThinkingEvent,
  TraceDockingSide,
  TraceDockingState,
  AgentTurnEvent,
  AgentCompleteEvent,
  AgentTurnCompleteEvent,
} from '@/types';

// ─── Commands (Frontend → Backend) ──────────────────────────

export interface SendMessagePayload {
  providerId: ProviderId;
  conversationId: string;
  assistantMessageId: string;
  agentType?: 'chat' | 'code';
  workDir?: string | null;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

export interface RunAgentPayload extends SendMessagePayload {
  maxTurns?: number;
}

/** Send a message to the LLM via Rust backend */
export async function sendMessage(payload: SendMessagePayload): Promise<void> {
  return invoke('send_message', { payload });
}

/** Stop the current streaming response */
export async function stopStreaming(conversationId: string): Promise<void> {
  return invoke('stop_streaming', { conversationId });
}

export async function runAgent(payload: RunAgentPayload): Promise<string> {
  return invoke('run_agent', { payload });
}

export async function stopAgent(sessionId: string): Promise<void> {
  return invoke('stop_agent', { sessionId });
}

export async function openTraceWindow(conversationId?: string): Promise<void> {
  return invoke('open_trace_window', { conversationId: conversationId ?? null });
}

export async function closeTraceWindow(): Promise<void> {
  return invoke('close_trace_window');
}

export async function hideTraceWindow(): Promise<void> {
  return invoke('hide_trace_window');
}

export async function isTraceWindowOpen(): Promise<boolean> {
  return invoke('is_trace_window_open');
}

export async function setTraceAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  return invoke('set_trace_always_on_top', { alwaysOnTop });
}

export async function getTraceDockingState(): Promise<TraceDockingState> {
  return invoke('get_trace_docking_state');
}

export async function setTraceDockingMode(
  side: TraceDockingSide | null,
): Promise<TraceDockingState> {
  return invoke('set_trace_docking_mode', { side });
}

export async function exitTraceDocking(): Promise<TraceDockingState> {
  return invoke('exit_trace_docking');
}

export async function syncTraceDockingWidth(width?: number): Promise<TraceDockingState> {
  return invoke('sync_trace_docking_width', { width: width ?? null });
}

export async function syncTraceDockingToMain(): Promise<TraceDockingState> {
  return invoke('sync_trace_docking_to_main');
}

export async function hideTraceForMainMinimize(): Promise<void> {
  return invoke('hide_trace_for_main_minimize');
}

/** Save settings to the Rust backend */
export async function saveSettings(settings: {
  providerId: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;
}): Promise<void> {
  return invoke('save_settings', { settings });
}

/** Load settings from the Rust backend */
export async function loadSettings(): Promise<{
  activeProviderId: ProviderId;
  providers: Record<ProviderId, Omit<ProviderSettingsMap[ProviderId], 'apiKey'> & { hasApiKey: boolean }>;
}> {
  return invoke('load_settings');
}

export interface ModelInfo {
  id: string;
  displayName: string;
  createdAt: string;
  modelType: string;
}

/** List available models for the configured Anthropic-compatible endpoint */
export async function listModels(payload: {
  providerId: ProviderId;
  apiKey: string;
  apiEndpoint: string;
}): Promise<ModelInfo[]> {
  return invoke('list_models', { payload });
}

// ─── Events (Backend → Frontend) ────────────────────────────

/** Listen for streaming tokens */
export async function onStreamDelta(
  callback: (event: StreamEvent) => void,
): Promise<UnlistenFn> {
  return listen<StreamEvent>('stream-delta', (e) => callback(e.payload));
}

/** Listen for streaming thinking tokens */
export async function onThinkingDelta(
  callback: (event: StreamThinkingEvent) => void,
): Promise<UnlistenFn> {
  return listen<StreamThinkingEvent>('thinking-delta', (e) => callback(e.payload));
}

/** Listen for stream completion */
export async function onStreamEnd(
  callback: (event: StreamEndEvent) => void,
): Promise<UnlistenFn> {
  return listen<StreamEndEvent>('stream-end', (e) => callback(e.payload));
}

/** Listen for stream errors */
export async function onStreamError(
  callback: (event: StreamErrorEvent) => void,
): Promise<UnlistenFn> {
  return listen<StreamErrorEvent>('stream-error', (e) => callback(e.payload));
}

export async function onToolCall(callback: (event: ToolCallEvent) => void): Promise<UnlistenFn> {
  return listen<ToolCallEvent>('tool-call', (e) => callback(e.payload));
}

export async function onToolResult(callback: (event: ToolResultEvent) => void): Promise<UnlistenFn> {
  return listen<ToolResultEvent>('tool-result', (e) => callback(e.payload));
}

export async function onToolTrace(callback: (event: ToolTraceEvent) => void): Promise<UnlistenFn> {
  return listen<ToolTraceEvent>('tool-trace', (e) => callback(e.payload));
}

export async function onTracePrompt(callback: (event: TracePromptEvent) => void): Promise<UnlistenFn> {
  return listen<TracePromptEvent>('trace-prompt', (e) => callback(e.payload));
}

export async function onTraceThinkingStart(
  callback: (event: TraceThinkingEvent) => void,
): Promise<UnlistenFn> {
  return listen<TraceThinkingEvent>('trace-thinking-start', (e) => callback(e.payload));
}

export async function onTraceThinkingEnd(
  callback: (event: TraceThinkingEvent) => void,
): Promise<UnlistenFn> {
  return listen<TraceThinkingEvent>('trace-thinking-end', (e) => callback(e.payload));
}

export async function onTraceWindowClosed(callback: () => void): Promise<UnlistenFn> {
  return listen('trace-window-closed', () => callback());
}

export async function onTraceDockingChanged(
  callback: (event: TraceDockingState) => void,
): Promise<UnlistenFn> {
  return listen<TraceDockingState>('trace-docking-changed', (e) => callback(e.payload));
}

export async function emitTraceConversationChanged(conversationId: string): Promise<void> {
  return emit('trace-conversation-changed', { conversationId });
}

export async function onTraceConversationChanged(
  callback: (event: { conversationId: string }) => void,
): Promise<UnlistenFn> {
  return listen<{ conversationId: string }>('trace-conversation-changed', (e) => callback(e.payload));
}

export async function emitTraceClearConversation(conversationId: string): Promise<void> {
  return emit('trace-clear-conversation', { conversationId });
}

export async function onTraceClearConversation(
  callback: (event: { conversationId: string }) => void,
): Promise<UnlistenFn> {
  return listen<{ conversationId: string }>('trace-clear-conversation', (e) => callback(e.payload));
}

export async function emitTracePinChanged(isPinned: boolean): Promise<void> {
  return emit('trace-pin-changed', { isPinned });
}

export async function onTracePinChanged(
  callback: (event: { isPinned: boolean }) => void,
): Promise<UnlistenFn> {
  return listen<{ isPinned: boolean }>('trace-pin-changed', (e) => callback(e.payload));
}

export async function emitTraceWindowReady(): Promise<void> {
  return emit('trace-window-ready', {});
}

export async function onTraceWindowReady(callback: () => void): Promise<UnlistenFn> {
  return listen('trace-window-ready', () => callback());
}

export async function emitTraceSyncConversations(conversations: Conversation[]): Promise<void> {
  return emit('trace-sync-conversations', { conversations });
}

export async function onTraceSyncConversations(
  callback: (event: { conversations: Conversation[] }) => void,
): Promise<UnlistenFn> {
  return listen<{ conversations: Conversation[] }>('trace-sync-conversations', (e) => callback(e.payload));
}

export async function emitThemeChanged(theme: 'dark' | 'light'): Promise<void> {
  return emit('theme-changed', { theme });
}

export async function onThemeChanged(
  callback: (event: { theme: 'dark' | 'light' }) => void,
): Promise<UnlistenFn> {
  return listen<{ theme: 'dark' | 'light' }>('theme-changed', (e) => callback(e.payload));
}

export async function onAgentTurn(callback: (event: AgentTurnEvent) => void): Promise<UnlistenFn> {
  return listen<AgentTurnEvent>('agent-turn', (e) => callback(e.payload));
}

export async function onAgentComplete(
  callback: (event: AgentCompleteEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentCompleteEvent>('agent-complete', (e) => callback(e.payload));
}

export async function onAgentTurnComplete(
  callback: (event: AgentTurnCompleteEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentTurnCompleteEvent>('agent-turn-complete', (e) => callback(e.payload));
}
