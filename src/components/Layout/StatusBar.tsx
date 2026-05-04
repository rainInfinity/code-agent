import React from 'react';
import styled from 'styled-components';
import { FaCircle } from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { messages } from '@/i18n';

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

export const StatusBar: React.FC = () => {
  const providerName = useSettingsStore((s) => s.activeProviderDefinition.name);
  const model = useSettingsStore((s) => s.providers[s.activeProviderId]?.model ?? '');
  const isConfigured = useSettingsStore((s) => s.isConfigured());
  const isStreaming = useChatStore((s) => s.isStreaming);

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
        <span>{providerName} - {model}</span>
      </StatusRight>
    </StatusBarContainer>
  );
};
