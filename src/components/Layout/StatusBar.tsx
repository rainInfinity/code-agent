import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FaCircle, FaChartLine } from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { messages } from '@/i18n';
import {
  emitTraceConversationChanged,
  emitTraceSyncConversations,
  hideTraceWindow,
  isTraceWindowOpen,
  onTraceClearConversation,
  onTraceDockingChanged,
  onTracePinChanged,
  onTraceWindowClosed,
  onTraceWindowReady,
  openTraceWindow,
} from '@/hooks/useIpc';
import { useTraceStore } from '@/stores/traceStore';

const StatusBarContainer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  background-color: ${({ theme }) => theme.colors.statusBarBg};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.statusBarText};
  min-height: 28px;
  flex-shrink: 0;
`;

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatusRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatusIndicator = styled.div<{ $connected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $connected }) =>
    $connected ? theme.colors.success : theme.colors.textTertiary};
`;

const StatusDot = styled(FaCircle)`
  font-size: 6px;
`;

const TraceButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  height: 22px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.accentPrimary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  background: ${({ theme, $active }) => ($active ? theme.colors.bgActive : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.accentPrimaryHover : theme.colors.statusBarText)};
  font: inherit;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  &:not(:disabled):hover {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

export const StatusBar: React.FC = () => {
  const providerName = useSettingsStore((s) => s.activeProviderDefinition.name);
  const model = useSettingsStore((s) => s.providers[s.activeProviderId]?.model ?? '');
  const isConfigured = useSettingsStore((s) => s.isConfigured());
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const activeTraceEnabled = useChatStore((s) =>
    s.conversations.find((conversation) => conversation.id === s.activeConversationId)?.traceEnabled ?? false,
  );
  const setConversationTraceEnabled = useChatStore((s) => s.setConversationTraceEnabled);
  const isPinned = useChatStore((s) => s.isTracePinned);
  const setPinned = useTraceStore((s) => s.setPinned);
  const setTraceDocked = useChatStore((s) => s.setTraceDocked);
  const [traceOpen, setTraceOpen] = useState(false);
  const previousConversationIdRef = useRef<string | null>(activeConversationId);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;
    let unlistenPin: (() => void) | undefined;
    let unlistenReady: (() => void) | undefined;
    let unlistenClear: (() => void) | undefined;
    let unlistenDocking: (() => void) | undefined;

    isTraceWindowOpen()
      .then((open) => {
        if (mounted) setTraceOpen(open);
      })
      .catch(() => {
        if (mounted) setTraceOpen(false);
      });

    onTraceWindowClosed(() => {
      setTraceOpen(false);
      const currentId = useChatStore.getState().activeConversationId;
      if (currentId) {
        useChatStore.getState().setConversationTraceEnabled(currentId, false);
      }
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => {
        unlisten = undefined;
      });

    onTracePinChanged((event) => {
      setPinned(event.isPinned);
    })
      .then((cleanup) => {
        unlistenPin = cleanup;
      })
      .catch(() => {
        unlistenPin = undefined;
      });

    onTraceDockingChanged((event) => {
      setTraceDocked(event.isDocked);
    })
      .then((cleanup) => {
        unlistenDocking = cleanup;
      })
      .catch(() => {
        unlistenDocking = undefined;
      });

    onTraceWindowReady(() => {
      const state = useChatStore.getState();
      const currentId = state.activeConversationId;
      // Sync all conversations (with turns) to the trace window's chatStore
      emitTraceSyncConversations(state.conversations).catch(() => {});
      if (currentId) {
        emitTraceConversationChanged(currentId).catch(() => {});
      }
    })
      .then((cleanup) => {
        unlistenReady = cleanup;
      })
      .catch(() => {
        unlistenReady = undefined;
      });

    onTraceClearConversation((event) => {
      const store = useChatStore.getState();
      store.clearConversationTurns(event.conversationId);
      emitTraceSyncConversations(useChatStore.getState().conversations).catch(() => {});
    })
      .then((cleanup) => {
        unlistenClear = cleanup;
      })
      .catch(() => {
        unlistenClear = undefined;
      });

    return () => {
      mounted = false;
      unlisten?.();
      unlistenPin?.();
      unlistenReady?.();
      unlistenClear?.();
      unlistenDocking?.();
    };
  }, [setPinned, setTraceDocked]);

  useEffect(() => {
    if (!activeConversationId) {
      setTraceOpen(false);
      return;
    }

    let cancelled = false;
    const previousConversationId = previousConversationIdRef.current;
    previousConversationIdRef.current = activeConversationId;

    const syncTraceWindow = async () => {
      const open = await isTraceWindowOpen().catch(() => false);
      if (cancelled) return;

      if (previousConversationId && previousConversationId !== activeConversationId && open) {
        const isTraceDocked = useChatStore.getState().isTraceDocked;
        if (isPinned || isTraceDocked) {
          setConversationTraceEnabled(activeConversationId, true);
          await emitTraceConversationChanged(activeConversationId).catch(() => {});
          const conversations = useChatStore.getState().conversations;
          await emitTraceSyncConversations(conversations).catch(() => {});
          if (!cancelled) setTraceOpen(true);
          return;
        }

        await hideTraceWindow().catch(() => {});
        setConversationTraceEnabled(previousConversationId, false);
        setConversationTraceEnabled(activeConversationId, false);
        if (!cancelled) setTraceOpen(false);
        return;
      }

      if (activeTraceEnabled && !open) {
        await openTraceWindow(activeConversationId).catch(() => {});
        await emitTraceConversationChanged(activeConversationId).catch(() => {});
        const conversations = useChatStore.getState().conversations;
        await emitTraceSyncConversations(conversations).catch(() => {});
        if (!cancelled) setTraceOpen(true);
        return;
      }

      if (activeTraceEnabled && open) {
        await emitTraceConversationChanged(activeConversationId).catch(() => {});
        const conversations = useChatStore.getState().conversations;
        await emitTraceSyncConversations(conversations).catch(() => {});
      }

      if (!activeTraceEnabled && open) {
        await hideTraceWindow().catch(() => {});
        if (!cancelled) setTraceOpen(false);
        return;
      }

      setTraceOpen(open);
    };

    void syncTraceWindow();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, activeTraceEnabled, isPinned, setConversationTraceEnabled]);

  const toggleTrace = async () => {
    if (!activeConversationId) return;
    const currentlyOpen = await isTraceWindowOpen().catch(() => traceOpen);
    if (currentlyOpen) {
      await hideTraceWindow();
      setTraceOpen(false);
      setConversationTraceEnabled(activeConversationId, false);
    } else {
      await openTraceWindow(activeConversationId);
      setTraceOpen(true);
      setConversationTraceEnabled(activeConversationId, true);
      await emitTraceConversationChanged(activeConversationId).catch(() => {});
      const conversations = useChatStore.getState().conversations;
      await emitTraceSyncConversations(conversations).catch(() => {});
    }
  };

  return (
    <StatusBarContainer>
      <StatusLeft>
        <StatusIndicator $connected={isConfigured}>
          <StatusDot />
          {isConfigured ? messages.status.connected : messages.status.notConfigured}
        </StatusIndicator>
        {isStreaming && (
          <span style={{ color: 'inherit', opacity: 0.8 }}>
            {messages.status.streaming}
          </span>
        )}
      </StatusLeft>
      <StatusRight>
        <TraceButton
          type="button"
          $active={traceOpen}
          disabled={!activeConversationId}
          title={traceOpen ? messages.status.traceClose : messages.status.traceOpen}
          onClick={() => {
            void toggleTrace();
          }}
        >
          <FaChartLine />
          {messages.status.trace}
        </TraceButton>
        <span>{providerName} - {model}</span>
      </StatusRight>
    </StatusBarContainer>
  );
};
