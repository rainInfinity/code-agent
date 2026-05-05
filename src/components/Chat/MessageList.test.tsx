import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, test, beforeEach } from 'vitest';
import { MessageList } from './MessageList';
import { darkTheme } from '@/styles/theme';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Conversation, Message, TurnTrace } from '@/types';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const createMessage = (
  id: string,
  role: Message['role'],
  content: string,
  status: Message['status'] = 'complete',
): Message => ({
  id,
  role,
  content,
  contentBlocks: [{ type: 'text', text: content }],
  status,
  timestamp: Date.now(),
});

const createTurnTrace = (conversationId: string, turnNumber: number): TurnTrace => ({
  turnNumber,
  sessionId: `session-${conversationId}`,
  conversationId,
  startTime: Date.now(),
  endTime: Date.now(),
  status: 'complete',
  prompt: {
    systemPrompt: 'system',
    messages: [{ role: 'user', content: `user turn ${turnNumber}` }],
    tools: [],
  },
  thinking: {
    content: `thinking ${turnNumber}`,
    status: 'complete',
  },
  response: {
    content: `assistant turn ${turnNumber}`,
  },
});

const createConversation = (id: string, prefix: string, turnCount: number): Conversation => {
  const messages: Message[] = [];
  const turns: TurnTrace[] = [];

  for (let turnNumber = 1; turnNumber <= turnCount; turnNumber += 1) {
    messages.push(
      createMessage(`${id}-user-${turnNumber}`, 'user', `${prefix} user ${turnNumber}`),
      createMessage(
        `${id}-assistant-${turnNumber}`,
        'assistant',
        `${prefix} assistant ${turnNumber}`,
      ),
    );
    turns.push(createTurnTrace(id, turnNumber));
  }

  return {
    id,
    title: prefix,
    messages,
    turns,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

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
  useSettingsStore.setState({ theme: 'dark' });
});

describe('MessageList folding', () => {
  test('does not show a divider for short conversations', () => {
    const conversation = createConversation('short', 'short', 3);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.queryByText(/未渲染/)).toBeNull();
  });

  test('folds long conversations, loads more in batches, and can expand all', async () => {
    const user = userEvent.setup();
    const conversation = createConversation('long', 'long', 17);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText('以上 7 轮对话未渲染')).toBeTruthy();
    expect(screen.queryByText('long user 1')).toBeNull();
    expect(screen.getByText('long user 17')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '加载最近 5 轮' }));

    await waitFor(() => {
      expect(screen.getByText('以上 2 轮对话未渲染')).toBeTruthy();
    });
    expect(screen.getByText('long user 3')).toBeTruthy();
    expect(screen.queryByText('long user 2')).toBeNull();

    await user.click(screen.getByRole('button', { name: '展开全部' }));

    await waitFor(() => {
      expect(screen.queryByText(/未渲染/)).toBeNull();
    });
    expect(screen.getByText('long user 1')).toBeTruthy();
  });

  test('keeps fold state stable while streaming and resets on conversation switch', async () => {
    const longConversation = createConversation('stream', 'stream', 15);
    const otherConversation = createConversation('other', 'other', 15);
    useChatStore.setState({
      conversations: [longConversation, otherConversation],
      activeConversationId: longConversation.id,
    });

    const view = renderWithTheme(<MessageList conversationId={longConversation.id} />);

    expect(screen.getByText('以上 5 轮对话未渲染')).toBeTruthy();
    expect(screen.queryByText('stream user 1')).toBeNull();

    act(() => {
      useChatStore.setState((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === longConversation.id
            ? {
                ...conversation,
                messages: [
                  ...conversation.messages,
                  createMessage('stream-user-16', 'user', 'stream user 16'),
                  createMessage(
                    'stream-assistant-16',
                    'assistant',
                    'stream assistant 16',
                    'streaming',
                  ),
                ],
              }
            : conversation,
        ),
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('以上 6 轮对话未渲染')).toBeTruthy();
    });
    expect(screen.queryByText('stream user 1')).toBeNull();
    expect(screen.getByText('stream user 16')).toBeTruthy();

    expect(
      useChatStore.getState().conversations.find((conversation) => conversation.id === longConversation.id)
        ?.messages.length,
    ).toBe(32);

    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageList conversationId={otherConversation.id} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('以上 5 轮对话未渲染')).toBeTruthy();
    });
    expect(screen.queryByText('other user 1')).toBeNull();
    expect(screen.getByText('other user 15')).toBeTruthy();
  });
});
