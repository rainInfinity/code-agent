import type React from 'react';
import { useState } from 'react';
import styled from 'styled-components';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa6';
import { messages } from '@/i18n';
import type { TurnTrace } from '@/types';
import { summarizeContentBlocks } from '@/utils/traceUtils';
import { TraceCopyButton } from './TraceCopyButton';
import { useCopyFeedback } from './useCopyFeedback';

type Prompt = TurnTrace['prompt'];

const Section = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  padding-top: ${({ theme }) => theme.spacing.md};

  & + & {
    margin-top: ${({ theme }) => theme.spacing.md};
  }
`;

const Header = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Toggle = styled.button`
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  border: 0;
  padding: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: transparent;
  cursor: pointer;
  font: inherit;
`;

const Label = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const Summary = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const Block = styled.pre`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  max-height: 220px;
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

const MessageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const MessageItem = styled.details`
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.bgPrimary};

  summary {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }
`;

export const PromptView: React.FC<{ prompt: Prompt }> = ({ prompt }) => {
  const [expanded, setExpanded] = useState(false);
  const { copyTone, copyText } = useCopyFeedback();
  if (!prompt) return null;

  const Chevron = expanded ? FaChevronDown : FaChevronRight;
  const renderedMessages = prompt.messages.map((message) => ({
    ...message,
    renderedContent: summarizeContentBlocks(message.contentBlocks) || message.content || '(empty)',
  }));
  const promptText = [
    `system: ${prompt.systemPrompt}`,
    ...renderedMessages.map((message) => `${message.role}: ${message.renderedContent}`),
  ].join('\n\n');

  return (
    <Section>
      <Header>
        <Toggle type="button" onClick={() => setExpanded((value) => !value)}>
          <Label>
            <Chevron />
            {messages.trace.prompt}
          </Label>
          <Summary>{messages.trace.messageCount(prompt.messages.length)}</Summary>
        </Toggle>
        <TraceCopyButton
          tone={copyTone}
          idleLabel={messages.trace.copyPrompt}
          onClick={() => {
            void copyText(promptText);
          }}
        />
      </Header>
      {expanded ? (
        <>
          <Block>{prompt.systemPrompt}</Block>
          <MessageList>
            {renderedMessages.map((message, index) => (
              <MessageItem key={`${message.role}-${index}`}>
                <summary>
                  {message.role} - {message.renderedContent.slice(0, 80)}
                  {message.renderedContent.length > 80 ? '...' : ''}
                </summary>
                <Block>{message.renderedContent}</Block>
              </MessageItem>
            ))}
          </MessageList>
        </>
      ) : null}
    </Section>
  );
};
