import React, { useCallback } from 'react';
import styled from 'styled-components';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { WelcomeScreen } from './WelcomeScreen';
import { useChatStore } from '@/stores/chatStore';
import { useChat } from '@/hooks/useChat';

const PanelContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const ChatPanel: React.FC = () => {
  const { send, stop, isStreaming, isConfigured } = useChat();
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId)
  );

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
        <MessageList />
      ) : (
        <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
      )}
      <MessageInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!isConfigured}
      />
    </PanelContainer>
  );
};
