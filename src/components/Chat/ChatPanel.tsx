import React, { useCallback } from 'react';
import styled from 'styled-components';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { WelcomeScreen } from './WelcomeScreen';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChat } from '@/hooks/useChat';

const PanelContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const ChatPanel: React.FC = () => {
  const { send, stop, isStreaming, isConfigured } = useChat();
  const { conversations, activeConversationId, selectedWorkDir } = useChatStore();
  const { agentMode, workingDirectories, activeProviderId, providers } = useSettingsStore();
  const effectiveWorkDir = agentMode === 'code'
    ? (selectedWorkDir && workingDirectories.some((d) => d.path === selectedWorkDir)
        ? selectedWorkDir
        : workingDirectories[0]?.path ?? null)
    : null;
  const visibleConversations = agentMode === 'code'
    ? (effectiveWorkDir ? conversations.filter((c) => c.workDir === effectiveWorkDir) : [])
    : conversations.filter((c) => !c.workDir);
  const conversation = visibleConversations.find((c) => c.id === activeConversationId);
  const model = providers[activeProviderId]?.model ?? '';

  const hasMessages = conversation && conversation.messages.length > 0;

  const handleSuggestionClick = useCallback(
    (text: string) => {
      send(text);
    },
    [send]
  );

  return (
    <PanelContainer>
      {hasMessages ? (
        <MessageList conversationId={conversation.id} />
      ) : (
        <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
      )}
      <MessageInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!isConfigured}
        model={model}
      />
    </PanelContainer>
  );
};
