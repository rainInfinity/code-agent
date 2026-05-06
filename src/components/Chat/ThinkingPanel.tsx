import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { cva } from 'class-variance-authority';
import { FaCheck } from 'react-icons/fa6';
import { messages as appMessages } from '@/i18n';
import { pulse, shimmer, blink } from './animations';
import { cn } from '@/utils/cn';
import { formatThinkingDuration } from '@/utils/formatThinkingDuration';
import type { TurnTrace } from '@/types';

export type ThinkingPanelProps = {
  panelId: string;
  thinkingContent: string;
  thinkingStatus: TurnTrace['thinking']['status'];
  thinkingStartedAt?: number;
  thinkingEndedAt?: number;
  responseStartedAt?: number;
};

const thinkingPanelVariants = cva('', {
  variants: {
    isThinking: {
      true: 'thinking-active',
      false: 'thinking-idle',
    },
  },
});

const ThinkingPanelShell = styled.div.attrs<{ $isThinking: boolean }>(
  ({ $isThinking }) => ({
    className: cn(thinkingPanelVariants({ isThinking: $isThinking })),
  }),
)<{ $isThinking: boolean }>`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  text-align: left;

  &.thinking-idle {
    background:
      linear-gradient(
          ${({ theme }) => theme.colors.bgSecondary},
          ${({ theme }) => theme.colors.bgSecondary}
        )
        padding-box,
      linear-gradient(${({ theme }) => theme.colors.border}, ${({ theme }) => theme.colors.border})
        border-box;
    background-size: 100% 100%;
    animation: none;
  }

  &.thinking-active {
    background:
      linear-gradient(
          ${({ theme }) => theme.colors.bgSecondary},
          ${({ theme }) => theme.colors.bgSecondary}
        )
        padding-box,
      linear-gradient(
          90deg,
          ${({ theme }) => theme.colors.border},
          ${({ theme }) => theme.colors.accentPrimary},
          ${({ theme }) => theme.colors.border}
        )
        border-box;
    background-size: 100% 100%, 200% 100%;
    animation: ${shimmer} 1.6s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const ThinkingPanelHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 38px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-align: left;

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: -2px;
  }
`;

const ThinkingPulse = styled.span`
  width: 7px;
  height: 7px;
  min-width: 7px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.accentPrimary};
  animation: ${pulse} 1.4s infinite ease-in-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const ThinkingStatusIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  min-width: 12px;
  color: ${({ theme }) => theme.colors.success};
`;

const ThinkingHeaderText = styled.span`
  min-width: 0;
  flex: 1;
`;

const ThinkingMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  flex-wrap: wrap;
  justify-content: flex-end;
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const ThinkingBody = styled.pre`
  max-height: 260px;
  overflow: auto;
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const BlinkingCursor = styled.span`
  display: inline-block;
  color: ${({ theme }) => theme.colors.accentPrimary};
  animation: ${blink} 0.6s steps(1, end) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  panelId,
  thinkingContent,
  thinkingStatus,
  thinkingStartedAt,
  thinkingEndedAt,
  responseStartedAt,
}) => {
  const bodyRef = useRef<HTMLPreElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(() =>
    thinkingStartedAt
      ? (thinkingEndedAt ?? Date.now()) - thinkingStartedAt
      : 0,
  );
  const isThinking = thinkingStatus === 'streaming';
  const tokenEstimate = thinkingContent
    ? Math.round(thinkingContent.length * 0.25)
    : null;

  useEffect(() => {
    if (!isOpen) return;
    const body = bodyRef.current;
    if (!body || body.scrollHeight <= body.clientHeight) return;
    body.scrollTop = body.scrollHeight;
  }, [isOpen, thinkingContent]);

  useEffect(() => {
    if (!thinkingStartedAt) {
      setElapsedMs(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedMs((thinkingEndedAt ?? Date.now()) - thinkingStartedAt);
    };

    updateElapsed();
    if (!isThinking) return;

    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [isThinking, panelId, thinkingEndedAt, thinkingStartedAt]);

  useEffect(() => {
    if (responseStartedAt) {
      setIsOpen(false);
    }
  }, [responseStartedAt]);

  return (
    <ThinkingPanelShell $isThinking={isThinking}>
      <ThinkingPanelHeader
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {isThinking ? (
          <ThinkingPulse aria-hidden="true" />
        ) : (
          <ThinkingStatusIcon aria-hidden="true">
            <FaCheck size={11} />
          </ThinkingStatusIcon>
        )}
        <ThinkingHeaderText>
          {isThinking
            ? appMessages.messages.thinkingInProgress
            : appMessages.messages.thinkingComplete}
        </ThinkingHeaderText>
        <ThinkingMeta>
          {thinkingStartedAt ? (
            <span>{formatThinkingDuration(elapsedMs)}</span>
          ) : null}
          {tokenEstimate !== null ? (
            <span>
              ~{tokenEstimate} {appMessages.messages.tokens}
            </span>
          ) : null}
        </ThinkingMeta>
      </ThinkingPanelHeader>
      {isOpen ? (
        <ThinkingBody ref={bodyRef}>
          {thinkingContent}
          {isThinking ? (
            <BlinkingCursor aria-hidden="true">▌</BlinkingCursor>
          ) : null}
        </ThinkingBody>
      ) : null}
    </ThinkingPanelShell>
  );
};
