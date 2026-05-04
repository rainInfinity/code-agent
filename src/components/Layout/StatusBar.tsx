import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FaCircle, FaChartLine } from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { messages } from '@/i18n';
import {
  emitTraceConversationChanged,
  hideTraceWindow,
  isTraceWindowOpen,
  onTraceWindowClosed,
  openTraceWindow,
} from '@/hooks/useIpc';

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
  const [traceOpen, setTraceOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;

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

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setTraceOpen(false);
      return;
    }

    let cancelled = false;
    const syncTraceWindow = async () => {
      const open = await isTraceWindowOpen().catch(() => false);
      if (cancelled) return;

      if (activeTraceEnabled && !open) {
        await openTraceWindow().catch(() => {});
        await emitTraceConversationChanged(activeConversationId).catch(() => {});
        if (!cancelled) setTraceOpen(true);
        return;
      }

      if (activeTraceEnabled && open) {
        await emitTraceConversationChanged(activeConversationId).catch(() => {});
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
  }, [activeConversationId, activeTraceEnabled]);

  const toggleTrace = async () => {
    if (!activeConversationId) return;
    const currentlyOpen = await isTraceWindowOpen().catch(() => traceOpen);
    if (currentlyOpen) {
      await hideTraceWindow();
      setTraceOpen(false);
      setConversationTraceEnabled(activeConversationId, false);
    } else {
      await openTraceWindow();
      setTraceOpen(true);
      setConversationTraceEnabled(activeConversationId, true);
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
