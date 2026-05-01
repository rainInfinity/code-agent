import React, { useRef, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { FaRobot, FaUser } from "react-icons/fa6";
import { useChatStore } from "@/stores/chatStore";
import { MarkdownRenderer } from "./MarkdownRenderer";

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.xl} 0;
`;

const MessageWrapper = styled.div<{ $role: string }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  max-width: 860px;
  margin: 0 auto;
  width: 100%;

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
  }
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
    $role === "user" ? theme.colors.accentPrimary : theme.colors.bgTertiary};
  color: ${({ theme, $role }) =>
    $role === "user" ? "#fff" : theme.colors.accentPrimary};
`;

const MessageContent = styled.div`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const RoleName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const ThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing.sm} 0;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.accentPrimary};
    animation: ${pulse} 1.4s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
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

export const MessageList: React.FC = () => {
  const listRef = useRef<HTMLDivElement>(null);
  const { conversations, activeConversationId } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [
    messages,
    messages.length > 0 ? messages[messages.length - 1]?.content : "",
  ]);

  if (messages.length === 0) return null;

  return (
    <ListContainer ref={listRef} className="selectable">
      {messages.map((msg) => (
        <MessageWrapper key={msg.id} $role={msg.role}>
          <Avatar $role={msg.role}>
            {msg.role === "user" ? <FaUser size={14} /> : <FaRobot size={14} />}
          </Avatar>
          <MessageContent>
            <RoleName>{msg.role === "user" ? "You" : "Assistant"}</RoleName>
            {msg.status === "error" ? (
              <ErrorMessage>{msg.content || "An error occurred"}</ErrorMessage>
            ) : msg.status === "streaming" && !msg.content ? (
              <ThinkingIndicator>
                <span />
                <span />
                <span />
              </ThinkingIndicator>
            ) : (
              <MarkdownRenderer content={msg.content} />
            )}
          </MessageContent>
        </MessageWrapper>
      ))}
    </ListContainer>
  );
};
