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

const Content = styled.pre`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid ${({ theme }) => theme.colors.codeBorder};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.bgPrimary};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

export const ResponseView: React.FC<{ response: TurnTrace['response'] }> = ({ response }) => {
  const { copyTone, copyText } = useCopyFeedback();
  if (!response.content) return null;

  return (
    <Section>
      <Header>
        <span>{messages.trace.response}</span>
        <TraceCopyButton
          tone={copyTone}
          idleLabel={messages.trace.copyResponse}
          onClick={() => {
            void copyText(response.content);
          }}
        />
      </Header>
      <Content>{response.content}</Content>
    </Section>
  );
};
