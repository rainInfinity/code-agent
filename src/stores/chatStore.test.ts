import { describe, expect, test } from 'vitest';
import type { Conversation, Message } from '@/types';
import { normalizePersistedConversations } from './chatStore';

const createConversation = (message: Message): Conversation => ({
  id: 'conversation-1',
  title: 'Conversation 1',
  messages: [message],
  turns: [],
  createdAt: 1,
  updatedAt: 1,
});

describe('normalizePersistedConversations', () => {
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
});
