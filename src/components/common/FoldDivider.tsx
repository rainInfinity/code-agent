import type React from 'react';
import styled from 'styled-components';
import { messages } from '@/i18n';

type FoldDividerProps = {
  foldedTurnCount: number;
  estimatedTokens?: number;
  loadMoreTurns: number;
  onLoadMore: () => void;
  onExpandAll: () => void;
};

const Shell = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
`;

const Line = styled.div`
  flex: 1;
  min-width: 0;
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSubtle};
`;

const Card = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.bgSecondary};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

const Summary = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  white-space: nowrap;
`;

const TokenInfo = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  white-space: nowrap;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  line-height: 1.1;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid
    ${({ $primary, theme }) =>
      $primary ? theme.colors.accentPrimary : theme.colors.border};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.accentPrimary : 'transparent'};
  color: ${({ $primary, theme }) =>
    $primary ? theme.colors.textInverse : theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  transition:
    background-color ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $primary, theme }) =>
      $primary ? theme.colors.accentPrimaryHover : theme.colors.bgHover};
    color: ${({ $primary, theme }) =>
      $primary ? theme.colors.textInverse : theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

export const FoldDivider: React.FC<FoldDividerProps> = ({
  foldedTurnCount,
  estimatedTokens,
  loadMoreTurns,
  onLoadMore,
  onExpandAll,
}) => {
  return (
    <Shell>
      <Line />
      <Card>
        <Summary>{messages.fold.divider.title(foldedTurnCount)}</Summary>
        {estimatedTokens !== undefined && (
          <TokenInfo>
            {messages.fold.divider.tokenInfo(estimatedTokens)}
          </TokenInfo>
        )}
        <ActionButton type="button" $primary onClick={onLoadMore}>
          {messages.fold.divider.loadMore(loadMoreTurns)}
        </ActionButton>
        <ActionButton type="button" onClick={onExpandAll}>
          {messages.fold.divider.expandAll}
        </ActionButton>
      </Card>
      <Line />
    </Shell>
  );
};
