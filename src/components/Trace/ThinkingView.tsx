import type React from 'react';
import styled from 'styled-components';
import { messages } from '@/i18n';
import type { TurnTrace } from '@/types';
import { TraceCopyButton } from './TraceCopyButton';
import { useCopyFeedback } from './useCopyFeedback';

const Section = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  margin-top: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const HeaderMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const State = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const Content = styled.pre`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid ${({ theme }) => theme.colors.codeBorder};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

export const ThinkingView: React.FC<{ thinking: TurnTrace['thinking'] }> = ({ thinking }) => {
  const { copyTone, copyText } = useCopyFeedback();
  if (!thinking.content && thinking.status === 'idle') return null;

  return (
    <Section>
      <Header>
        <span>{messages.trace.thinking}</span>
        <HeaderMeta>
          <State>{messages.trace.thinkingStatus[thinking.status]}</State>
          {thinking.content ? (
            <TraceCopyButton
              tone={copyTone}
              idleLabel={messages.trace.copyThinking}
              onClick={() => {
                void copyText(thinking.content);
              }}
            />
          ) : null}
        </HeaderMeta>
      </Header>
      <Content>{thinking.content || messages.trace.noThinking}</Content>
    </Section>
  );
};
