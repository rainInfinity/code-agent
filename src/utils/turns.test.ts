import { describe, expect, test } from 'vitest';
import type { Message, TurnTrace } from '@/types';
import {
  buildProviderTranscript,
  normalizeConversationTurns,
} from './turns';

const createMessage = (
  id: string,
  role: Message['role'],
  content: string,
  status: Message['status'] = 'complete',
): Message => ({
  id,
  role,
  content,
  contentBlocks: content
    ? [{ type: 'text', text: content }]
    : [],
  status,
  timestamp: 1,
});

describe('turns', () => {
  test('builds provider history with tool_result adjacency across turns', () => {
    const assistantMessageId = 'assistant-1';
    const messages: Message[] = [
      createMessage('user-1', 'user', 'Find the workspace'),
      createMessage(assistantMessageId, 'assistant', 'The workspace is ready.'),
    ];

    const turns: TurnTrace[] = [
      {
        turnNumber: 1,
        sessionId: 'session-1',
        conversationId: 'conversation-1',
        assistantMessageId,
        startTime: 10,
        endTime: 20,
        status: 'complete',
        thinking: {
          content: 'Inspecting files',
          startTime: 10,
          endTime: 11,
          status: 'complete',
        },
        response: {
          content: '',
          startTime: 12,
          endTime: 20,
        },
        tools: [
          {
            toolCallId: 'tool-1',
            name: 'shell',
            input: { command: 'pwd' },
            logicalIndex: 1,
            status: 'completed',
            output: '/workspace',
          },
        ],
      },
      {
        turnNumber: 2,
        sessionId: 'session-1',
        conversationId: 'conversation-1',
        assistantMessageId,
        startTime: 21,
        endTime: 30,
        status: 'complete',
        thinking: {
          content: 'Summarizing result',
          startTime: 21,
          endTime: 22,
          status: 'complete',
        },
        response: {
          content: 'The workspace is ready.',
          startTime: 23,
          endTime: 30,
        },
        tools: [],
      },
    ];

    const transcript = buildProviderTranscript(messages, turns);

    expect(transcript).toHaveLength(4);
    expect(transcript[1]).toMatchObject({
      role: 'assistant',
      content: '',
      contentBlocks: [
        { type: 'thinking', thinking: 'Inspecting files' },
        { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
      ],
    });
    expect(transcript[2]).toMatchObject({
      role: 'user',
      content: '',
      contentBlocks: [
        { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace', isError: false },
      ],
    });
    expect(transcript[3]).toMatchObject({
      role: 'assistant',
      content: 'The workspace is ready.',
      contentBlocks: [
        { type: 'thinking', thinking: 'Summarizing result' },
        { type: 'text', text: 'The workspace is ready.' },
      ],
    });
  });

  test('normalizes legacy assistant messages into fallback turns', () => {
    const assistantMessage: Message = {
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
      timestamp: 10,
    };

    const normalizedTurns = normalizeConversationTurns(
      'conversation-1',
      [createMessage('user-1', 'user', 'Inspect the workspace'), assistantMessage],
      [],
    );

    expect(normalizedTurns).toHaveLength(1);
    expect(normalizedTurns[0]).toMatchObject({
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

    const transcript = buildProviderTranscript(
      [createMessage('user-1', 'user', 'Inspect the workspace'), assistantMessage],
      normalizedTurns,
    );

    expect(transcript.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  test('keeps failed tool results adjacent to tool_use before any assistant text', () => {
    const assistantMessageId = 'assistant-failed-tool';
    const messages: Message[] = [
      createMessage('user-1', 'user', 'Run the command'),
      createMessage(assistantMessageId, 'assistant', 'The tool needs approval.'),
    ];

    const turns: TurnTrace[] = [
      {
        turnNumber: 1,
        sessionId: 'session-failed',
        conversationId: 'conversation-1',
        assistantMessageId,
        startTime: 10,
        endTime: 20,
        status: 'error',
        thinking: {
          content: 'Trying the command',
          startTime: 10,
          endTime: 11,
          status: 'complete',
        },
        response: {
          content: 'The tool needs approval.',
          startTime: 12,
          endTime: 20,
        },
        tools: [
          {
            toolCallId: 'tool-1',
            name: 'shell',
            input: { command: 'python heap_sort.py' },
            logicalIndex: 1,
            status: 'failed',
            error: 'Approval required: This command may modify the workspace or system state.',
          },
        ],
      },
    ];

    const transcript = buildProviderTranscript(messages, turns);

    expect(transcript).toHaveLength(4);
    expect(transcript[1]).toMatchObject({
      role: 'assistant',
      content: '',
      contentBlocks: [
        { type: 'thinking', thinking: 'Trying the command' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'shell',
          input: { command: 'python heap_sort.py' },
        },
      ],
    });
    expect(transcript[2]).toMatchObject({
      role: 'user',
      content: '',
      contentBlocks: [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content:
            'Approval required: This command may modify the workspace or system state.',
          isError: true,
        },
      ],
    });
    expect(transcript[3]).toMatchObject({
      role: 'assistant',
      content: 'The tool needs approval.',
      contentBlocks: [{ type: 'text', text: 'The tool needs approval.' }],
    });
  });
});
