import type React from 'react';
import styled, { keyframes } from 'styled-components';
import { FaCircle } from 'react-icons/fa6';
import { messages } from '@/i18n';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import type { AgentStatus, TurnTrace } from '@/types';

const pulse = keyframes`
  0%, 100% { opacity: 0.45; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1); }
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  background: ${({ theme }) => theme.colors.bgPrimary};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const Cluster = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const Dot = styled(FaCircle)<{ $status: AgentStatus }>`
  flex: 0 0 auto;
  font-size: 7px;
  color: ${({ theme, $status }) =>
    $status === 'running'
      ? theme.colors.info
      : $status === 'complete'
        ? theme.colors.success
        : $status === 'error'
          ? theme.colors.error
          : $status === 'cancelled' || $status === 'max_turns_reached'
            ? theme.colors.warning
          : theme.colors.textTertiary};
  animation: ${({ $status }) => ($status === 'running' ? pulse : 'none')} 1.2s ease-in-out infinite;
`;

const statusLabel = (status: AgentStatus) => {
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'max_turns_reached') return 'Max turns reached';
  return messages.trace.status[status];
};

const EMPTY_TURNS: TurnTrace[] = [];

export const TraceStatusBar: React.FC = () => {
  const status = useTraceStore((state) => state.agentStatus);
  const conversationId = useTraceStore((state) => state.conversationId);
  const turns = useChatStore((state) =>
    state.conversations.find((conversation) => conversation.id === conversationId)?.turns ?? EMPTY_TURNS,
  );
  const currentTurn = turns[turns.length - 1];
  const phase = currentTurn?.response.content
    ? messages.trace.response
    : currentTurn?.thinking.status === 'streaming'
      ? messages.trace.thinking
      : currentTurn?.prompt
        ? messages.trace.prompt
        : messages.trace.idle;

  return (
    <Bar>
      <Cluster>
        <Dot $status={status} />
        <span>{statusLabel(status)}</span>
      </Cluster>
      <Cluster>
        <span>{messages.trace.turnCount(currentTurn?.turnNumber ?? 0, turns.length)}</span>
        <span>{phase}</span>
      </Cluster>
    </Bar>
  );
};
