import type React from 'react';
import { useState } from 'react';
import styled from 'styled-components';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa6';
import { messages } from '@/i18n';
import type { TurnTrace } from '@/types';
import { PromptView } from './PromptView';
import { ThinkingView } from './ThinkingView';
import { ResponseView } from './ResponseView';

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
        : theme.colors.info};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const Body = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
`;

export const TurnCard: React.FC<{ turn: TurnTrace }> = ({ turn }) => {
  const [expanded, setExpanded] = useState(true);
  const Chevron = expanded ? FaChevronDown : FaChevronRight;

  return (
    <Card>
      <Header type="button" onClick={() => setExpanded((value) => !value)}>
        <Title>
          <Chevron />
          {messages.trace.turn(turn.turnNumber)}
        </Title>
        <Meta $status={turn.status}>{messages.trace.turnStatus[turn.status]}</Meta>
      </Header>
      {expanded && (
        <Body>
          <PromptView prompt={turn.prompt} />
          <ThinkingView thinking={turn.thinking} />
          <ResponseView response={turn.response} />
        </Body>
      )}
    </Card>
  );
};
