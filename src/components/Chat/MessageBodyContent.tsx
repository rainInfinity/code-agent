import React from 'react';
import styled from 'styled-components';
import { ThinkingPanel } from './ThinkingPanel';
import { TurnSection } from './TurnSection';
import { ToolResultBlock } from './ToolResultBlock';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolTraceBlocks } from './ToolTraceBlocks';
import { messages as appMessages } from '@/i18n';
import { getMessageToolTraces } from '@/utils/traceUtils';
import { shimmer } from './animations';
import type { ContentBlock, Message, MessageRole, ToolTrace, TurnTrace } from '@/types';

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &::before {
    content: '';
    width: 42px;
    height: 4px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.border},
      ${({ theme }) => theme.colors.accentPrimary},
      ${({ theme }) => theme.colors.border}
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => `${theme.colors.error}10`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => `${theme.colors.error}30`};
`;

const UserMessageText = styled.pre`
  max-height: 360px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
`;

const buildFallbackToolTrace = (
  block: Extract<ContentBlock, { type: 'tool_use' }>,
  logicalIndex: number,
): ToolTrace => ({
  toolCallId: block.id,
  name: block.name,
  input: block.input,
  logicalIndex,
  status: 'requested',
});

export const MessageBodyContent: React.FC<{
  message: Message;
  role: MessageRole;
  assistantTurns: TurnTrace[];
}> = ({ message, role, assistantTurns }) => {
  const { status, content } = message;
  const contentBlocks = message.contentBlocks ?? [];
  const toolTraces = getMessageToolTraces(message);
  const toolTraceMap = new Map(
    toolTraces.map((toolTrace) => [toolTrace.toolCallId, toolTrace]),
  );
  const hasRenderableBlocks = contentBlocks.length > 0;
  const hasTurnProjection = role === 'assistant' && assistantTurns.length > 0;
  const hasTurnRenderableContent = assistantTurns.some(
    (turn) =>
      turn.thinking.content ||
      turn.thinking.status !== 'idle' ||
      turn.tools.length > 0 ||
      turn.response.content,
  );
  const showErrorMessage =
    status === 'error' && Boolean(content || !hasRenderableBlocks);

  if (hasTurnProjection) {
    if (status === 'streaming' && !hasTurnRenderableContent) {
      return (
        <ThinkingIndicator>
          <span>{appMessages.messages.thinkingInProgress}</span>
        </ThinkingIndicator>
      );
    }

    return (
      <>
        {assistantTurns.map((turn, index) => (
          <TurnSection
            key={`${turn.sessionId}:${turn.turnNumber}`}
            turn={turn}
            isStreaming={
              status === 'streaming' &&
              index === assistantTurns.length - 1 &&
              turn.status === 'running'
            }
          />
        ))}
        {status === 'error' && content ? (
          <ErrorMessage>
            {content || appMessages.messages.errorFallback}
          </ErrorMessage>
        ) : null}
      </>
    );
  }

  if (status === 'streaming' && !hasRenderableBlocks) {
    return (
      <ThinkingIndicator>
        <span>{appMessages.messages.thinkingInProgress}</span>
      </ThinkingIndicator>
    );
  }

  return (
    <>
      {contentBlocks.map((block, index) => {
        switch (block.type) {
          case 'thinking':
            return (
              <ThinkingPanel
                key={`thinking-${index}`}
                thinkingContent={block.thinking}
                thinkingStatus={
                  message.status === 'streaming' && !message.content
                    ? 'streaming'
                    : 'complete'
                }
                thinkingStartedAt={message.thinkingStartedAt}
                panelId={`${message.id}:${index}`}
              />
            );
          case 'text':
            return role === 'user' ? (
              <UserMessageText key={`text-${index}`}>
                {block.text}
              </UserMessageText>
            ) : (
              <MarkdownRenderer
                key={`text-${index}`}
                content={block.text}
                isStreaming={
                  status === 'streaming' && index === contentBlocks.length - 1
                }
              />
            );
          case 'tool_use': {
            const toolTrace =
              toolTraceMap.get(block.id) ??
              buildFallbackToolTrace(block, index + 1);
            return (
              <ToolTraceBlocks
                key={`tool-use-${block.id}-${index}`}
                toolTraces={[toolTrace]}
              />
            );
          }
          case 'tool_result':
            return (
              <ToolResultBlock
                key={`tool-result-${block.toolUseId}-${index}`}
                block={block}
              />
            );
          default:
            return null;
        }
      })}
      {showErrorMessage ? (
        <ErrorMessage>
          {content || appMessages.messages.errorFallback}
        </ErrorMessage>
      ) : null}
    </>
  );
};
