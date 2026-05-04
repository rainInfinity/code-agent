import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { FaCheck, FaChevronDown, FaCopy, FaRobot, FaUser, FaXmark } from "react-icons/fa6";
import { useChatStore } from "@/stores/chatStore";
import { Row, Column } from "@/components/common/Flex";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { messages as appMessages } from "@/i18n";
import type { Message } from "@/types";

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

const shimmer = keyframes`
  0% { background-position: 200% 50%; }
  100% { background-position: 0% 50%; }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &::before {
    content: "";
    width: 42px;
    height: 4px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.border},
      ${({ theme }) => theme.colors.accentPrimary},
      ${({ theme }) => theme.colors.border}
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.1s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
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

const ToolPanel = styled.details`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.bgSecondary};
  text-align: left;

  summary {
    cursor: pointer;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`;

const ToolBody = styled.pre`
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

const ThinkingPanelShell = styled.div<{ $isThinking: boolean }>`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background:
    linear-gradient(
      ${({ theme }) => theme.colors.bgSecondary},
      ${({ theme }) => theme.colors.bgSecondary}
    ) padding-box,
    ${({ theme, $isThinking }) =>
      $isThinking
        ? `linear-gradient(90deg, ${theme.colors.border}, ${theme.colors.accentPrimary}, ${theme.colors.border})`
        : `linear-gradient(${theme.colors.border}, ${theme.colors.border})`} border-box;
  background-size: ${({ $isThinking }) => ($isThinking ? "100% 100%, 200% 100%" : "100% 100%")};
  animation: ${({ $isThinking }) => ($isThinking ? shimmer : "none")} 1.6s linear infinite;
  text-align: left;

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

const ToolIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: ${({ theme }) => theme.spacing.sm} 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.bgSecondary};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
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

const formatThinkingDuration = (durationMs: number) => {
  if (durationMs < 1000) {
    return appMessages.messages.durationMs(Math.max(0, Math.round(durationMs)));
  }

  if (durationMs < 60000) {
    return appMessages.messages.durationS(durationMs / 1000);
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  return appMessages.messages.durationMS(
    Math.floor(totalSeconds / 60),
    totalSeconds % 60,
  );
};

const ThinkingPanel: React.FC<{ message: Message }> = ({ message }) => {
  const bodyRef = useRef<HTMLPreElement>(null);
  const hasAutoCollapsedRef = useRef(Boolean(message.content));
  const [isOpen, setIsOpen] = useState(!message.content);
  const [elapsedMs, setElapsedMs] = useState(() =>
    message.thinkingStartedAt ? Date.now() - message.thinkingStartedAt : 0,
  );
  const thinkingContent = message.thinkingContent ?? "";
  const isThinking = message.status === "streaming" && !message.content;
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
    if (!message.thinkingStartedAt) {
      setElapsedMs(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedMs(Date.now() - message.thinkingStartedAt!);
    };

    updateElapsed();
    if (!isThinking) return;

    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [isThinking, message.id, message.thinkingStartedAt]);

  useEffect(() => {
    if (message.content && !hasAutoCollapsedRef.current) {
      setIsOpen(false);
      hasAutoCollapsedRef.current = true;
    }
  }, [message.content]);

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
          {message.thinkingStartedAt ? <span>{formatThinkingDuration(elapsedMs)}</span> : null}
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
          {isThinking ? <BlinkingCursor aria-hidden="true">▌</BlinkingCursor> : null}
        </ThinkingBody>
      ) : null}
    </ThinkingPanelShell>
  );
};

const MessageBodyContent: React.FC<{ message: Message }> = ({ message }) => {
  const { status, content, thinkingContent, toolCalls, toolResults } = message;

  if (status === "error") {
    return <ErrorMessage>{content || appMessages.messages.errorFallback}</ErrorMessage>;
  }

  if (status === "streaming" && !content && !thinkingContent) {
    return (
      <ThinkingIndicator>
        <span>{appMessages.messages.thinkingInProgress}</span>
      </ThinkingIndicator>
    );
  }

  return (
    <>
      {thinkingContent ? (
        <ThinkingPanel message={message} />
      ) : null}
      {content ? (
        <MarkdownRenderer
          content={status === "streaming" ? makeStreamingMarkdownRenderable(content) : content}
        />
      ) : null}
      {toolCalls?.map((toolCall) => (
        <ToolIndicator key={toolCall.id}>Running {toolCall.name}...</ToolIndicator>
      ))}
      {toolResults?.map((toolResult) => (
        <ToolPanel key={toolResult.toolCallId}>
          <summary>
            {toolResult.success ? "Tool result" : "Tool error"}: {toolResult.toolCallId}
          </summary>
          <ToolBody>{toolResult.error ?? toolResult.output}</ToolBody>
        </ToolPanel>
      ))}
    </>
  );
};

interface MessageListProps {
  conversationId?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ conversationId }) => {
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

  const conversation = conversations.find((c) => c.id === (conversationId ?? activeConversationId));
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
                    <MessageBodyContent message={msg} />
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
