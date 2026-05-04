import type React from 'react';
import styled from 'styled-components';
import { messages } from '@/i18n';
import type { TurnTrace } from '@/types';

const Section = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  margin-top: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
`;

const Header = styled.div`
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
  if (!response.content) return null;

  return (
    <Section>
      <Header>{messages.trace.response}</Header>
      <Content>{response.content}</Content>
    </Section>
  );
};
