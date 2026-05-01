import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { FaPaperPlane, FaStop } from 'react-icons/fa6';

const InputContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  padding-bottom: ${({ theme }) => theme.spacing.lg};
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  background-color: ${({ theme }) => theme.colors.inputBg};
  border: 1px solid ${({ theme }) => theme.colors.inputBorder};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.inputBorderFocus};
  }
`;

const TextArea = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 24px;
  max-height: 200px;
  background: transparent;
  color: ${({ theme }) => theme.colors.inputText};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  font-family: ${({ theme }) => theme.typography.fontFamily};

  &::placeholder {
    color: ${({ theme }) => theme.colors.inputPlaceholder};
  }
  &:focus-visible {
    outline: transparent;
  }
`;

const SendButton = styled.button<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.bgTertiary : theme.colors.accentPrimary};
  color: ${({ $disabled }) => ($disabled ? 'inherit' : '#fff')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  flex-shrink: 0;
  transition: all ${({ theme }) => theme.transitions.fast};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};

  &:hover:not([disabled]) {
    background-color: ${({ theme, $disabled }) =>
      $disabled ? undefined : theme.colors.accentPrimaryHover};
    transform: ${({ $disabled }) => ($disabled ? 'none' : 'scale(1.05)')};
  }

  &:active:not([disabled]) {
    transform: scale(0.95);
  }
`;

const StopButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.error};
  color: #fff;
  flex-shrink: 0;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    opacity: 0.9;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const Hint = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

interface MessageInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled = false,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || isStreaming || disabled) return;
    onSend(value);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const isEmpty = !value.trim();

  return (
    <InputContainer>
      <InputWrapper>
        <TextArea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? 'AI is thinking...'
              : disabled
                ? 'Configure API key in settings first'
                : 'Send a message... (Enter to send, Shift+Enter for new line)'
          }
          disabled={isStreaming || disabled}
          rows={1}
          aria-label="Message input"
        />
        {isStreaming ? (
          <StopButton
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
          >
            <FaStop size={12} />
          </StopButton>
        ) : (
          <SendButton
            onClick={handleSubmit}
            $disabled={isEmpty || disabled}
            disabled={isEmpty || disabled}
            title="Send message"
            aria-label="Send message"
          >
            <FaPaperPlane size={13} />
          </SendButton>
        )}
      </InputWrapper>
      <Hint>
        Claude Haiku 4.5 &middot; Enter to send, Shift+Enter for new line
      </Hint>
    </InputContainer>
  );
};
