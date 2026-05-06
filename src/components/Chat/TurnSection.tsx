import React from 'react';
import styled from 'styled-components';
import { ThinkingPanel } from './ThinkingPanel';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolTraceBlocks } from './ToolTraceBlocks';
import type { TurnTrace } from '@/types';

const TurnSectionShell = styled.div`
  & + & {
    margin-top: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

export const TurnSection: React.FC<{
  turn: TurnTrace;
  isStreaming: boolean;
}> = ({ turn, isStreaming }) => (
  <TurnSectionShell>
    {turn.thinking.content || turn.thinking.status !== 'idle' ? (
      <ThinkingPanel
        panelId={`${turn.assistantMessageId}:${turn.turnNumber}`}
        thinkingContent={turn.thinking.content}
        thinkingStatus={turn.thinking.status}
        thinkingStartedAt={turn.thinking.startTime}
        thinkingEndedAt={turn.thinking.endTime}
        responseStartedAt={turn.response.startTime}
      />
    ) : null}
    {turn.tools.length > 0 ? <ToolTraceBlocks toolTraces={turn.tools} /> : null}
    {turn.response.content ? (
      <MarkdownRenderer content={turn.response.content} isStreaming={isStreaming} />
    ) : null}
  </TurnSectionShell>
);
