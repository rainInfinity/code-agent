import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MessageList } from '@/components/Chat/MessageList';
import { TracePanel } from './TracePanel';
import { messages as appMessages } from '@/i18n';
import { darkTheme } from '@/styles/theme';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import type { Conversation, Message, TurnTrace } from '@/types';

const ipcMocks = vi.hoisted(() => ({
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
}));

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
  emitTraceClearConversation: ipcMocks.emitTraceClearConversation,
  emitTracePinChanged: ipcMocks.emitTracePinChanged,
  hideTraceWindow: ipcMocks.hideTraceWindow,
  setTraceDockingMode: ipcMocks.setTraceDockingMode,
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
  assistantMessageId: `${conversationId}-assistant-${turnNumber}`,
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
  tools: [],
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
    isAlwaysOnTop: false,
  });
  useTraceStore.setState({
    conversationId: null,
    sessionId: null,
    isPinned: false,
    docking: {
      side: null,
      attachedWidth: 420,
      isDocked: false,
      alwaysOnTop: false,
      alwaysOnTopForced: false,
    },
    agentStatus: 'idle',
  });
  ipcMocks.emitTraceClearConversation.mockClear();
  ipcMocks.emitTracePinChanged.mockClear();
  ipcMocks.hideTraceWindow.mockClear();
  ipcMocks.setTraceDockingMode.mockClear();
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
      expect(screen.getByText(appMessages.fold.divider.title(12))).toBeTruthy();
    });
    expect(screen.queryByText(appMessages.trace.turn(1))).toBeNull();
    expect(screen.getByText(appMessages.trace.turn(17))).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: appMessages.fold.divider.loadMore(5),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText(appMessages.trace.turn(8))).toBeTruthy();
    expect(screen.queryByText(appMessages.trace.turn(7))).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: appMessages.fold.divider.expandAll,
        }),
      ).toBeNull();
    });
    expect(screen.getByText(appMessages.trace.turn(1))).toBeTruthy();
  });

  test('restores remembered trace fold state when switching conversations', async () => {
    const user = userEvent.setup();
    const conversation = createConversation('trace-remembered', 17);
    const otherConversation = createConversation('trace-other', 15);
    useChatStore.setState({
      conversations: [conversation, otherConversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'complete',
    });

    renderWithTheme(<TracePanel />);

    await user.click(
      screen.getByRole('button', {
        name: appMessages.fold.divider.loadMore(5),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText(appMessages.trace.turn(8))).toBeTruthy();
    expect(screen.queryByText(appMessages.trace.turn(7))).toBeNull();

    useTraceStore.setState({
      conversationId: otherConversation.id,
      agentStatus: 'complete',
    });

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    });
    expect(screen.queryByText(appMessages.trace.turn(1))).toBeNull();
    expect(screen.getByText(appMessages.trace.turn(15))).toBeTruthy();

    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'complete',
    });

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText(appMessages.trace.turn(8))).toBeTruthy();
    expect(screen.queryByText(appMessages.trace.turn(7))).toBeNull();
  });

  test('keeps the folded trace boundary stable while new turns arrive', async () => {
    const conversation = createConversation('trace-stream', 15);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'running',
    });

    renderWithTheme(<TracePanel />);

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    });
    expect(screen.queryByText(appMessages.trace.turn(1))).toBeNull();
    expect(screen.getByText(appMessages.trace.turn(11))).toBeTruthy();

    act(() => {
      useChatStore.setState((state) => ({
        conversations: state.conversations.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                turns: [
                  ...item.turns,
                  {
                    ...createTurn(conversation.id, 16),
                    status: 'running',
                  },
                ],
              }
            : item,
        ),
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    });
    expect(screen.queryByText(appMessages.trace.turn(1))).toBeNull();
    expect(screen.getByText(appMessages.trace.turn(11))).toBeTruthy();
    expect(screen.getByText(appMessages.trace.turn(16))).toBeTruthy();
  });

  test('does not auto-fold a trace when running updates cross the threshold later', async () => {
    const conversation = createConversation('trace-threshold', 4);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'running',
    });

    renderWithTheme(<TracePanel />);

    await waitFor(() => {
      expect(screen.getByText(appMessages.trace.turn(1))).toBeTruthy();
    });
    expect(
      screen.queryByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    ).toBeNull();

    act(() => {
      useChatStore.setState((state) => ({
        conversations: state.conversations.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                turns: [
                  ...item.turns,
                  createTurn(conversation.id, 5),
                  {
                    ...createTurn(conversation.id, 6),
                    status: 'running',
                  },
                ],
              }
            : item,
        ),
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(appMessages.trace.turn(6))).toBeTruthy();
    });
    expect(screen.getByText(appMessages.trace.turn(1))).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    ).toBeNull();
  });

  test('keeps main chat and trace views aligned on the same turn completion state', () => {
    const assistantMessageId = 'shared-assistant';
    const conversation: Conversation = {
      id: 'shared-conversation',
      title: 'shared-conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        createMessage('shared-user', 'user', 'Check status'),
        {
          id: assistantMessageId,
          role: 'assistant',
          content: 'Done.',
          contentBlocks: [],
          status: 'complete',
          timestamp: Date.now(),
        },
      ],
      turns: [
        {
          turnNumber: 1,
          sessionId: 'session-shared-conversation',
          conversationId: 'shared-conversation',
          assistantMessageId,
          startTime: 1_000,
          endTime: 2_000,
          status: 'complete',
          prompt: {
            systemPrompt: 'system',
            messages: [{ role: 'user', content: 'Check status' }],
            tools: [],
          },
          thinking: {
            content: 'reasoning',
            startTime: 1_000,
            endTime: 1_500,
            status: 'complete',
          },
          response: {
            content: 'Done.',
            startTime: 1_600,
            endTime: 2_000,
          },
          tools: [],
        },
      ],
    };

    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      sessionId: 'session-shared-conversation',
      agentStatus: 'complete',
    });

    renderWithTheme(
      <>
        <MessageList conversationId={conversation.id} />
        <TracePanel />
      </>,
    );

    expect(screen.getByText(appMessages.messages.thinkingComplete)).toBeTruthy();
    expect(
      screen.getAllByText(appMessages.trace.turnStatus.complete).length,
    ).toBeGreaterThan(0);
  });

  test('toggles pin state without coupling it to always-on-top', async () => {
    const user = userEvent.setup();
    const conversation = createConversation('trace-pin', 1);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });
    useTraceStore.setState({
      conversationId: conversation.id,
      agentStatus: 'complete',
    });

    renderWithTheme(<TracePanel />);

    await user.click(
      screen.getByRole('button', {
        name: appMessages.trace.pinTooltip,
      }),
    );

    expect(useChatStore.getState().isTracePinned).toBe(true);
    expect(ipcMocks.emitTracePinChanged).toHaveBeenCalledWith(true);
  });
});
