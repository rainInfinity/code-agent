// ============================================================
// IPC Layer — Type-safe wrappers around Tauri invoke / listen
// ============================================================
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { StreamEvent, StreamEndEvent, StreamErrorEvent } from '@/types';

// ─── Commands (Frontend → Backend) ──────────────────────────

export interface SendMessagePayload {
  conversationId: string;
  assistantMessageId: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

/** Send a message to the LLM via Rust backend */
export async function sendMessage(payload: SendMessagePayload): Promise<void> {
  return invoke('send_message', { payload });
}

/** Stop the current streaming response */
export async function stopStreaming(conversationId: string): Promise<void> {
  return invoke('stop_streaming', { conversationId });
}

/** Save settings to the Rust backend */
export async function saveSettings(settings: {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}): Promise<void> {
  return invoke('save_settings', { settings });
}

/** Load settings from the Rust backend */
export async function loadSettings(): Promise<{
  apiEndpoint: string;
  model: string;
  hasApiKey: boolean;
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
