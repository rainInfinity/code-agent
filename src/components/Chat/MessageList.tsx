import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { FaCheck, FaChevronDown, FaCopy, FaRobot, FaUser, FaXmark } from "react-icons/fa6";
import { useChatStore } from "@/stores/chatStore";
import { Row, Column } from "@/components/common/Flex";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { messages as appMessages } from "@/i18n";

const DISENGAGE_AUTO_FOLLOW_PX = 150;
const REENGAGE_AUTO_FOLLOW_PX = 50;
const BUTTON_SMOOTH_SCROLL_MS = 700;

const ListShell = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const ListContainer = styled.div<{ $isStreaming: boolean }>`
  height: 100%;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.xl} 0;
  position: relative;
  scroll-behavior: ${({ $isStreaming }) => ($isStreaming ? "auto" : "smooth")};
`;

const MessagesContent = styled.div`
  width: 100%;
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
  position: absolute;
  bottom: ${({ theme }) => theme.spacing.md};
  left: 50%;
  transform: translateX(-50%) translateY(${({ $visible }) => ($visible ? "0" : "8px")});
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
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

const makeStreamingMarkdownRenderable = (content: string) => {
  const fenceMatches = content.match(/(^|\n)\s*(```|~~~)/g) ?? [];
  if (fenceMatches.length % 2 === 1) {
    const lastFence = fenceMatches[fenceMatches.length - 1];
    const fence = lastFence.includes("~~~") ? "~~~" : "```";
    return `${content}\n${fence}`;
  }

  return content;
};

const MessageBodyContent: React.FC<{ status: string; content: string }> = ({ status, content }) => {
  if (status === "error") {
    return <ErrorMessage>{content || appMessages.messages.errorFallback}</ErrorMessage>;
  }

  if (status === "streaming" && !content) {
    return (
      <ThinkingIndicator>
        <span />
        <span />
        <span />
      </ThinkingIndicator>
    );
  }

  if (status === "streaming") {
    return <MarkdownRenderer content={makeStreamingMarkdownRenderable(content)} />;
  }

  return <MarkdownRenderer content={content} />;
};

export const MessageList: React.FC = () => {
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const smoothScrollUntilRef = useRef(0);
  const smoothScrollTimeoutRef = useRef<number | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const [copyState, setCopyState] = useState<Record<string, "success" | "error">>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { conversations, activeConversationId } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];
  const isStreaming = messages.some((message) => message.status === "streaming");
  const lastMessage = messages[messages.length - 1];

  const getDistanceFromBottom = useCallback((el: HTMLDivElement) => {
    return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  }, []);

  const scrollToBottomInstant = useCallback((force = false) => {
    if (!force && Date.now() < smoothScrollUntilRef.current) {
      return;
    }

    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const updateScrollAffordance = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    if (Date.now() < smoothScrollUntilRef.current) {
      autoFollowRef.current = true;
      setShowScrollToBottom(false);
      return;
    }

    const distanceFromBottom = getDistanceFromBottom(el);
    if (distanceFromBottom > DISENGAGE_AUTO_FOLLOW_PX) {
      autoFollowRef.current = false;
    } else if (distanceFromBottom <= REENGAGE_AUTO_FOLLOW_PX) {
      autoFollowRef.current = true;
    }

    setShowScrollToBottom(messages.length > 0 && !autoFollowRef.current);
  }, [getDistanceFromBottom, messages.length]);

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
    autoFollowRef.current = true;

    if (smoothScrollTimeoutRef.current !== null) {
      window.clearTimeout(smoothScrollTimeoutRef.current);
    }

    smoothScrollUntilRef.current = Date.now() + BUTTON_SMOOTH_SCROLL_MS;
    smoothScrollTimeoutRef.current = window.setTimeout(() => {
      smoothScrollUntilRef.current = 0;
      smoothScrollTimeoutRef.current = null;
      scrollToBottomInstant(true);
      updateScrollAffordance();
    }, BUTTON_SMOOTH_SCROLL_MS);

    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  }, [scrollToBottomInstant, updateScrollAffordance]);

  useEffect(() => {
    const conversationChanged = previousConversationIdRef.current !== activeConversationId;
    const lastMessageChanged = previousLastMessageIdRef.current !== (lastMessage?.id ?? null);
    const userSentMessage = lastMessageChanged && lastMessage?.role === "user";

    if (conversationChanged || userSentMessage) {
      autoFollowRef.current = true;
      scrollToBottomInstant(true);
      setShowScrollToBottom(false);
    }

    previousConversationIdRef.current = activeConversationId ?? null;
    previousLastMessageIdRef.current = lastMessage?.id ?? null;
  }, [
    activeConversationId,
    lastMessage?.id,
    lastMessage?.role,
    scrollToBottomInstant,
  ]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const observer = new ResizeObserver(() => {
      if (autoFollowRef.current) {
        scrollToBottomInstant();
      }
      updateScrollAffordance();
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [scrollToBottomInstant, updateScrollAffordance]);

  useEffect(() => {
    return () => {
      if (smoothScrollTimeoutRef.current !== null) {
        window.clearTimeout(smoothScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoFollowRef.current && isStreaming) {
      scrollToBottomInstant();
    }
    updateScrollAffordance();
  }, [isStreaming, lastMessage?.content, scrollToBottomInstant, updateScrollAffordance]);

  if (messages.length === 0) return null;

  return (
    <ListShell>
      <ListContainer
        ref={listRef}
        className="selectable"
        onScroll={updateScrollAffordance}
        $isStreaming={isStreaming}
      >
        <MessagesContent ref={contentRef}>
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
                    <MessageBodyContent status={msg.status} content={msg.content} />
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
        </MessagesContent>
      </ListContainer>
      <ScrollToBottomButton
        type="button"
        $visible={showScrollToBottom}
        onClick={scrollToBottom}
        title={appMessages.messages.scrollToLatest}
        aria-label={appMessages.messages.scrollToLatest}
      >
        <FaChevronDown size={14} />
      </ScrollToBottomButton>
    </ListShell>
  );
};
