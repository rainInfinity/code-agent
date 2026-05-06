import type { ContentBlock, Message } from '@/types';
import { getMessageToolTraces } from '@/utils/traceUtils';

export const upsertTrailingTextBlock = (
  contentBlocks: ContentBlock[] | undefined,
  text: string,
): ContentBlock[] => {
  const next = [...(contentBlocks ?? [])];
  const lastBlock = next[next.length - 1];

  if (lastBlock?.type === 'text') {
    next[next.length - 1] = { ...lastBlock, text };
    return next;
  }

  next.push({ type: 'text', text });
  return next;
};

export const upsertTrailingThinkingBlock = (
  contentBlocks: ContentBlock[] | undefined,
  thinking: string,
): ContentBlock[] => {
  const next = [...(contentBlocks ?? [])];
  const lastBlock = next[next.length - 1];

  if (lastBlock?.type === 'thinking') {
    next[next.length - 1] = { ...lastBlock, thinking };
    return next;
  }

  next.push({ type: 'thinking', thinking });
  return next;
};

const needsContentBlockMigration = (message: Message) => {
  const contentBlocks = message.contentBlocks ?? [];
  const hasOnlyTextBlocks =
    contentBlocks.length === 0 ||
    contentBlocks.every((block) => block.type === 'text');

  return (
    hasOnlyTextBlocks &&
    Boolean(message.thinkingContent || getMessageToolTraces(message).length)
  );
};

export const migrateMessageContentBlocks = (message: Message): Message => {
  if (!needsContentBlockMigration(message)) {
    return message;
  }

  const contentBlocks: ContentBlock[] = [];

  if (message.thinkingContent) {
    contentBlocks.push({
      type: 'thinking',
      thinking: message.thinkingContent,
    });
  }

  for (const toolTrace of getMessageToolTraces(message)) {
    contentBlocks.push({
      type: 'tool_use',
      id: toolTrace.toolCallId,
      name: toolTrace.name,
      input: toolTrace.input,
    });

    if (toolTrace.status === 'completed' || toolTrace.status === 'failed') {
      contentBlocks.push({
        type: 'tool_result',
        toolUseId: toolTrace.toolCallId,
        content:
          toolTrace.status === 'failed'
            ? toolTrace.error ?? toolTrace.output ?? ''
            : toolTrace.output ?? '',
        isError: toolTrace.status === 'failed',
      });
    }
  }

  if (message.content) {
    contentBlocks.push({
      type: 'text',
      text: message.content,
    });
  }

  return {
    ...message,
    contentBlocks,
  };
};
