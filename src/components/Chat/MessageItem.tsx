import React from 'react';
import styled from 'styled-components';
import { cva } from 'class-variance-authority';
import { FaCheck, FaCopy, FaRobot, FaUser, FaXmark } from 'react-icons/fa6';
import { useChatStore } from '@/stores/chatStore';
import { Row, Column } from '@/components/common/Flex';
import { MessageBodyContent } from './MessageBodyContent';
import { messages as appMessages } from '@/i18n';
import { focusRing } from '@/styles/mixins';
import { cn } from '@/utils/cn';
import { getTurnsForAssistantMessage } from '@/utils/turns';
import type { MessageRole } from '@/types';

const messageWrapperVariants = cva('', {
  variants: {
    role: {
      user: 'role-user',
      assistant: 'role-assistant',
    },
  },
});

const MessageWrapper = styled(Row).attrs<{ $role: string }>(({ $role }) => ({
  className: cn(messageWrapperVariants({ role: $role as 'user' | 'assistant' })),
}))<{ $role: string }>`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  max-width: 860px;
  margin: 0 auto;
  width: 100%;

  &.role-user {
    flex-direction: row-reverse;
  }

  &.role-assistant {
    flex-direction: row;
  }
`;

const Avatar = styled.div<{ $role: string }>`
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;

  background-color: ${({ theme, $role }) =>
    $role === 'user' ? theme.colors.accentPrimary : theme.colors.bgTertiary};
  color: ${({ theme, $role }) =>
    $role === 'user' ? '#fff' : theme.colors.accentPrimary};
`;

const MessageContent = styled(Column)<{ $role: string }>`
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 44px);
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: ${({ $role }) => ($role === 'user' ? 'right' : 'left')};
`;

const RoleName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const MessageBody = styled.div`
  min-width: 0;
  min-height: 28px;
`;

const MessageActions = styled.div<{ $role: string }>`
  display: flex;
  justify-content: ${({ $role }) =>
    $role === 'user' ? 'flex-end' : 'flex-start'};
  min-height: 28px;
  padding-top: ${({ theme }) => theme.spacing.xs};
  opacity: 0;
  visibility: hidden;
  transition:
    opacity ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  ${MessageWrapper}:hover &,
  ${MessageWrapper}:focus-within & {
    opacity: 1;
    visibility: visible;
  }
`;

const copyButtonVariants = cva('', {
  variants: {
    tone: {
      idle: 'tone-idle',
      success: 'tone-success',
      error: 'tone-error',
    },
  },
  defaultVariants: {
    tone: 'idle',
  },
});

const CopyButton = styled.button.attrs<{ $tone: 'idle' | 'success' | 'error' }>(
  ({ $tone }) => ({
    className: cn(copyButtonVariants({ tone: $tone })),
  }),
)<{ $tone: 'idle' | 'success' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 32px;
  height: 28px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  transition:
    background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &.tone-idle {
    color: ${({ theme }) => theme.colors.textTertiary};
  }

  &.tone-success {
    color: ${({ theme }) => theme.colors.success};
  }

  &.tone-error {
    color: ${({ theme }) => theme.colors.error};
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};

    &.tone-idle {
      color: ${({ theme }) => theme.colors.textSecondary};
    }

    &.tone-success {
      color: ${({ theme }) => theme.colors.success};
    }

    &.tone-error {
      color: ${({ theme }) => theme.colors.error};
    }
  }

  ${focusRing}
`;

type MessageItemProps = {
  conversationId: string;
  messageId: string;
  role: MessageRole;
  copyTone: 'idle' | 'success' | 'error';
  onCopyMessage: (messageId: string, content: string) => void;
};

export const MessageItem: React.FC<MessageItemProps> = React.memo(
  ({ conversationId, messageId, role, copyTone, onCopyMessage }) => {
    const conversation = useChatStore((state) =>
      state.conversations.find((item) => item.id === conversationId),
    );
    const message = conversation?.messages.find(
      (item) => item.id === messageId,
    );
    const assistantTurns =
      message?.role === 'assistant'
        ? getTurnsForAssistantMessage(conversation?.turns, message.id)
        : [];

    if (!message) return null;

    const copyLabel =
      copyTone === 'success'
        ? appMessages.messages.copy.success
        : copyTone === 'error'
          ? appMessages.messages.copy.error
          : appMessages.messages.copy.idle;

    return (
      <MessageWrapper $role={role} $align="flex-start" $gap="md">
        <Avatar $role={role}>
          {role === 'user' ? <FaUser size={14} /> : <FaRobot size={14} />}
        </Avatar>
        <MessageContent $role={role}>
          <RoleName>
            {role === 'user'
              ? appMessages.messages.roles.user
              : appMessages.messages.roles.assistant}
          </RoleName>
          <MessageBody>
            <MessageBodyContent
              message={message}
              role={role}
              assistantTurns={assistantTurns}
            />
          </MessageBody>
          <MessageActions $role={role}>
            <CopyButton
              type="button"
              $tone={copyTone}
              onClick={() => onCopyMessage(message.id, message.content)}
              title={copyLabel}
              aria-label={copyLabel}
            >
              {copyTone === 'success' ? (
                <FaCheck size={12} />
              ) : copyTone === 'error' ? (
                <FaXmark size={12} />
              ) : (
                <FaCopy size={12} />
              )}
              <span>{copyLabel}</span>
            </CopyButton>
          </MessageActions>
        </MessageContent>
      </MessageWrapper>
    );
  },
);
