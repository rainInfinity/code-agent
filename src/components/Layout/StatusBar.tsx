import React from 'react';
import styled from 'styled-components';
import { FaCircle } from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';

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
  const model = useSettingsStore((s) => s.model);
  const isConfigured = useSettingsStore((s) => s.isConfigured());
  const isStreaming = useChatStore((s) => s.isStreaming);

  return (
    <StatusBarContainer>
      <StatusLeft>
        <StatusIndicator $connected={isConfigured}>
          <StatusDot />
          {isConfigured ? 'Connected' : 'Not configured'}
        </StatusIndicator>
        {isStreaming && (
          <span style={{ color: 'inherit', opacity: 0.8 }}>
            Streaming...
          </span>
        )}
      </StatusLeft>
      <StatusRight>
        <span>{model}</span>
      </StatusRight>
    </StatusBarContainer>
  );
};
