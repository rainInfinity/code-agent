import { describe, expect, test } from 'vitest';
import type { Message, ToolTraceEvent } from '@/types';
import {
  applyToolTraceEvent,
  buildLegacyToolFields,
  completeTurnTrace,
  createTurnTrace,
  getMessageToolTraces,
  summarizeContentBlocks,
} from './traceUtils';

const createToolTraceEvent = (
  overrides: Partial<ToolTraceEvent> & Pick<ToolTraceEvent, 'toolCallId' | 'name' | 'phase' | 'logicalIndex'>,
): ToolTraceEvent => ({
  conversationId: 'conversation-1',
  sessionId: 'session-1',
  turn: 1,
  messageId: 'assistant-1',
  input: {},
  timestampMs: 100,
  ...overrides,
});

describe('traceUtils', () => {
  test('closes earlier turns before later turns become active', () => {
    const turn1 = createTurnTrace(
      { conversationId: 'conversation-1', sessionId: 'session-1', turnCount: 1 },
      1_000,
    );
    const closedTurn1 = completeTurnTrace(turn1, 'complete', 12, 24, 1_500);
    const turn2 = createTurnTrace(
      { conversationId: 'conversation-1', sessionId: 'session-1', turnCount: 2 },
      1_600,
    );

    expect(closedTurn1.status).toBe('complete');
    expect(closedTurn1.endTime).toBe(1_500);
    expect(turn2.status).toBe('running');
    expect(closedTurn1.turnNumber).toBe(1);
    expect(turn2.turnNumber).toBe(2);
  });

  test('preserves logical order and terminal states for concurrent tool batches', () => {
    let toolTraces = applyToolTraceEvent(
      [],
      createToolTraceEvent({
        toolCallId: 'tool-2',
        name: 'second_tool',
        phase: 'requested',
        logicalIndex: 2,
        timestampMs: 100,
      }),
    );

    toolTraces = applyToolTraceEvent(
      toolTraces,
      createToolTraceEvent({
        toolCallId: 'tool-1',
        name: 'first_tool',
        phase: 'requested',
        logicalIndex: 1,
        timestampMs: 90,
      }),
    );

    toolTraces = applyToolTraceEvent(
      toolTraces,
      createToolTraceEvent({
        toolCallId: 'tool-2',
        name: 'second_tool',
        phase: 'running',
        logicalIndex: 2,
        batchId: 1,
        batchIndex: 2,
        isConcurrent: true,
        timestampMs: 110,
      }),
    );

    toolTraces = applyToolTraceEvent(
      toolTraces,
      createToolTraceEvent({
        toolCallId: 'tool-1',
        name: 'first_tool',
        phase: 'failed',
        logicalIndex: 1,
        batchId: 1,
        batchIndex: 1,
        isConcurrent: true,
        timestampMs: 120,
        result: {
          success: false,
          output: '',
          error: 'Validation: file_path is required',
        },
      }),
    );

    toolTraces = applyToolTraceEvent(
      toolTraces,
      createToolTraceEvent({
        toolCallId: 'tool-2',
        name: 'second_tool',
        phase: 'completed',
        logicalIndex: 2,
        batchId: 1,
        batchIndex: 2,
        isConcurrent: true,
        timestampMs: 130,
        result: {
          success: true,
          output: 'ok',
        },
      }),
    );

    expect(toolTraces.map((toolTrace) => toolTrace.toolCallId)).toEqual(['tool-1', 'tool-2']);
    expect(toolTraces[0]).toMatchObject({
      status: 'failed',
      batchId: 1,
      batchIndex: 1,
      isConcurrent: true,
      error: 'Validation: file_path is required',
    });
    expect(toolTraces[1]).toMatchObject({
      status: 'completed',
      batchId: 1,
      batchIndex: 2,
      isConcurrent: true,
      output: 'ok',
    });

    const legacyFields = buildLegacyToolFields(toolTraces);
    expect(legacyFields.toolCalls).toHaveLength(2);
    expect(legacyFields.toolResults).toEqual([
      {
        toolCallId: 'tool-1',
        success: false,
        output: '',
        error: 'Validation: file_path is required',
      },
      {
        toolCallId: 'tool-2',
        success: true,
        output: 'ok',
        error: undefined,
      },
    ]);
  });

  test('derives tool traces from legacy message fields and summarizes content blocks', () => {
    const message: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      contentBlocks: [
        { type: 'thinking', thinking: 'reasoning' },
        { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
        { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace' },
      ],
      status: 'complete',
      timestamp: Date.now(),
      toolCalls: [{ id: 'tool-1', name: 'shell', input: { command: 'pwd' } }],
      toolResults: [{ toolCallId: 'tool-1', success: true, output: '/workspace' }],
    };

    expect(getMessageToolTraces(message)).toEqual([
      {
        toolCallId: 'tool-1',
        name: 'shell',
        input: { command: 'pwd' },
        logicalIndex: 1,
        status: 'completed',
        output: '/workspace',
        error: undefined,
      },
    ]);
    expect(summarizeContentBlocks(message.contentBlocks)).toContain('Tool use: shell');
    expect(summarizeContentBlocks(message.contentBlocks)).toContain('Tool result: /workspace');
  });
});
