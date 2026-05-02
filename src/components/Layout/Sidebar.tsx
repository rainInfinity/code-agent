import React from 'react';
import styled from 'styled-components';
import {
  FaPlus,
  FaGear,
  FaComments,
  FaTrashCan,
} from 'react-icons/fa6';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { messages } from '@/i18n';
import { Column, Row } from '@/components/common/Flex';

const SidebarContainer = styled(Column)<{ $collapsed: boolean }>`
  width: ${({ $collapsed }) => ($collapsed ? '0px' : '260px')};
  min-width: ${({ $collapsed }) => ($collapsed ? '0px' : '260px')};
  height: 100%;
  background-color: ${({ theme }) => theme.colors.sidebarBg};
  border-right: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
  overflow: hidden;
  transition: width ${({ theme }) => theme.transitions.normal},
    min-width ${({ theme }) => theme.transitions.normal};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const SidebarContent = styled(Column)<{ $collapsed: boolean }>`
  width: 260px;
  min-width: 260px;
  height: 100%;
  opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
  transform: translateX(${({ $collapsed }) => ($collapsed ? '-12px' : '0')});
  visibility: ${({ $collapsed }) => ($collapsed ? 'hidden' : 'visible')};
  transition: opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.normal},
    visibility ${({ theme }) => theme.transitions.fast};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`;

const SidebarActions = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

const NewChatButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.sidebarHover};
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const ConversationList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm};
`;

const ConversationItem = styled(Row).attrs({ as: 'button' })<{ $active: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.sidebarActive : 'transparent'};
  text-align: left;
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};
  position: relative;
  min-height: 36px;

  &:hover {
    background-color: ${({ theme, $active }) =>
      $active ? theme.colors.sidebarActive : theme.colors.sidebarHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const ConversationTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textTertiary};
  flex-shrink: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast},
    opacity ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  ${ConversationItem}:hover &,
  ${ConversationItem}:focus-within & {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.error};
    background-color: ${({ theme }) => theme.colors.bgActive};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const SidebarFooter = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.sidebarHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

interface SidebarProps {
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
  } = useChatStore();

  const { sidebarCollapsed } = useSettingsStore();
  const collapsedTabIndex = sidebarCollapsed ? -1 : 0;

  return (
    <>
      <SidebarContainer $collapsed={sidebarCollapsed} aria-hidden={sidebarCollapsed}>
        <SidebarContent $collapsed={sidebarCollapsed}>
          <SidebarActions>
            <NewChatButton onClick={() => createConversation()} tabIndex={collapsedTabIndex}>
              <FaPlus size={12} />
              {messages.sidebar.newChat}
            </NewChatButton>
          </SidebarActions>

          <ConversationList>
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                $active={conv.id === activeConversationId}
                $align="center"
                $gap="sm"
                onClick={() => setActiveConversation(conv.id)}
                tabIndex={collapsedTabIndex}
              >
                <FaComments size={12} />
                <ConversationTitle>{conv.title}</ConversationTitle>
                <DeleteButton
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title={messages.sidebar.deleteConversation}
                  aria-label={messages.sidebar.deleteConversation}
                  tabIndex={collapsedTabIndex}
                >
                  <FaTrashCan size={11} />
                </DeleteButton>
              </ConversationItem>
            ))}
          </ConversationList>

          <SidebarFooter>
            <SettingsButton onClick={onOpenSettings} tabIndex={collapsedTabIndex}>
              <FaGear size={13} />
              {messages.sidebar.settings}
            </SettingsButton>
          </SidebarFooter>
        </SidebarContent>
      </SidebarContainer>
    </>
  );
};
