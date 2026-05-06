import type React from 'react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa6';
import { messages } from '@/i18n';
import type { TurnTrace } from '@/types';
import { PromptView } from './PromptView';
import { ThinkingView } from './ThinkingView';
import { ResponseView } from './ResponseView';
import { ToolView } from './ToolView';

type TurnCardProps = {
  turn: TurnTrace;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

const Card = styled.article`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.bgSecondary};
  overflow: hidden;

  & + & {
    margin-top: ${({ theme }) => theme.spacing.md};
  }
`;

const Header = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  border: 0;
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

const Title = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const Meta = styled.span<{ $status: TurnTrace['status'] }>`
  color: ${({ theme, $status }) =>
    $status === 'complete'
      ? theme.colors.success
      : $status === 'error'
        ? theme.colors.error
        : $status === 'cancelled' || $status === 'max_turns_reached'
          ? theme.colors.warning
        : theme.colors.info};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const MetaGroup = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const UsageMeta = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  white-space: nowrap;
`;

const TimeMeta = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  white-space: nowrap;
`;

const Body = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
`;

const formatTokenCount = (value: number) =>
  value > 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) {
    return messages.messages.durationMs(Math.max(0, Math.round(durationMs)));
  }

  if (durationMs < 60000) {
    return messages.messages.durationS(durationMs / 1000);
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  return messages.messages.durationMS(
    Math.floor(totalSeconds / 60),
    totalSeconds % 60,
  );
};

const formatStartTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const turnStatusLabel = (status: TurnTrace['status']) => {
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'max_turns_reached') return 'Max turns reached';
  return messages.trace.turnStatus[status];
};

export const TurnCard: React.FC<TurnCardProps> = ({ turn, expanded, onExpandedChange }) => {
  const [elapsedMs, setElapsedMs] = useState(() => (turn.endTime ?? Date.now()) - turn.startTime);
  const Chevron = expanded ? FaChevronDown : FaChevronRight;
  const hasUsage =
    turn.usage !== undefined &&
    (turn.usage.inputTokens > 0 || turn.usage.outputTokens > 0);

  useEffect(() => {
    const updateElapsed = () => {
      setElapsedMs((turn.endTime ?? Date.now()) - turn.startTime);
    };

    updateElapsed();
    if (turn.status !== 'running') return;

    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [turn.endTime, turn.startTime, turn.status]);

  return (
    <Card>
      <Header type="button" onClick={() => onExpandedChange(!expanded)}>
        <Title>
          <Chevron />
          {messages.trace.turn(turn.turnNumber)}
        </Title>
        <MetaGroup>
          <Meta $status={turn.status}>{turnStatusLabel(turn.status)}</Meta>
          <TimeMeta title={messages.trace.timePrefix(formatStartTime(turn.startTime))}>
            {messages.trace.timePrefix(formatStartTime(turn.startTime))} · {formatDuration(elapsedMs)}
          </TimeMeta>
          {hasUsage ? (
            <UsageMeta
              title={`${messages.trace.inputTokens}: ${turn.usage!.inputTokens}; ${messages.trace.outputTokens}: ${turn.usage!.outputTokens}`}
            >
              ↑{formatTokenCount(turn.usage!.inputTokens)} ↓{formatTokenCount(turn.usage!.outputTokens)}
            </UsageMeta>
          ) : null}
        </MetaGroup>
      </Header>
      {expanded && (
        <Body>
          <PromptView prompt={turn.prompt} />
          <ThinkingView thinking={turn.thinking} />
          <ToolView tools={turn.tools} />
          <ResponseView response={turn.response} />
        </Body>
      )}
    </Card>
  );
};
