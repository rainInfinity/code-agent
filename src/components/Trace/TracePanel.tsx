import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FaThumbtack,
  FaArrowDown,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaRegWindowMaximize,
  FaRegWindowMinimize,
  FaRegWindowRestore,
  FaAlignLeft,
  FaAlignRight,
  FaWindowRestore,
  FaXmark,
} from 'react-icons/fa6';
import { messages } from '@/i18n';
import { FoldDivider } from '@/components/common/FoldDivider';
import {
  emitTraceClearConversation,
  emitTracePinChanged,
  hideTraceWindow,
  setTraceDockingMode,
  setTraceAlwaysOnTop,
} from '@/hooks/useIpc';
import { useTurnFold } from '@/hooks/useTurnFold';
import { useTraceIpc } from '@/hooks/useTraceIpc';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import type { TurnTrace } from '@/types';
import { TraceStatusBar } from './TraceStatusBar';
import { TurnCard } from './TurnCard';

const TRACE_AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 150;
const TRACE_USER_SCROLL_INTENT_MS = 650;
const TRACE_COLLAPSE_ALL_LABEL = '\u5168\u90e8\u6536\u8d77';
const TRACE_EXPAND_ALL_LABEL = '\u5168\u90e8\u6253\u5f00';
const TRACE_FOLLOW_LATEST_LABEL = '\u8ddf\u968f\u6700\u65b0';
const TRACE_PIN_AND_TOP_LABEL = '\u4fdd\u6301\u6253\u5f00\u5e76\u7f6e\u9876';

const getTurnKey = (turn: TurnTrace) => `${turn.sessionId}-${turn.turnNumber}`;

type FoldScrollRestore = {
  scrollHeight: number;
  scrollTop: number;
};

const Panel = styled.main`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
  background: ${({ theme }) => theme.colors.bgPrimary};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Header = styled.header`
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  height: 42px;
  min-height: 42px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSecondary};
  user-select: none;
`;

const DragSurface = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const WindowControls = styled.div`
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
`;

const WindowButton = styled.button<{ $danger?: boolean; $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 100%;
  border-left: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.accentPrimary : 'transparent'};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.accentPrimaryHover : theme.colors.textSecondary};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.bgActive : 'transparent'};
  transition:
    background-color ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ $danger, theme }) =>
      $danger ? theme.colors.error : theme.colors.bgHover};
    color: ${({ $danger, theme }) =>
      $danger ? theme.colors.textInverse : theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: -2px;
  }

  &:disabled {
    cursor: default;
    opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  }
`;

const TurnList = styled.section`
  flex: 1;
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  padding: ${({ theme }) => theme.spacing.md};
`;

const TurnListContent = styled.div`
  min-height: 100%;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

export const TracePanel: React.FC = () => {
  useTraceIpc();
  const turnListRef = useRef<HTMLElement>(null);
  const turnListContentRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const skipScrollEventRef = useRef(false);
  const userScrollIntentUntilRef = useRef(0);
  const pendingFoldScrollRestoreRef = useRef<FoldScrollRestore | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastTurnKeyRef = useRef<string | null>(null);
  const knownTurnKeysRef = useRef<Set<string>>(new Set());
  const conversationId = useTraceStore((state) => state.conversationId);
  const isPinned = useChatStore((state) => state.isTracePinned);
  const setPinned = useTraceStore((state) => state.setPinned);
  const alwaysOnTop = useTraceStore((state) => state.alwaysOnTop);
  const setAlwaysOnTop = useTraceStore((state) => state.setAlwaysOnTop);
  const docking = useTraceStore((state) => state.docking);
  const setDocking = useTraceStore((state) => state.setDocking);
  const clearTurns = useTraceStore((state) => state.clearTurns);
  const { turns, visibleTurns, foldInfo, loadMore, expandAll } =
    useTurnFold(conversationId);
  const window = useMemo(() => getCurrentWindow(), []);
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedTurnKeys, setExpandedTurnKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [followLatestOnly, setFollowLatestOnly] = useState(false);
  const currentTurn = turns[turns.length - 1];
  const isTraceRunning = currentTurn?.status === 'running';
  const turnKeys = useMemo(() => turns.map(getTurnKey), [turns]);
  const lastTurnKey = currentTurn ? getTurnKey(currentTurn) : null;
  const allTurnsExpanded =
    turnKeys.length > 0 &&
    turnKeys.every((turnKey) => expandedTurnKeys.has(turnKey));
  const expandCollapseLabel = allTurnsExpanded
    ? TRACE_COLLAPSE_ALL_LABEL
    : TRACE_EXPAND_ALL_LABEL;
  const isDocked = docking.isDocked;
  const pinAndTopActive = isDocked || (isPinned && alwaysOnTop);

  const getDistanceFromBottom = useCallback((el: HTMLElement) => {
    return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  }, []);

  const isNearBottom = useCallback(
    (el: HTMLElement) => {
      return getDistanceFromBottom(el) <= TRACE_AUTO_FOLLOW_BOTTOM_THRESHOLD_PX;
    },
    [getDistanceFromBottom],
  );

  const scrollTraceToBottom = useCallback(() => {
    const el = turnListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const updateAutoFollowState = useCallback(() => {
    if (skipScrollEventRef.current) return;

    const el = turnListRef.current;
    if (!el) return;

    if (followLatestOnly) {
      autoFollowRef.current = true;
      return;
    }

    const distanceFromBottom = getDistanceFromBottom(el);
    const isAtBottomRange =
      distanceFromBottom <= TRACE_AUTO_FOLLOW_BOTTOM_THRESHOLD_PX;
    const hasUserScrollIntent = Date.now() < userScrollIntentUntilRef.current;

    if (isAtBottomRange) {
      autoFollowRef.current = true;
    } else if (hasUserScrollIntent || !isTraceRunning) {
      autoFollowRef.current = false;
    }
  }, [followLatestOnly, getDistanceFromBottom, isTraceRunning]);

  const syncTraceScrollInFrame = useCallback(
    (force = false) => {
      globalThis.window.requestAnimationFrame(() => {
        const el = turnListRef.current;
        const shouldFollow =
          force || autoFollowRef.current || (el ? isNearBottom(el) : false);

        if (shouldFollow) {
          autoFollowRef.current = true;
          skipScrollEventRef.current = true;
          scrollTraceToBottom();
          globalThis.window.requestAnimationFrame(() => {
            skipScrollEventRef.current = false;
            updateAutoFollowState();
          });
        } else {
          updateAutoFollowState();
        }
      });
    },
    [isNearBottom, scrollTraceToBottom, updateAutoFollowState],
  );

  const markUserScrollIntent = useCallback(() => {
    skipScrollEventRef.current = false;
    userScrollIntentUntilRef.current = Date.now() + TRACE_USER_SCROLL_INTENT_MS;
  }, []);

  const captureFoldScrollRestore = useCallback(() => {
    const el = turnListRef.current;
    if (!el) return;

    autoFollowRef.current = false;
    pendingFoldScrollRestoreRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
    userScrollIntentUntilRef.current = Date.now() + TRACE_USER_SCROLL_INTENT_MS;
  }, []);

  const markScrollbarPointerIntent = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      markUserScrollIntent();
    },
    [markUserScrollIntent],
  );

  const handleLoadMoreTurns = useCallback(() => {
    setFollowLatestOnly(false);
    captureFoldScrollRestore();
    loadMore();
  }, [captureFoldScrollRestore, loadMore]);

  const handleExpandAllTurns = useCallback(() => {
    setFollowLatestOnly(false);
    captureFoldScrollRestore();
    expandAll();
  }, [captureFoldScrollRestore, expandAll]);

  const toggleAllTurnsExpanded = useCallback(() => {
    setFollowLatestOnly(false);
    setExpandedTurnKeys(allTurnsExpanded ? new Set() : new Set(turnKeys));
  }, [allTurnsExpanded, turnKeys]);

  const toggleFollowLatestTurn = useCallback(() => {
    setFollowLatestOnly((current) => {
      const next = !current;
      if (next) {
        setExpandedTurnKeys(lastTurnKey ? new Set([lastTurnKey]) : new Set());
        autoFollowRef.current = true;
        userScrollIntentUntilRef.current = 0;
        syncTraceScrollInFrame(true);
      }

      return next;
    });
  }, [lastTurnKey, syncTraceScrollInFrame]);

  const setTurnExpanded = useCallback((turnKey: string, expanded: boolean) => {
    setFollowLatestOnly(false);
    setExpandedTurnKeys((current) => {
      const next = new Set(current);
      if (expanded) {
        next.add(turnKey);
      } else {
        next.delete(turnKey);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const previousTurnKeys = knownTurnKeysRef.current;
    const availableTurnKeys = new Set(turnKeys);
    knownTurnKeysRef.current = availableTurnKeys;

    setExpandedTurnKeys((current) => {
      if (followLatestOnly) {
        return lastTurnKey ? new Set([lastTurnKey]) : new Set();
      }

      let changed = false;
      const next = new Set<string>();

      current.forEach((turnKey) => {
        if (availableTurnKeys.has(turnKey)) {
          next.add(turnKey);
        } else {
          changed = true;
        }
      });

      turnKeys.forEach((turnKey) => {
        if (!previousTurnKeys.has(turnKey)) {
          next.add(turnKey);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [followLatestOnly, lastTurnKey, turnKeys]);

  useEffect(() => {
    if (!followLatestOnly) return;

    autoFollowRef.current = true;
    userScrollIntentUntilRef.current = 0;
    syncTraceScrollInFrame(true);
  }, [followLatestOnly, lastTurnKey, syncTraceScrollInFrame]);

  useLayoutEffect(() => {
    const pendingRestore = pendingFoldScrollRestoreRef.current;
    const el = turnListRef.current;
    if (!pendingRestore || !el) return;

    pendingFoldScrollRestoreRef.current = null;
    skipScrollEventRef.current = true;
    el.scrollTop =
      pendingRestore.scrollTop +
      (el.scrollHeight - pendingRestore.scrollHeight);

    const frameId = globalThis.window.requestAnimationFrame(() => {
      skipScrollEventRef.current = false;
      updateAutoFollowState();
    });

    return () => globalThis.window.cancelAnimationFrame(frameId);
  }, [updateAutoFollowState, visibleTurns.length]);

  useLayoutEffect(() => {
    const conversationChanged =
      previousConversationIdRef.current !== conversationId;
    const lastTurnChanged = previousLastTurnKeyRef.current !== lastTurnKey;

    if (conversationChanged || lastTurnChanged) {
      autoFollowRef.current = true;
      pendingFoldScrollRestoreRef.current = null;
      syncTraceScrollInFrame(true);
    }

    previousConversationIdRef.current = conversationId;
    previousLastTurnKeyRef.current = lastTurnKey;
  }, [conversationId, lastTurnKey, syncTraceScrollInFrame]);

  useEffect(() => {
    const listEl = turnListRef.current;
    const contentEl = turnListContentRef.current;
    if (!listEl && !contentEl) return;

    const observer = new ResizeObserver(() => {
      syncTraceScrollInFrame();
    });

    if (listEl) observer.observe(listEl);
    if (contentEl) observer.observe(contentEl);

    return () => observer.disconnect();
  }, [syncTraceScrollInFrame]);

  useEffect(() => {
    if (!isTraceRunning) {
      syncTraceScrollInFrame();
      return;
    }

    let frameId: number | null = null;
    let releaseSkipFrameId: number | null = null;

    const releaseSkipScrollEvent = () => {
      if (releaseSkipFrameId !== null) {
        globalThis.window.cancelAnimationFrame(releaseSkipFrameId);
      }

      releaseSkipFrameId = globalThis.window.requestAnimationFrame(() => {
        releaseSkipFrameId = null;
        skipScrollEventRef.current = false;
        updateAutoFollowState();
      });
    };

    const keepPinnedToBottom = () => {
      frameId = null;

      const el = turnListRef.current;
      const hasUserScrollIntent = Date.now() < userScrollIntentUntilRef.current;

      if (el && autoFollowRef.current && !hasUserScrollIntent) {
        skipScrollEventRef.current = true;
        el.scrollTop = el.scrollHeight;
        releaseSkipScrollEvent();
      }

      frameId = globalThis.window.requestAnimationFrame(keepPinnedToBottom);
    };

    frameId = globalThis.window.requestAnimationFrame(keepPinnedToBottom);

    return () => {
      if (frameId !== null) {
        globalThis.window.cancelAnimationFrame(frameId);
      }
      if (releaseSkipFrameId !== null) {
        globalThis.window.cancelAnimationFrame(releaseSkipFrameId);
      }
      skipScrollEventRef.current = false;
    };
  }, [isTraceRunning, syncTraceScrollInFrame, updateAutoFollowState]);

  useEffect(() => {
    let cleanupResize: (() => void) | undefined;
    let cleanupMove: (() => void) | undefined;
    let cancelled = false;

    const syncMaximizedState = async () => {
      const maximized = await window.isMaximized();
      if (!cancelled) {
        setIsMaximized(maximized);
      }
    };

    syncMaximizedState().catch(() => {});
    window.onResized(syncMaximizedState).then((unlisten) => {
      cleanupResize = unlisten;
    });
    window.onMoved(syncMaximizedState).then((unlisten) => {
      cleanupMove = unlisten;
    });

    return () => {
      cancelled = true;
      cleanupResize?.();
      cleanupMove?.();
    };
  }, [window]);

  const startDragging = (event: React.MouseEvent) => {
    if (event.button !== 0 || event.detail > 1) return;
    window.startDragging().catch(() => {});
  };

  const toggleMaximize = async () => {
    if (isDocked) return;
    await window.toggleMaximize();
    setIsMaximized(await window.isMaximized());
  };

  const handleDoubleClick = () => {
    if (isDocked) return;
    toggleMaximize().catch(() => {});
  };

  const stopDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const togglePinAndAlwaysOnTop = () => {
    if (isDocked) return;
    const next = !pinAndTopActive;
    setPinned(next);
    setAlwaysOnTop(next);
    emitTracePinChanged(next).catch(() => {});
    setTraceAlwaysOnTop(next).catch(() => {});
  };

  const changeDockingMode = (side: 'left' | 'right' | null) => {
    setTraceDockingMode(side)
      .then((state) => setDocking(state))
      .catch(() => {});
  };

  const clearCurrentTurns = () => {
    if (!conversationId) return;
    clearTurns(conversationId);
    emitTraceClearConversation(conversationId).catch(() => {});
  };

  return (
    <Panel>
      <Header>
        <DragSurface
          onMouseDown={startDragging}
          onDoubleClick={handleDoubleClick}
        >
          <Title>{messages.trace.title}</Title>
        </DragSurface>
        <WindowControls onMouseDown={stopDrag} onDoubleClick={stopDrag}>
          <WindowButton
            type="button"
            $active={allTurnsExpanded}
            disabled={turns.length === 0}
            title={expandCollapseLabel}
            aria-label={expandCollapseLabel}
            aria-pressed={allTurnsExpanded}
            onClick={toggleAllTurnsExpanded}
          >
            {allTurnsExpanded ? (
              <FaChevronUp size={13} />
            ) : (
              <FaChevronDown size={13} />
            )}
          </WindowButton>
          <WindowButton
            type="button"
            $active={followLatestOnly}
            disabled={turns.length === 0}
            title={TRACE_FOLLOW_LATEST_LABEL}
            aria-label={TRACE_FOLLOW_LATEST_LABEL}
            aria-pressed={followLatestOnly}
            onClick={toggleFollowLatestTurn}
          >
            <FaArrowDown size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            $active={!isDocked}
            title={messages.trace.dockDetached}
            aria-label={messages.trace.dockDetached}
            aria-pressed={!isDocked}
            onClick={() => changeDockingMode(null)}
          >
            <FaWindowRestore size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            $active={docking.side === 'left'}
            title={messages.trace.dockLeft}
            aria-label={messages.trace.dockLeft}
            aria-pressed={docking.side === 'left'}
            onClick={() => changeDockingMode('left')}
          >
            <FaAlignLeft size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            $active={docking.side === 'right'}
            title={messages.trace.dockRight}
            aria-label={messages.trace.dockRight}
            aria-pressed={docking.side === 'right'}
            onClick={() => changeDockingMode('right')}
          >
            <FaAlignRight size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            $active={pinAndTopActive}
            disabled={isDocked}
            title={
              isDocked
                ? messages.trace.alwaysOnTopForcedByDocking
                : TRACE_PIN_AND_TOP_LABEL
            }
            aria-label={
              isDocked
                ? messages.trace.alwaysOnTopForcedByDocking
                : TRACE_PIN_AND_TOP_LABEL
            }
            aria-pressed={pinAndTopActive}
            onClick={togglePinAndAlwaysOnTop}
          >
            <FaThumbtack size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            disabled={!conversationId || turns.length === 0}
            title={messages.trace.clearTraceTooltip}
            aria-label={messages.trace.clearTraceTooltip}
            onClick={clearCurrentTurns}
          >
            <FaTrash size={12} />
          </WindowButton>
          <WindowButton
            type="button"
            disabled={isDocked}
            title={
              isDocked
                ? messages.trace.minimizeDisabledWhenDocked
                : messages.trace.minimizeTrace
            }
            aria-label={
              isDocked
                ? messages.trace.minimizeDisabledWhenDocked
                : messages.trace.minimizeTrace
            }
            onClick={() => {
              if (isDocked) return;
              window.minimize().catch(() => {});
            }}
          >
            <FaRegWindowMinimize size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            disabled={isDocked}
            title={
              isDocked
                ? messages.trace.maximizeDisabledWhenDocked
                : isMaximized
                  ? messages.trace.restoreTrace
                  : messages.trace.maximizeTrace
            }
            aria-label={
              isDocked
                ? messages.trace.maximizeDisabledWhenDocked
                : isMaximized
                  ? messages.trace.restoreTrace
                  : messages.trace.maximizeTrace
            }
            onClick={() => {
              toggleMaximize().catch(() => {});
            }}
          >
            {isMaximized ? (
              <FaRegWindowRestore size={13} />
            ) : (
              <FaRegWindowMaximize size={13} />
            )}
          </WindowButton>
          <WindowButton
            type="button"
            $danger
            title={messages.trace.closeTrace}
            aria-label={messages.trace.closeTrace}
            onClick={() => {
              hideTraceWindow().catch(() => {});
            }}
          >
            <FaXmark size={15} />
          </WindowButton>
        </WindowControls>
      </Header>
      <TraceStatusBar />
      <TurnList
        ref={turnListRef}
        onScroll={updateAutoFollowState}
        onWheel={markUserScrollIntent}
        onPointerDown={markScrollbarPointerIntent}
        onTouchStart={markUserScrollIntent}
        onKeyDown={markUserScrollIntent}
        tabIndex={-1}
      >
        <TurnListContent ref={turnListContentRef}>
          {turns.length === 0 ? (
            <EmptyState>{messages.trace.waiting}</EmptyState>
          ) : (
            <>
              {foldInfo.isFolded ? (
                <FoldDivider
                  foldedTurnCount={foldInfo.foldedTurnCount}
                  estimatedTokens={foldInfo.hiddenTokenCount}
                  loadMoreTurns={foldInfo.loadMoreTurnCount}
                  onLoadMore={handleLoadMoreTurns}
                  onExpandAll={handleExpandAllTurns}
                />
              ) : null}
              {visibleTurns.map((turn) => {
                const turnKey = getTurnKey(turn);
                return (
                  <TurnCard
                    key={turnKey}
                    turn={turn}
                    expanded={expandedTurnKeys.has(turnKey)}
                    onExpandedChange={(expanded) =>
                      setTurnExpanded(turnKey, expanded)
                    }
                  />
                );
              })}
            </>
          )}
        </TurnListContent>
      </TurnList>
    </Panel>
  );
};
