import { beforeEach, describe, expect, test } from 'vitest';
import type { Conversation, Message, TurnTrace } from '@/types';
import {
  CHAT_HISTORY_STORAGE_KEY,
  normalizePersistedConversations,
  useChatStore,
} from './chatStore';

const createConversation = (message: Message): Conversation => ({
  id: 'conversation-1',
  title: 'Conversation 1',
  messages: [message],
  turns: [],
  createdAt: 1,
  updatedAt: 1,
});

const createTurn = (): TurnTrace => ({
  turnNumber: 1,
  sessionId: 'session-1',
  conversationId: 'conversation-1',
  assistantMessageId: 'assistant-1',
  startTime: 1,
  endTime: 2,
  status: 'complete',
  thinking: {
    content: '',
    status: 'idle',
  },
  response: {
    content: 'Done',
  },
  tools: [],
});

describe('normalizePersistedConversations', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatStore.setState({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      streamingMessageId: null,
      selectedWorkDir: null,
      isTracePinned: false,
      isTraceDocked: false,
      isAlwaysOnTop: false,
    });
  });

  test('migrates legacy assistant messages into ordered content blocks', () => {
    const message: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Final answer',
      contentBlocks: [{ type: 'text', text: 'Final answer' }],
      status: 'complete',
      timestamp: 1,
      thinkingContent: 'reasoning',
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
    };

    const [conversation] = normalizePersistedConversations([
      createConversation(message),
    ]);

    expect(conversation.messages[0].contentBlocks).toEqual([
      { type: 'thinking', thinking: 'reasoning' },
      { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
      { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace', isError: false },
      { type: 'text', text: 'Final answer' },
    ]);
  });

  test('does not remigrate messages that already contain non-text content blocks', () => {
    const contentBlocks: NonNullable<Message['contentBlocks']> = [
      { type: 'thinking', thinking: 'reasoning' },
      { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
      { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace', isError: false },
      { type: 'text', text: 'Final answer' },
    ];

    const message: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Final answer',
      contentBlocks,
      status: 'complete',
      timestamp: 1,
      thinkingContent: 'reasoning',
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
    };

    const [conversation] = normalizePersistedConversations([
      createConversation(message),
    ]);

    expect(conversation.messages[0].contentBlocks).toEqual(contentBlocks);
  });

  test('creates a fallback assistant turn for legacy conversations without turn metadata', () => {
    const message: Message = {
      id: 'assistant-legacy',
      role: 'assistant',
      content: 'Final answer',
      contentBlocks: [
        { type: 'thinking', thinking: 'reasoning' },
        { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
        { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace', isError: false },
        { type: 'text', text: 'Final answer' },
      ],
      status: 'complete',
      timestamp: 1,
    };

    const [conversation] = normalizePersistedConversations([
      createConversation(message),
    ]);

    expect(conversation.turns).toHaveLength(1);
    expect(conversation.turns[0]).toMatchObject({
      assistantMessageId: 'assistant-legacy',
      thinking: {
        content: 'reasoning',
        status: 'complete',
      },
      response: {
        content: 'Final answer',
      },
      tools: [
        {
          toolCallId: 'tool-1',
          name: 'shell',
          status: 'completed',
          output: '/workspace',
        },
      ],
    });
  });

  test('keeps cleared turns empty across persistence rehydration', () => {
    const message: Message = {
      id: 'assistant-cleared',
      role: 'assistant',
      content: 'Final answer',
      contentBlocks: [{ type: 'text', text: 'Final answer' }],
      status: 'complete',
      timestamp: 1,
    };

    const [conversation] = normalizePersistedConversations([
      {
        ...createConversation(message),
        turnsCleared: true,
      },
    ]);

    expect(conversation.turns).toEqual([]);
    expect(conversation.turnsCleared).toBe(true);
  });

  test('marks turns as cleared and resets the flag when a new turn arrives', () => {
    const message: Message = {
      id: 'assistant-live',
      role: 'assistant',
      content: 'Answer',
      contentBlocks: [{ type: 'text', text: 'Answer' }],
      status: 'complete',
      timestamp: 1,
    };

    useChatStore.setState({
      conversations: [createConversation(message)],
      activeConversationId: 'conversation-1',
    });

    useChatStore.getState().clearConversationTurns('conversation-1');
    expect(useChatStore.getState().conversations[0]).toMatchObject({
      turns: [],
      turnsCleared: true,
    });

    useChatStore.getState().appendTurn('conversation-1', createTurn());
    expect(useChatStore.getState().conversations[0]).toMatchObject({
      turnsCleared: false,
    });
  });

  test('persists selected work directory across app restarts', () => {
    const selectedWorkDir = 'F:\\project\\ai-test';

    useChatStore.getState().setSelectedWorkDir(selectedWorkDir);

    const persistedRaw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    expect(persistedRaw).toBeTruthy();

    const persisted = JSON.parse(persistedRaw ?? '{}') as {
      state?: { selectedWorkDir?: string | null };
    };
    expect(persisted.state?.selectedWorkDir).toBe(selectedWorkDir);

    const merge = (useChatStore as typeof useChatStore & {
      persist: {
        getOptions: () => {
          merge?: unknown;
        };
      };
    }).persist.getOptions().merge as
      | ((persisted: unknown, current: unknown) => unknown)
      | undefined;

    expect(merge).toBeTypeOf('function');

    const merged = merge!(
      { selectedWorkDir },
      {
        selectedWorkDir: null,
        conversations: [],
        activeConversationId: null,
        isStreaming: false,
        streamingMessageId: null,
        isTracePinned: false,
        isTraceDocked: false,
        isAlwaysOnTop: false,
      },
    ) as { selectedWorkDir: string | null };

    expect(merged.selectedWorkDir).toBe(selectedWorkDir);
  });
});
