import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FaCheck,
  FaChevronDown,
  FaCopy,
  FaRobot,
  FaUser,
  FaXmark,
} from 'react-icons/fa6';
import { useChatStore } from '@/stores/chatStore';
import { Row, Column } from '@/components/common/Flex';
import { FoldDivider } from './FoldDivider';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolTraceBlocks } from './ToolTraceBlocks';
import { useMessageFold } from '@/hooks/useMessageFold';
import { messages as appMessages } from '@/i18n';
import type { ContentBlock, Message, MessageRole, ToolTrace } from '@/types';
import { getMessageToolTraces } from '@/utils/traceUtils';

const AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 150;
const BUTTON_SMOOTH_SCROLL_MS = 700;
const MESSAGE_META_SEPARATOR = '\u001f';
const USER_SCROLL_INTENT_MS = 650;

type ScrollSnapshot = {
  distanceFromBottom: number;
  hasScrollableOverflow: boolean;
};

type FoldScrollRestore = {
  scrollHeight: number;
  scrollTop: number;
};

const getStreamingScrollSignature = (
  state: ReturnType<typeof useChatStore.getState>,
  conversationId: string | null,
) => {
  if (!conversationId) return '';

  const conversation = state.conversations.find(
    (item) => item.id === conversationId,
  );
  const messages = conversation?.messages ?? [];
  const streamingMessage = messages.find(
    (message) => message.status === 'streaming',
  );
  if (!streamingMessage) {
    const lastMessage = messages[messages.length - 1];
    return lastMessage ? `completed:${lastMessage.id}` : '';
  }

  const toolTraceSignature = (streamingMessage.toolTraces ?? [])
    .map((toolTrace) =>
      [
        toolTrace.toolCallId,
        toolTrace.status,
        toolTrace.output?.length ?? 0,
        toolTrace.error?.length ?? 0,
      ].join(':'),
    )
    .join('|');

  return [
    streamingMessage.id,
    streamingMessage.content.length,
    streamingMessage.thinkingContent?.length ?? 0,
    toolTraceSignature,
    streamingMessage.toolCalls?.length ?? 0,
    streamingMessage.toolResults?.length ?? 0,
  ].join(MESSAGE_META_SEPARATOR);
};

const ListShell = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const ListContainer = styled.div<{ $isStreaming: boolean }>`
  height: 100%;
  overflow-y: auto;
  overflow-anchor: none;
  padding: ${({ theme }) => theme.spacing.xl} 0;
  position: relative;
  scroll-behavior: ${({ $isStreaming }) => ($isStreaming ? 'auto' : 'smooth')};
`;

const MessagesContent = styled.div`
  width: 100%;
`;

const MessageWrapper = styled(Row)<{ $role: string }>`
  flex-direction: ${({ $role }) => ($role === 'user' ? 'row-reverse' : 'row')};
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

const UserMessageText = styled.pre`
  max-height: 360px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
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

const CopyButton = styled.button<{ $tone: 'idle' | 'success' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 32px;
  height: 28px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $tone }) =>
    $tone === 'success'
      ? theme.colors.success
      : $tone === 'error'
        ? theme.colors.error
        : theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  transition:
    background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme, $tone }) =>
      $tone === 'success'
        ? theme.colors.success
        : $tone === 'error'
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
  transform: translateX(-50%)
    translateY(${({ $visible }) => ($visible ? '0' : '8px')});
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
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transition:
    opacity ${({ theme }) => theme.transitions.fast},
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
    content: '';
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

const ThinkingPanelShell = styled.div<{ $isThinking: boolean }>`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background:
    linear-gradient(
        ${({ theme }) => theme.colors.bgSecondary},
        ${({ theme }) => theme.colors.bgSecondary}
      )
      padding-box,
    ${({ theme, $isThinking }) =>
        $isThinking
          ? `linear-gradient(90deg, ${theme.colors.border}, ${theme.colors.accentPrimary}, ${theme.colors.border})`
          : `linear-gradient(${theme.colors.border}, ${theme.colors.border})`}
      border-box;
  background-size: ${({ $isThinking }) =>
    $isThinking ? '100% 100%, 200% 100%' : '100% 100%'};
  animation: ${({ $isThinking }) => ($isThinking ? shimmer : 'none')} 1.6s
    linear infinite;
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

const ThinkingPanel: React.FC<{ message: Message; thinkingContent?: string }> = ({
  message,
  thinkingContent: thinkingContentProp,
}) => {
  const bodyRef = useRef<HTMLPreElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(() =>
    message.thinkingStartedAt ? Date.now() - message.thinkingStartedAt : 0,
  );
  const thinkingContent = thinkingContentProp ?? message.thinkingContent ?? '';
  const isThinking = message.status === 'streaming' && !message.content;
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
          {message.thinkingStartedAt ? (
            <span>{formatThinkingDuration(elapsedMs)}</span>
          ) : null}
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
          {isThinking ? (
            <BlinkingCursor aria-hidden="true">▌</BlinkingCursor>
          ) : null}
        </ThinkingBody>
      ) : null}
    </ThinkingPanelShell>
  );
};

const ToolResultShell = styled.details<{ $isError: boolean }>`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid
    ${({ theme, $isError }) =>
      $isError ? `${theme.colors.error}40` : theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme, $isError }) =>
    $isError ? `${theme.colors.error}10` : theme.colors.bgSecondary};
  overflow: hidden;

  summary {
    cursor: pointer;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    color: ${({ theme, $isError }) =>
      $isError ? theme.colors.error : theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }
`;

const ToolResultContent = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
`;

const ToolResultBlock: React.FC<{ block: Extract<ContentBlock, { type: 'tool_result' }> }> = ({
  block,
}) => (
  <ToolResultShell $isError={Boolean(block.isError)}>
    <summary>
      {block.isError ? `Tool error (${block.toolUseId})` : `Tool result (${block.toolUseId})`}
    </summary>
    <ToolResultContent>{block.content}</ToolResultContent>
  </ToolResultShell>
);

const buildFallbackToolTrace = (
  block: Extract<ContentBlock, { type: 'tool_use' }>,
  logicalIndex: number,
): ToolTrace => ({
  toolCallId: block.id,
  name: block.name,
  input: block.input,
  logicalIndex,
  status: 'requested',
});

const MessageBodyContent: React.FC<{ message: Message; role: MessageRole }> = ({
  message,
  role,
}) => {
  const { status, content } = message;
  const contentBlocks = message.contentBlocks ?? [];
  const toolTraces = getMessageToolTraces(message);
  const toolTraceMap = new Map(
    toolTraces.map((toolTrace) => [toolTrace.toolCallId, toolTrace]),
  );
  const hasRenderableBlocks = contentBlocks.length > 0;
  const showErrorMessage = status === 'error' && Boolean(content || !hasRenderableBlocks);

  if (status === 'streaming' && !hasRenderableBlocks) {
    return (
      <ThinkingIndicator>
        <span>{appMessages.messages.thinkingInProgress}</span>
      </ThinkingIndicator>
    );
  }

  return (
    <>
      {contentBlocks.map((block, index) => {
        switch (block.type) {
          case 'thinking':
            return (
              <ThinkingPanel
                key={`thinking-${index}`}
                message={message}
                thinkingContent={block.thinking}
              />
            );
          case 'text':
            return role === 'user' ? (
              <UserMessageText key={`text-${index}`}>{block.text}</UserMessageText>
            ) : (
              <MarkdownRenderer
                key={`text-${index}`}
                content={block.text}
                isStreaming={status === 'streaming' && index === contentBlocks.length - 1}
              />
            );
          case 'tool_use': {
            const toolTrace =
              toolTraceMap.get(block.id) ?? buildFallbackToolTrace(block, index + 1);
            return (
              <ToolTraceBlocks
                key={`tool-use-${block.id}-${index}`}
                toolTraces={[toolTrace]}
              />
            );
          }
          case 'tool_result':
            return (
              <ToolResultBlock
                key={`tool-result-${block.toolUseId}-${index}`}
                block={block}
              />
            );
          default:
            return null;
        }
      })}
      {showErrorMessage ? (
        <ErrorMessage>{content || appMessages.messages.errorFallback}</ErrorMessage>
      ) : null}
    </>
  );
};

type MessageItemProps = {
  conversationId: string;
  messageId: string;
  role: MessageRole;
  copyTone: 'idle' | 'success' | 'error';
  onCopyMessage: (messageId: string, content: string) => void;
};

const MessageItem: React.FC<MessageItemProps> = React.memo(
  ({ conversationId, messageId, role, copyTone, onCopyMessage }) => {
    const message = useChatStore((state) =>
      state.conversations
        .find((conversation) => conversation.id === conversationId)
        ?.messages.find((item) => item.id === messageId),
    );

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
            <MessageBodyContent message={message} role={role} />
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

interface MessageListProps {
  conversationId?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ conversationId }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const skipScrollEventRef = useRef(false);
  const smoothScrollUntilRef = useRef(0);
  const smoothScrollTimeoutRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const needsFollowUpScrollRef = useRef(false);
  const userScrollIntentUntilRef = useRef(0);
  const pendingScrollSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const pendingFoldScrollRestoreRef = useRef<FoldScrollRestore | null>(null);
  const wasStreamingRef = useRef(false);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastUserMessageIdRef = useRef<string | null>(null);
  const [copyState, setCopyState] = useState<
    Record<string, 'success' | 'error'>
  >({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId,
  );
  const targetConversationId = conversationId ?? activeConversationId;
  const { messages, visibleMessages, foldInfo, loadMore, expandAll } =
    useMessageFold(targetConversationId);
  const messageCount = visibleMessages.length;
  const isStreaming = messages.some(
    (message) => message.status === 'streaming',
  );
  const lastMessage = messages[messages.length - 1];
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');

  const getDistanceFromBottom = useCallback((el: HTMLDivElement) => {
    return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  }, []);

  const isNearBottom = useCallback(
    (el: HTMLDivElement) => {
      return getDistanceFromBottom(el) <= AUTO_FOLLOW_BOTTOM_THRESHOLD_PX;
    },
    [getDistanceFromBottom],
  );

  const getScrollSnapshot = useCallback(
    (el: HTMLDivElement): ScrollSnapshot => {
      return {
        distanceFromBottom: getDistanceFromBottom(el),
        hasScrollableOverflow: el.scrollHeight > el.clientHeight + 1,
      };
    },
    [getDistanceFromBottom],
  );

  const shouldFollowFromSnapshot = useCallback(
    (snapshot: ScrollSnapshot | null) => {
      return Boolean(
        snapshot &&
        (!snapshot.hasScrollableOverflow ||
          snapshot.distanceFromBottom <= AUTO_FOLLOW_BOTTOM_THRESHOLD_PX),
      );
    },
    [],
  );

  const capturePendingScrollSnapshot = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    const snapshot = getScrollSnapshot(el);
    pendingScrollSnapshotRef.current = snapshot;
    if (shouldFollowFromSnapshot(snapshot)) {
      autoFollowRef.current = true;
    }
  }, [getScrollSnapshot, shouldFollowFromSnapshot]);

  const markUserScrollIntent = useCallback(() => {
    skipScrollEventRef.current = false;
    userScrollIntentUntilRef.current = Date.now() + USER_SCROLL_INTENT_MS;
  }, []);

  const captureFoldScrollRestore = useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    autoFollowRef.current = false;
    pendingScrollSnapshotRef.current = null;
    pendingFoldScrollRestoreRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
    userScrollIntentUntilRef.current = Date.now() + USER_SCROLL_INTENT_MS;
  }, []);

  const scrollToBottomInstant = useCallback(
    (force = false) => {
      if (!force && !isStreaming && Date.now() < smoothScrollUntilRef.current) {
        return;
      }

      const el = listRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    },
    [isStreaming],
  );

  const updateScrollAffordance = useCallback(() => {
    if (skipScrollEventRef.current) return;

    const el = listRef.current;
    if (!el) return;

    if (Date.now() < smoothScrollUntilRef.current) {
      autoFollowRef.current = true;
      setShowScrollToBottom(false);
      return;
    }

    const distanceFromBottom = getDistanceFromBottom(el);
    const isAtBottomRange =
      distanceFromBottom <= AUTO_FOLLOW_BOTTOM_THRESHOLD_PX;
    const hasUserScrollIntent = Date.now() < userScrollIntentUntilRef.current;

    if (isAtBottomRange) {
      autoFollowRef.current = true;
    } else if (hasUserScrollIntent || !isStreaming) {
      autoFollowRef.current = false;
    }

    setShowScrollToBottom(messageCount > 0 && !autoFollowRef.current);
  }, [getDistanceFromBottom, isStreaming, messageCount]);

  const copyMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopyState((state) => ({ ...state, [messageId]: 'success' }));
      } catch {
        setCopyState((state) => ({ ...state, [messageId]: 'error' }));
      }

      window.setTimeout(() => {
        setCopyState((state) => {
          const { [messageId]: _ignored, ...nextState } = state;
          return nextState;
        });
      }, 1600);
    },
    [],
  );

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

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, [scrollToBottomInstant, updateScrollAffordance]);

  const handleLoadMore = useCallback(() => {
    captureFoldScrollRestore();
    loadMore();
  }, [captureFoldScrollRestore, loadMore]);

  const handleExpandAll = useCallback(() => {
    captureFoldScrollRestore();
    expandAll();
  }, [captureFoldScrollRestore, expandAll]);

  useLayoutEffect(() => {
    const pendingRestore = pendingFoldScrollRestoreRef.current;
    const el = listRef.current;
    if (!pendingRestore || !el) return;

    pendingFoldScrollRestoreRef.current = null;
    skipScrollEventRef.current = true;
    el.scrollTop =
      pendingRestore.scrollTop +
      (el.scrollHeight - pendingRestore.scrollHeight);

    const frameId = window.requestAnimationFrame(() => {
      skipScrollEventRef.current = false;
      updateScrollAffordance();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [updateScrollAffordance, visibleMessages.length]);

  useLayoutEffect(() => {
    const conversationChanged =
      previousConversationIdRef.current !== targetConversationId;
    const lastUserMessageChanged =
      previousLastUserMessageIdRef.current !== (lastUserMessage?.id ?? null);
    const userSentMessage = lastUserMessageChanged && Boolean(lastUserMessage);

    if (conversationChanged || userSentMessage) {
      autoFollowRef.current = true;
      pendingScrollSnapshotRef.current = null;
      pendingFoldScrollRestoreRef.current = null;
      scrollToBottomInstant(true);
      setShowScrollToBottom(false);
    }

    previousConversationIdRef.current = targetConversationId ?? null;
    previousLastUserMessageIdRef.current = lastUserMessage?.id ?? null;
  }, [targetConversationId, lastUserMessage?.id, scrollToBottomInstant]);

  const syncScrollInFrame = useCallback(
    (force = false) => {
      if (scrollFrameRef.current !== null) {
        needsFollowUpScrollRef.current = true;
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        try {
          const el = listRef.current;
          const pendingSnapshot = pendingScrollSnapshotRef.current;
          pendingScrollSnapshotRef.current = null;
          const shouldFollow =
            force ||
            autoFollowRef.current ||
            shouldFollowFromSnapshot(pendingSnapshot) ||
            (el ? isNearBottom(el) : false);

          if (shouldFollow) {
            autoFollowRef.current = true;
            skipScrollEventRef.current = true;
            const previousHeight = el?.scrollHeight ?? 0;
            scrollToBottomInstant(force);
            const nextHeight = listRef.current?.scrollHeight ?? 0;
            if (nextHeight !== previousHeight) {
              scrollToBottomInstant(true);
            }
          }
          if (needsFollowUpScrollRef.current) {
            needsFollowUpScrollRef.current = false;
            syncScrollInFrame();
          }
          updateScrollAffordance();
        } finally {
          skipScrollEventRef.current = false;
        }
      });
    },
    [
      isNearBottom,
      scrollToBottomInstant,
      shouldFollowFromSnapshot,
      updateScrollAffordance,
    ],
  );

  useEffect(() => {
    const contentEl = contentRef.current;
    const listEl = listRef.current;
    if (!contentEl && !listEl) return;

    const observer = new ResizeObserver(() => {
      syncScrollInFrame();
    });

    if (contentEl) observer.observe(contentEl);
    if (listEl) observer.observe(listEl);
    return () => observer.disconnect();
  }, [syncScrollInFrame]);

  useEffect(() => {
    let previousSignature = getStreamingScrollSignature(
      useChatStore.getState(),
      targetConversationId,
    );

    return useChatStore.subscribe((state) => {
      const nextSignature = getStreamingScrollSignature(
        state,
        targetConversationId,
      );
      if (nextSignature && nextSignature !== previousSignature) {
        const el = listRef.current;
        capturePendingScrollSnapshot();
        if (el && isNearBottom(el)) {
          autoFollowRef.current = true;
        }
        syncScrollInFrame();
      }
      previousSignature = nextSignature;
    });
  }, [
    capturePendingScrollSnapshot,
    isNearBottom,
    targetConversationId,
    syncScrollInFrame,
  ]);

  useEffect(() => {
    return () => {
      if (smoothScrollTimeoutRef.current !== null) {
        window.clearTimeout(smoothScrollTimeoutRef.current);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      needsFollowUpScrollRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    let frameId: number | null = null;
    let releaseSkipFrameId: number | null = null;

    const releaseSkipScrollEvent = () => {
      if (releaseSkipFrameId !== null) {
        window.cancelAnimationFrame(releaseSkipFrameId);
      }

      releaseSkipFrameId = window.requestAnimationFrame(() => {
        releaseSkipFrameId = null;
        skipScrollEventRef.current = false;
        updateScrollAffordance();
      });
    };

    const keepPinnedToBottom = () => {
      frameId = null;

      const el = listRef.current;
      const hasUserScrollIntent = Date.now() < userScrollIntentUntilRef.current;

      if (el && autoFollowRef.current && !hasUserScrollIntent) {
        skipScrollEventRef.current = true;
        el.scrollTop = el.scrollHeight;
        releaseSkipScrollEvent();
      }

      frameId = window.requestAnimationFrame(keepPinnedToBottom);
    };

    frameId = window.requestAnimationFrame(keepPinnedToBottom);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (releaseSkipFrameId !== null) {
        window.cancelAnimationFrame(releaseSkipFrameId);
      }
      skipScrollEventRef.current = false;
    };
  }, [isStreaming, updateScrollAffordance]);

  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const timeout = window.setTimeout(() => {
        syncScrollInFrame(true);
      }, 50);
      wasStreamingRef.current = false;
      return () => window.clearTimeout(timeout);
    }
    wasStreamingRef.current = isStreaming;
    syncScrollInFrame();
  }, [isStreaming, lastMessage?.id, syncScrollInFrame]);

  if (!targetConversationId || messages.length === 0) return null;

  return (
    <ListShell>
      <ListContainer
        ref={listRef}
        className="selectable"
        onScroll={updateScrollAffordance}
        onWheel={markUserScrollIntent}
        onPointerDown={markUserScrollIntent}
        onTouchStart={markUserScrollIntent}
        onKeyDown={markUserScrollIntent}
        $isStreaming={isStreaming}
      >
        <MessagesContent ref={contentRef}>
          {foldInfo.isFolded ? (
            <FoldDivider
              foldedTurnCount={foldInfo.foldedTurnCount}
              estimatedTokens={foldInfo.hiddenTokenCount}
              loadMoreTurns={foldInfo.loadMoreTurnCount}
              onLoadMore={handleLoadMore}
              onExpandAll={handleExpandAll}
            />
          ) : null}
          {visibleMessages.map((message) => (
            <MessageItem
              key={message.id}
              conversationId={targetConversationId}
              messageId={message.id}
              role={message.role}
              copyTone={copyState[message.id] ?? 'idle'}
              onCopyMessage={copyMessage}
            />
          ))}
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
