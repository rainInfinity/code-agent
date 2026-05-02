import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { FaCheck, FaChevronDown, FaCopy, FaRobot, FaUser, FaXmark } from "react-icons/fa6";
import { useChatStore } from "@/stores/chatStore";
import { Row, Column } from "@/components/common/Flex";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { messages as appMessages } from "@/i18n";

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.xl} 0;
  position: relative;
`;

const MessageWrapper = styled(Row)<{ $role: string }>`
  flex-direction: ${({ $role }) => ($role === "user" ? "row-reverse" : "row")};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
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
    $role === "user" ? theme.colors.accentPrimary : theme.colors.bgTertiary};
  color: ${({ theme, $role }) =>
    $role === "user" ? "#fff" : theme.colors.accentPrimary};
`;

const MessageContent = styled(Column)<{ $role: string }>`
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 44px);
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: ${({ $role }) => ($role === "user" ? "right" : "left")};
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
  justify-content: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  min-height: 28px;
  padding-top: ${({ theme }) => theme.spacing.xs};
  opacity: 0;
  visibility: hidden;
  transition: opacity ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  ${MessageWrapper}:hover &,
  ${MessageWrapper}:focus-within & {
    opacity: 1;
    visibility: visible;
  }
`;

const CopyButton = styled.button<{ $tone: "idle" | "success" | "error" }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 32px;
  height: 28px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $tone }) =>
    $tone === "success"
      ? theme.colors.success
      : $tone === "error"
        ? theme.colors.error
        : theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme, $tone }) =>
      $tone === "success"
        ? theme.colors.success
        : $tone === "error"
          ? theme.colors.error
          : theme.colors.textSecondary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const ScrollToBottomButton = styled.button<{ $visible: boolean }>`
  position: sticky;
  bottom: ${({ theme }) => theme.spacing.md};
  left: 50%;
  transform: translateX(-50%) translateY(${({ $visible }) => ($visible ? "0" : "8px")});
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: ${({ theme }) => theme.spacing.md} auto 0;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background-color: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  box-shadow: ${({ theme }) => theme.shadows.md};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? "visible" : "hidden")};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgTertiary};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: translateX(-50%);
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing.sm} 0;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.accentPrimary};
    animation: ${pulse} 1.4s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => `${theme.colors.error}10`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => `${theme.colors.error}30`};
`;

export const MessageList: React.FC = () => {
  const listRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<Record<string, "success" | "error">>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { conversations, activeConversationId } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];

  const updateScrollAffordance = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollToBottom(messages.length > 0 && !isNearBottom);
  }, [messages.length]);

  const copyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState((state) => ({ ...state, [messageId]: "success" }));
    } catch {
      setCopyState((state) => ({ ...state, [messageId]: "error" }));
    }

    window.setTimeout(() => {
      setCopyState((state) => {
        const { [messageId]: _ignored, ...nextState } = state;
        return nextState;
      });
    }, 1600);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    updateScrollAffordance();
  }, [
    messages,
    messages.length > 0 ? messages[messages.length - 1]?.content : "",
    updateScrollAffordance,
  ]);

  useEffect(() => {
    updateScrollAffordance();
  }, [updateScrollAffordance]);

  if (messages.length === 0) return null;

  return (
    <ListContainer ref={listRef} className="selectable" onScroll={updateScrollAffordance}>
      {messages.map((msg) => {
        const copyTone = copyState[msg.id] ?? "idle";
        const copyLabel =
          copyTone === "success"
            ? appMessages.messages.copy.success
            : copyTone === "error"
              ? appMessages.messages.copy.error
              : appMessages.messages.copy.idle;

        return (
          <MessageWrapper key={msg.id} $role={msg.role} $align="flex-start" $gap="md">
            <Avatar $role={msg.role}>
              {msg.role === "user" ? <FaUser size={14} /> : <FaRobot size={14} />}
            </Avatar>
            <MessageContent $role={msg.role}>
              <RoleName>
                {msg.role === "user"
                  ? appMessages.messages.roles.user
                  : appMessages.messages.roles.assistant}
              </RoleName>
              <MessageBody>
                {msg.status === "error" ? (
                  <ErrorMessage>
                    {msg.content || appMessages.messages.errorFallback}
                  </ErrorMessage>
                ) : msg.status === "streaming" && !msg.content ? (
                  <ThinkingIndicator>
                    <span />
                    <span />
                    <span />
                  </ThinkingIndicator>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </MessageBody>
              <MessageActions $role={msg.role}>
                <CopyButton
                  type="button"
                  $tone={copyTone}
                  onClick={() => copyMessage(msg.id, msg.content)}
                  title={copyLabel}
                  aria-label={copyLabel}
                >
                  {copyTone === "success" ? (
                    <FaCheck size={12} />
                  ) : copyTone === "error" ? (
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
      })}
      <ScrollToBottomButton
        type="button"
        $visible={showScrollToBottom}
        onClick={scrollToBottom}
        title={appMessages.messages.scrollToLatest}
        aria-label={appMessages.messages.scrollToLatest}
      >
        <FaChevronDown size={14} />
      </ScrollToBottomButton>
    </ListContainer>
  );
};
