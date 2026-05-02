import React from 'react';
import styled from 'styled-components';
import {
  FaPlus,
  FaBars,
  FaGear,
  FaComments,
  FaTrashCan,
  FaAngleLeft,
} from 'react-icons/fa6';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
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

const SidebarHeader = styled(Row)`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
  min-height: 52px;
`;

const LogoArea = styled(Row)`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
`;

const LogoIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.accentPrimary}, ${({ theme }) => theme.colors.accentSecondary});
  color: #fff;
  font-size: 14px;
`;

const CollapseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
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

const ExpandButton = styled.button<{ $visible: boolean }>`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  left: ${({ theme }) => theme.spacing.md};
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.bgSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transform: translateX(${({ $visible }) => ($visible ? '0' : '-8px')});
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast},
    opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast},
    visibility ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgTertiary};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
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

  const { sidebarCollapsed, toggleSidebar } = useSettingsStore();
  const collapsedTabIndex = sidebarCollapsed ? -1 : 0;

  return (
    <>
      <SidebarContainer $collapsed={sidebarCollapsed} aria-hidden={sidebarCollapsed}>
        <SidebarContent $collapsed={sidebarCollapsed}>
          <SidebarHeader $align="center" $justify="space-between">
            <LogoArea $align="center" $gap="sm">
              <LogoIcon>
                <FaComments size={14} />
              </LogoIcon>
              Code Agent
            </LogoArea>
            <CollapseButton
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              tabIndex={collapsedTabIndex}
            >
              <FaAngleLeft size={14} />
            </CollapseButton>
          </SidebarHeader>

          <SidebarActions>
            <NewChatButton onClick={() => createConversation()} tabIndex={collapsedTabIndex}>
              <FaPlus size={12} />
              New Chat
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
                  title="Delete conversation"
                  aria-label="Delete conversation"
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
              Settings
            </SettingsButton>
          </SidebarFooter>
        </SidebarContent>
      </SidebarContainer>
      <ExpandButton
        $visible={sidebarCollapsed}
        onClick={toggleSidebar}
        title="Expand sidebar"
        aria-label="Expand sidebar"
        tabIndex={sidebarCollapsed ? 0 : -1}
      >
        <FaBars size={14} />
      </ExpandButton>
    </>
  );
};
