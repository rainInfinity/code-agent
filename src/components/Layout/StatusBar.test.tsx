import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { StatusBar } from './StatusBar';
import { darkTheme } from '@/styles/theme';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Conversation } from '@/types';

const ipcMocks = vi.hoisted(() => ({
  emitTraceConversationChanged: vi.fn().mockResolvedValue(undefined),
  emitTraceSyncConversations: vi.fn().mockResolvedValue(undefined),
  hideTraceWindow: vi.fn().mockResolvedValue(undefined),
  isTraceWindowOpen: vi.fn<() => Promise<boolean>>(),
  onTraceClearConversation: vi.fn().mockResolvedValue(() => {}),
  onTraceDockingChanged: vi.fn().mockResolvedValue(() => {}),
  onTracePinChanged: vi.fn().mockResolvedValue(() => {}),
  onTraceWindowClosed: vi.fn().mockResolvedValue(() => {}),
  onTraceWindowReady: vi.fn().mockResolvedValue(() => {}),
  openTraceWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/useIpc', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useIpc')>(
    '@/hooks/useIpc',
  );

  return {
    ...actual,
    emitTraceConversationChanged: ipcMocks.emitTraceConversationChanged,
    emitTraceSyncConversations: ipcMocks.emitTraceSyncConversations,
    hideTraceWindow: ipcMocks.hideTraceWindow,
    isTraceWindowOpen: ipcMocks.isTraceWindowOpen,
    onTraceClearConversation: ipcMocks.onTraceClearConversation,
    onTraceDockingChanged: ipcMocks.onTraceDockingChanged,
    onTracePinChanged: ipcMocks.onTracePinChanged,
    onTraceWindowClosed: ipcMocks.onTraceWindowClosed,
    onTraceWindowReady: ipcMocks.onTraceWindowReady,
    openTraceWindow: ipcMocks.openTraceWindow,
  };
});

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const createConversation = (id: string): Conversation => ({
  id,
  title: id,
  messages: [],
  turns: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('StatusBar trace visibility', () => {
  beforeEach(() => {
    ipcMocks.emitTraceConversationChanged.mockClear();
    ipcMocks.emitTraceSyncConversations.mockClear();
    ipcMocks.hideTraceWindow.mockClear();
    ipcMocks.isTraceWindowOpen.mockReset();
    ipcMocks.onTraceClearConversation.mockClear();
    ipcMocks.onTraceDockingChanged.mockClear();
    ipcMocks.onTracePinChanged.mockClear();
    ipcMocks.onTraceWindowClosed.mockClear();
    ipcMocks.onTraceWindowReady.mockClear();
    ipcMocks.openTraceWindow.mockClear();

    useSettingsStore.setState({
      activeProviderId: 'anthropic',
      activeProviderSettings: useSettingsStore.getState().providers.anthropic,
      activeProviderDefinition: useSettingsStore.getState().activeProviderDefinition,
    });

    useChatStore.setState({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      streamingMessageId: null,
      selectedWorkDir: null,
      isTraceOpen: false,
      isTracePinned: false,
      isTraceDocked: false,
      isAlwaysOnTop: false,
    });
  });

  test('keeps Trace window open across conversation switches only when trace and pin are both enabled', async () => {
    const conversationA = createConversation('conversation-a');
    const conversationB = createConversation('conversation-b');
    ipcMocks.isTraceWindowOpen.mockResolvedValue(true);

    useChatStore.setState({
      conversations: [conversationA, conversationB],
      activeConversationId: conversationA.id,
      isTraceOpen: true,
      isTracePinned: true,
    });

    renderWithTheme(<StatusBar />);

    await waitFor(() => {
      expect(ipcMocks.emitTraceConversationChanged).toHaveBeenCalledWith(
        conversationA.id,
      );
    });

    act(() => {
      useChatStore.getState().setActiveConversation(conversationB.id);
    });

    await waitFor(() => {
      expect(ipcMocks.emitTraceConversationChanged).toHaveBeenLastCalledWith(
        conversationB.id,
      );
    });
    expect(ipcMocks.hideTraceWindow).not.toHaveBeenCalled();
    expect(useChatStore.getState().isTraceOpen).toBe(true);
  });

  test('closes Trace window and clears the global Trace state when pin is off during a conversation switch', async () => {
    const conversationA = createConversation('conversation-a');
    const conversationB = createConversation('conversation-b');
    ipcMocks.isTraceWindowOpen.mockResolvedValue(true);

    useChatStore.setState({
      conversations: [conversationA, conversationB],
      activeConversationId: conversationA.id,
      isTraceOpen: true,
      isTracePinned: false,
    });

    renderWithTheme(<StatusBar />);

    await waitFor(() => {
      expect(ipcMocks.emitTraceConversationChanged).toHaveBeenCalledWith(
        conversationA.id,
      );
    });

    act(() => {
      useChatStore.getState().setActiveConversation(conversationB.id);
    });

    await waitFor(() => {
      expect(ipcMocks.hideTraceWindow).toHaveBeenCalled();
    });
    expect(useChatStore.getState().isTraceOpen).toBe(false);
  });
});
