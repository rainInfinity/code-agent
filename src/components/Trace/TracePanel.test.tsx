import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TracePanel } from './TracePanel';
import { darkTheme } from '@/styles/theme';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import type { Conversation, Message, TurnTrace } from '@/types';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isMaximized: vi.fn().mockResolvedValue(false),
    onResized: vi.fn().mockResolvedValue(() => {}),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    startDragging: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useTraceIpc', () => ({
  useTraceIpc: () => {},
}));

vi.mock('@/hooks/useIpc', () => ({
  emitTraceClearConversation: vi.fn().mockResolvedValue(undefined),
  emitTracePinChanged: vi.fn().mockResolvedValue(undefined),
  hideTraceWindow: vi.fn().mockResolvedValue(undefined),
  setTraceDockingMode: vi.fn().mockResolvedValue({
    side: null,
    attachedWidth: 420,
    isDocked: false,
    alwaysOnTop: false,
    alwaysOnTopForced: false,
  }),
  setTraceAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
}));

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const createMessage = (
  id: string,
  role: Message['role'],
  content: string,
): Message => ({
  id,
  role,
  content,
  contentBlocks: [{ type: 'text', text: content }],
  status: 'complete',
  timestamp: Date.now(),
});

const createTurn = (conversationId: string, turnNumber: number): TurnTrace => ({
  turnNumber,
  sessionId: `session-${conversationId}`,
  conversationId,
  startTime: Date.now(),
  endTime: Date.now(),
  status: 'complete',
  prompt: {
    systemPrompt: `system ${turnNumber}`,
    messages: [{ role: 'user', content: `trace prompt ${turnNumber}` }],
    tools: [],
  },
  thinking: {
    content: `trace thinking ${turnNumber}`,
    status: 'complete',
  },
  response: {
    content: `trace response ${turnNumber}`,
  },
});

const createConversation = (id: string, turnCount: number): Conversation => ({
  id,
  title: id,
  messages: Array.from({ length: turnCount }, (_, index) =>
    createMessage(`${id}-message-${index + 1}`, 'user', `${id} message ${index + 1}`),
  ),
  turns: Array.from({ length: turnCount }, (_, index) => createTurn(id, index + 1)),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

beforeEach(() => {
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    isStreaming: false,
    streamingMessageId: null,
    selectedWorkDir: null,
    isTracePinned: false,
  });
  useTraceStore.setState({
    conversationId: null,
    sessionId: null,
    isPinned: false,
    alwaysOnTop: false,
    docking: {
      side: null,
      attachedWidth: 420,
      isDocked: false,
      alwaysOnTop: false,
      alwaysOnTopForced: false,
    },
    agentStatus: 'idle',
  });
});

describe('TracePanel folding', () => {
  test('matches chat folding behavior for long traces', async () => {
    const user = userEvent.setup();
    const conversation = createConversation('trace-conversation', 17);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'complete',
    });

    renderWithTheme(<TracePanel />);

    await waitFor(() => {
      expect(screen.getByText('以上 7 轮对话未渲染')).toBeTruthy();
    });
    expect(screen.queryByText('Turn 1')).toBeNull();
    expect(screen.getByText('Turn 17')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '加载最近 5 轮' }));

    await waitFor(() => {
      expect(screen.getByText('以上 2 轮对话未渲染')).toBeTruthy();
    });
    expect(screen.getByText('Turn 3')).toBeTruthy();
    expect(screen.queryByText('Turn 2')).toBeNull();

    await user.click(screen.getByRole('button', { name: '展开全部' }));

    await waitFor(() => {
      expect(screen.queryByText(/未渲染/)).toBeNull();
    });
    expect(screen.getByText('Turn 1')).toBeTruthy();
  });
});
