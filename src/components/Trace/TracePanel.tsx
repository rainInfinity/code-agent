import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FaThumbtack,
  FaArrowUp,
  FaTrash,
  FaRegWindowMaximize,
  FaRegWindowMinimize,
  FaRegWindowRestore,
  FaXmark,
} from 'react-icons/fa6';
import { messages } from '@/i18n';
import { emitTracePinChanged, hideTraceWindow, setTraceAlwaysOnTop } from '@/hooks/useIpc';
import { useTraceIpc } from '@/hooks/useTraceIpc';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import type { TurnTrace } from '@/types';
import { TraceStatusBar } from './TraceStatusBar';
import { TurnCard } from './TurnCard';

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
    ${({ $active, theme }) => ($active ? theme.colors.accentPrimary : 'transparent')};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.accentPrimaryHover : theme.colors.textSecondary};
  background: ${({ $active, theme }) => ($active ? theme.colors.bgActive : 'transparent')};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $danger, theme }) => ($danger ? theme.colors.error : theme.colors.bgHover)};
    color: ${({ $danger, theme }) =>
      $danger ? theme.colors.textInverse : theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: -2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
`;

const TurnList = styled.section`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.md};
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const EMPTY_TURNS: TurnTrace[] = [];

export const TracePanel: React.FC = () => {
  useTraceIpc();
  const conversationId = useTraceStore((state) => state.conversationId);
  const isPinned = useChatStore((state) => state.isTracePinned);
  const setPinned = useTraceStore((state) => state.setPinned);
  const alwaysOnTop = useTraceStore((state) => state.alwaysOnTop);
  const setAlwaysOnTop = useTraceStore((state) => state.setAlwaysOnTop);
  const clearTurns = useTraceStore((state) => state.clearTurns);
  const turns = useChatStore((state) =>
    state.conversations.find((conversation) => conversation.id === conversationId)?.turns ?? EMPTY_TURNS,
  );
  const window = useMemo(() => getCurrentWindow(), []);
  const [isMaximized, setIsMaximized] = useState(false);

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
    await window.toggleMaximize();
    setIsMaximized(await window.isMaximized());
  };

  const handleDoubleClick = () => {
    toggleMaximize().catch(() => {});
  };

  const stopDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const togglePinned = () => {
    const nextPinned = !isPinned;
    setPinned(nextPinned);
    emitTracePinChanged(nextPinned).catch(() => {});
  };

  const toggleAlwaysOnTop = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    setTraceAlwaysOnTop(next).catch(() => {});
  };

  const clearCurrentTurns = () => {
    if (!conversationId) return;
    clearTurns(conversationId);
  };

  return (
    <Panel>
      <Header>
        <DragSurface onMouseDown={startDragging} onDoubleClick={handleDoubleClick}>
          <Title>{messages.trace.title}</Title>
        </DragSurface>
        <WindowControls onMouseDown={stopDrag} onDoubleClick={stopDrag}>
          <WindowButton
            type="button"
            $active={isPinned}
            title={messages.trace.pinTooltip}
            aria-label={messages.trace.pinTooltip}
            aria-pressed={isPinned}
            onClick={togglePinned}
          >
            <FaThumbtack size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            $active={alwaysOnTop}
            title={messages.trace.alwaysOnTopTooltip}
            aria-label={messages.trace.alwaysOnTopTooltip}
            aria-pressed={alwaysOnTop}
            onClick={toggleAlwaysOnTop}
          >
            <FaArrowUp size={13} />
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
            title={messages.trace.minimizeTrace}
            aria-label={messages.trace.minimizeTrace}
            onClick={() => {
              window.minimize().catch(() => {});
            }}
          >
            <FaRegWindowMinimize size={13} />
          </WindowButton>
          <WindowButton
            type="button"
            title={isMaximized ? messages.trace.restoreTrace : messages.trace.maximizeTrace}
            aria-label={isMaximized ? messages.trace.restoreTrace : messages.trace.maximizeTrace}
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
      <TurnList>
        {turns.length === 0 ? (
          <EmptyState>{messages.trace.waiting}</EmptyState>
        ) : (
          turns.map((turn) => <TurnCard key={`${turn.sessionId}-${turn.turnNumber}`} turn={turn} />)
        )}
      </TurnList>
    </Panel>
  );
};
