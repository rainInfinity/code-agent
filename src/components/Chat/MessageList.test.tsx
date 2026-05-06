import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, test } from 'vitest';
import { MessageList } from './MessageList';
import { messages as appMessages } from '@/i18n';
import { darkTheme } from '@/styles/theme';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTraceStore } from '@/stores/traceStore';
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
  tools: [],
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
  test('renders tool blocks before the final text when contentBlocks lead with tool_use', () => {
    const conversation: Conversation = {
      id: 'tool-order',
      title: 'tool-order',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: [],
      messages: [
        createMessage('tool-order-user', 'user', 'Run a tool'),
        {
          id: 'tool-order-assistant',
          role: 'assistant',
          content: 'I found the workspace.',
          contentBlocks: [
            { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
            { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace', isError: false },
            { type: 'text', text: 'I found the workspace.' },
          ],
          status: 'complete',
          timestamp: Date.now(),
          toolTraces: [
            {
              toolCallId: 'tool-1',
              name: 'shell',
              input: { command: 'pwd' },
              logicalIndex: 1,
              status: 'completed',
              output: '/workspace',
            },
          ],
          toolCalls: [{ id: 'tool-1', name: 'shell', input: { command: 'pwd' } }],
          toolResults: [{ toolCallId: 'tool-1', success: true, output: '/workspace' }],
        },
      ],
    };

    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    const toolLabel = screen.getByText('shell');
    const responseText = screen.getByText('I found the workspace.');

    expect(
      toolLabel.compareDocumentPosition(responseText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('shows Running status for active tool calls in the chat timeline', () => {
    const conversation: Conversation = {
      id: 'tool-running',
      title: 'tool-running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: [],
      messages: [
        createMessage('tool-running-user', 'user', 'Run a tool'),
        {
          id: 'tool-running-assistant',
          role: 'assistant',
          content: '',
          contentBlocks: [
            { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
          ],
          status: 'streaming',
          timestamp: Date.now(),
          toolTraces: [
            {
              toolCallId: 'tool-1',
              name: 'shell',
              input: { command: 'pwd' },
              logicalIndex: 1,
              status: 'requested',
            },
          ],
        },
      ],
    };

    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('shell')).toBeTruthy();
  });

  test('keeps previously rendered blocks visible when the message ends in error', () => {
    const conversation: Conversation = {
      id: 'tool-error',
      title: 'tool-error',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: [],
      messages: [
        createMessage('tool-error-user', 'user', 'Run a tool'),
        {
          id: 'tool-error-assistant',
          role: 'assistant',
          content: 'API error (400 Bad Request)',
          contentBlocks: [
            { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
            { type: 'text', text: 'Partial answer before the failure.' },
          ],
          status: 'error',
          timestamp: Date.now(),
          toolTraces: [
            {
              toolCallId: 'tool-1',
              name: 'shell',
              input: { command: 'pwd' },
              logicalIndex: 1,
              status: 'requested',
            },
          ],
        },
      ],
    };

    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText('shell')).toBeTruthy();
    expect(screen.getByText('Partial answer before the failure.')).toBeTruthy();
    expect(screen.getByText('API error (400 Bad Request)')).toBeTruthy();
  });

  test('does not show fold controls for short conversations', () => {
    const conversation = createConversation('short', 'short', 3);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(
      screen.queryByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    ).toBeNull();
  });

  test('folds long conversations, loads more in batches, and can expand all', async () => {
    const user = userEvent.setup();
    const conversation = createConversation('long', 'long', 17);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText(appMessages.fold.divider.title(12))).toBeTruthy();
    expect(screen.queryByText('long user 1')).toBeNull();
    expect(screen.getByText('long user 17')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: appMessages.fold.divider.loadMore(5),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText('long user 8')).toBeTruthy();
    expect(screen.queryByText('long user 7')).toBeNull();

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
    expect(screen.getByText('long user 1')).toBeTruthy();
  });

  test('restores remembered fold state when switching away and back', async () => {
    const user = userEvent.setup();
    const rememberedConversation = createConversation('remembered', 'remembered', 17);
    const otherConversation = createConversation('other', 'other', 15);
    useChatStore.setState({
      conversations: [rememberedConversation, otherConversation],
      activeConversationId: rememberedConversation.id,
    });

    const view = renderWithTheme(
      <MessageList conversationId={rememberedConversation.id} />,
    );

    await user.click(
      screen.getByRole('button', {
        name: appMessages.fold.divider.loadMore(5),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText('remembered user 8')).toBeTruthy();
    expect(screen.queryByText('remembered user 7')).toBeNull();

    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageList conversationId={otherConversation.id} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    });
    expect(screen.queryByText('other user 1')).toBeNull();
    expect(screen.getByText('other user 15')).toBeTruthy();

    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageList conversationId={rememberedConversation.id} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(7))).toBeTruthy();
    });
    expect(screen.getByText('remembered user 8')).toBeTruthy();
    expect(screen.queryByText('remembered user 7')).toBeNull();

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
    expect(screen.getByText('remembered user 1')).toBeTruthy();

    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageList conversationId={otherConversation.id} />
      </ThemeProvider>,
    );
    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageList conversationId={rememberedConversation.id} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('remembered user 1')).toBeTruthy();
    });
    expect(
      screen.queryByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    ).toBeNull();
  });

  test('keeps the folded boundary stable while streaming inside an already folded conversation', async () => {
    const conversation = createConversation('stream', 'stream', 15);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    expect(screen.queryByText('stream user 1')).toBeNull();
    expect(screen.getByText('stream user 11')).toBeTruthy();

    act(() => {
      useChatStore.setState((state) => ({
        conversations: state.conversations.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  createMessage('stream-user-16', 'user', 'stream user 16'),
                  createMessage(
                    'stream-assistant-16',
                    'assistant',
                    'stream assistant 16',
                    'streaming',
                  ),
                ],
              }
            : item,
        ),
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(appMessages.fold.divider.title(10))).toBeTruthy();
    });
    expect(screen.queryByText('stream user 1')).toBeNull();
    expect(screen.getByText('stream user 11')).toBeTruthy();
    expect(screen.getByText('stream user 16')).toBeTruthy();
  });

  test('does not auto-fold when streaming crosses the threshold after first load', async () => {
    const conversation = createConversation('threshold', 'threshold', 4);
    useChatStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
    });

    renderWithTheme(<MessageList conversationId={conversation.id} />);

    expect(screen.getByText('threshold user 1')).toBeTruthy();
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
                messages: [
                  ...item.messages,
                  createMessage('threshold-user-5', 'user', 'threshold user 5'),
                  createMessage(
                    'threshold-assistant-5',
                    'assistant',
                    'threshold assistant 5',
                  ),
                  createMessage('threshold-user-6', 'user', 'threshold user 6'),
                  createMessage(
                    'threshold-assistant-6',
                    'assistant',
                    'threshold assistant 6',
                    'streaming',
                  ),
                ],
              }
            : item,
        ),
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('threshold user 6')).toBeTruthy();
    });
    expect(screen.getByText('threshold user 1')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: appMessages.fold.divider.expandAll,
      }),
    ).toBeNull();
  });
});
