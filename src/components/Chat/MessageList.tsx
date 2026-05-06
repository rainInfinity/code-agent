import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import { cva } from 'class-variance-authority';
import { FaChevronDown } from 'react-icons/fa6';
import { focusRing } from '@/styles/mixins';
import { useChatStore } from '@/stores/chatStore';
import { FoldDivider } from '@/components/common/FoldDivider';
import { MessageItem } from './MessageItem';
import { useMessageFold } from '@/hooks/useMessageFold';
import { messages as appMessages } from '@/i18n';
import { cn } from '@/utils/cn';

const AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 150;
const BUTTON_SMOOTH_SCROLL_MS = 700;
const MESSAGE_META_SEPARATOR = '';
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
  const turnSignature = (conversation?.turns ?? [])
    .filter((turn) => turn.assistantMessageId === streamingMessage.id)
    .map((turn) =>
      [
        turn.turnNumber,
        turn.status,
        turn.thinking.status,
        turn.thinking.content.length,
        turn.response.content.length,
        turn.tools
          .map((toolTrace) =>
            [
              toolTrace.toolCallId,
              toolTrace.status,
              toolTrace.output?.length ?? 0,
              toolTrace.error?.length ?? 0,
            ].join(':'),
          )
          .join('~'),
      ].join(':'),
    )
    .join('|');

  return [
    streamingMessage.id,
    streamingMessage.content.length,
    turnSignature,
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

const scrollButtonVariants = cva('', {
  variants: {
    visible: {
      true: 'scroll-visible',
      false: 'scroll-hidden',
    },
  },
});

const ScrollToBottomButton = styled.button.attrs<{ $visible: boolean }>(
  ({ $visible }) => ({
    className: cn(scrollButtonVariants({ visible: $visible })),
  }),
)<{ $visible: boolean }>`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing.md};
  left: 50%;
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
  transition:
    opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  &.scroll-visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  &.scroll-hidden {
    transform: translateX(-50%) translateY(8px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgTertiary};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  ${focusRing}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: translateX(-50%);
  }
`;

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
