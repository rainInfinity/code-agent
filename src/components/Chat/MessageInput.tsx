import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import {
  FaCheck,
  FaChevronDown,
  FaPaperPlane,
  FaPaperclip,
  FaStop,
  FaWandMagicSparkles,
} from 'react-icons/fa6';

const InputContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  padding-bottom: ${({ theme }) => theme.spacing.lg};
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.inputBg};
  border: 1px solid ${({ theme }) => theme.colors.inputBorder};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.inputBorderFocus};
  }
`;

const TextArea = styled.textarea`
  margin-top: 4px;
  width: 100%;
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

const ComposerToolbar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
`;

const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const ComposerButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 32px;
  height: 32px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  white-space: nowrap;
  transition:
    background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }

  @media (max-width: 560px) {
    span {
      display: none;
    }
  }
`;

const ModeButton = styled(ComposerButton)<{ $open: boolean }>`
  background-color: ${({ theme, $open }) =>
    $open ? theme.colors.bgActive : 'transparent'};
`;

const ModeMenu = styled.div<{ $open: boolean }>`
  position: absolute;
  right: 40px;
  bottom: calc(100% + ${({ theme }) => theme.spacing.sm});
  z-index: 3;
  min-width: 172px;
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transform: translateY(${({ $open }) => ($open ? '0' : '6px')});
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transition:
    opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`;

const ModeMenuItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 34px;
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: left;

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
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

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
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
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [mode, setMode] = useState('Thinking');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);
  const modeOptions = ['Fast', 'Thinking', 'Pro'];

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

  useEffect(() => {
    if (!modeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        modeSelectorRef.current?.contains(target)
      ) {
        return;
      }
      setModeMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModeMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [modeMenuOpen]);

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
        <ComposerToolbar>
          <ToolbarGroup>
            <ComposerButton
              type="button"
              onClick={() => undefined}
              title="Add file, not available yet"
              aria-label="Add file, not available yet"
            >
              <FaPaperclip size={13} />
            </ComposerButton>
            <ComposerButton
              type="button"
              onClick={() => undefined}
              title="Tools and skills, not available yet"
              aria-label="Tools and skills, not available yet"
            >
              <FaWandMagicSparkles size={13} />
              <span>Tools</span>
            </ComposerButton>
          </ToolbarGroup>
          <ToolbarGroup ref={modeSelectorRef}>
            <ModeButton
              type="button"
              $open={modeMenuOpen}
              onClick={() => setModeMenuOpen((open) => !open)}
              title="Choose visual response mode"
              aria-label={`Choose visual response mode. Current mode: ${mode}. UI only.`}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
            >
              <span>{mode}</span>
              <FaChevronDown size={11} />
            </ModeButton>
            <ModeMenu $open={modeMenuOpen} role="menu">
              {modeOptions.map((option) => (
                <ModeMenuItem
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === option}
                  $active={mode === option}
                  onClick={() => {
                    setMode(option);
                    setModeMenuOpen(false);
                  }}
                >
                  {option}
                  {mode === option && <FaCheck size={11} />}
                </ModeMenuItem>
              ))}
            </ModeMenu>
            {isStreaming ? (
              <StopButton
                type="button"
                onClick={onStop}
                title="Stop generating"
                aria-label="Stop generating"
              >
                <FaStop size={12} />
              </StopButton>
            ) : (
              <SendButton
                type="button"
                onClick={handleSubmit}
                $disabled={isEmpty || disabled}
                disabled={isEmpty || disabled}
                title="Send message"
                aria-label="Send message"
              >
                <FaPaperPlane size={13} />
              </SendButton>
            )}
          </ToolbarGroup>
        </ComposerToolbar>
      </InputWrapper>
      <Hint>
        Claude Haiku 4.5 &middot; Enter to send, Shift+Enter for new line
      </Hint>
    </InputContainer>
  );
};
