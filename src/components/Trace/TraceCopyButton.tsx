import type React from 'react';
import styled from 'styled-components';
import { FaCheck, FaCopy, FaXmark } from 'react-icons/fa6';
import { messages } from '@/i18n';
import type { CopyTone } from './useCopyFeedback';

const Button = styled.button<{ $tone: CopyTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  height: 24px;
  border: 1px solid
    ${({ $tone, theme }) =>
      $tone === 'success'
        ? theme.colors.success
        : $tone === 'error'
          ? theme.colors.error
          : theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  background: transparent;
  color: ${({ $tone, theme }) =>
    $tone === 'success'
      ? theme.colors.success
      : $tone === 'error'
        ? theme.colors.error
        : theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ $tone, theme }) =>
      $tone === 'success'
        ? theme.colors.success
        : $tone === 'error'
          ? theme.colors.error
          : theme.colors.textPrimary};
  }
`;

export const TraceCopyButton: React.FC<{
  tone: CopyTone;
  idleLabel: string;
  onClick: () => void;
}> = ({ tone, idleLabel, onClick }) => {
  const label =
    tone === 'success'
      ? messages.trace.copied
      : tone === 'error'
        ? messages.trace.copyFailed
        : idleLabel;

  return (
    <Button type="button" $tone={tone} title={label} aria-label={label} onClick={onClick}>
      {tone === 'success' ? (
        <FaCheck size={11} />
      ) : tone === 'error' ? (
        <FaXmark size={11} />
      ) : (
        <FaCopy size={11} />
      )}
      <span>{label}</span>
    </Button>
  );
};
