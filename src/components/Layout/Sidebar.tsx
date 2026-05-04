import React, { useMemo } from 'react';
import styled from 'styled-components';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FaPlus,
  FaGear,
  FaComments,
  FaTrashCan,
  FaCode,
  FaFolder,
  FaFolderOpen,
} from 'react-icons/fa6';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { stopStreaming } from '@/hooks/useIpc';
import { messages } from '@/i18n';
import { Column, Row } from '@/components/common/Flex';
import type { AgentMode } from '@/types';

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

const ModeSegmentedControl = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  margin: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  padding: 2px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.sidebarHover};
  border: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
`;

const ModeSegment = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: 30px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.bgElevated : 'transparent'};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
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

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.sidebarHover};
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
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

const ModeIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const WorkDirSelector = styled.div`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
`;

const WorkDirControlRow = styled(Row)`
  width: 100%;
`;

const WorkDirSelect = styled.select`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background-color: ${({ theme }) => theme.colors.sidebarHover};
  border: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily};
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    outline: none;
  }
`;

const BrowseWorkDirButton = styled.button<{ $wide?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  width: ${({ $wide }) => ($wide ? '100%' : '32px')};
  height: 32px;
  min-width: 32px;
  border: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  background-color: ${({ theme }) => theme.colors.sidebarHover};
  transition: color ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast},
    background-color ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
    background-color: ${({ theme }) => theme.colors.bgHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const NoWorkDirHint = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
  line-height: 1.5;
`;

interface SidebarProps {
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const {
    conversations,
    activeConversationId,
    isStreaming,
    selectedWorkDir,
    setActiveConversation,
    setSelectedWorkDir,
    createConversation,
    deleteConversation,
    setStreaming,
  } = useChatStore();

  const {
    sidebarCollapsed,
    agentMode,
    workingDirectories,
    setAgentMode,
    addWorkingDirectory,
  } = useSettingsStore();

  // Sync selectedWorkDir: auto-select first work dir in code mode
  const effectiveWorkDir = agentMode === 'code'
    ? (selectedWorkDir && workingDirectories.some((d) => d.path === selectedWorkDir)
        ? selectedWorkDir
        : workingDirectories[0]?.path ?? null)
    : null;

  const filteredConversations = useMemo(() => {
    if (agentMode === 'code' && effectiveWorkDir) {
      return conversations.filter((c) => c.workDir === effectiveWorkDir);
    }
    return conversations;
  }, [conversations, agentMode, effectiveWorkDir]);

  const handleModeSwitch = async (nextMode: AgentMode) => {
    if (nextMode === agentMode) return;

    if (isStreaming) {
      const confirmed = window.confirm(messages.messages.modeToggle.confirmSwitchWhenStreaming);
      if (!confirmed) return;

      if (activeConversationId) {
        await stopStreaming(activeConversationId).catch(() => undefined);
      }
      setStreaming(false);
    }

    setAgentMode(nextMode);
  };

  const handleBrowseWorkDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (typeof selected !== 'string') return;

    addWorkingDirectory(selected);
    setSelectedWorkDir(selected);
    const dirConvs = conversations.filter((c) => c.workDir === selected);
    const activeInDir = dirConvs.some((c) => c.id === activeConversationId);
    if (!activeInDir) {
      setActiveConversation(dirConvs[0]?.id ?? '');
    }
  };

  const handleCreateConversation = () => {
    if (agentMode === 'code') {
      if (!effectiveWorkDir) return;
      createConversation(effectiveWorkDir);
    } else {
      createConversation();
    }
  };

  const handleSelectWorkDir = (path: string) => {
    setSelectedWorkDir(path);
    const dirConvs = conversations.filter((c) => c.workDir === path);
    const activeInDir = dirConvs.some((c) => c.id === activeConversationId);
    if (!activeInDir) {
      setActiveConversation(dirConvs[0]?.id ?? '');
    }
  };

  const collapsedTabIndex = sidebarCollapsed ? -1 : 0;
  const isCodeMode = agentMode === 'code';
  const canCreateChat = !isCodeMode || (isCodeMode && effectiveWorkDir !== null);

  return (
    <>
      <SidebarContainer $collapsed={sidebarCollapsed} aria-hidden={sidebarCollapsed}>
        <SidebarContent $collapsed={sidebarCollapsed}>
          <ModeSegmentedControl>
            <ModeSegment
              type="button"
              $active={agentMode === 'chat'}
              onClick={() => void handleModeSwitch('chat')}
              tabIndex={collapsedTabIndex}
            >
              <FaComments size={11} />
              {messages.messages.modeToggle.chat}
            </ModeSegment>
            <ModeSegment
              type="button"
              $active={agentMode === 'code'}
              onClick={() => void handleModeSwitch('code')}
              tabIndex={collapsedTabIndex}
            >
              <FaCode size={11} />
              {messages.messages.modeToggle.code}
            </ModeSegment>
          </ModeSegmentedControl>

          {isCodeMode && (
            <ModeIndicator>
              <FaCode size={10} />
              {messages.messages.modeToggle.code}
            </ModeIndicator>
          )}

          {isCodeMode && workingDirectories.length > 0 && (
            <WorkDirSelector>
              <WorkDirControlRow $gap="xs">
                <WorkDirSelect
                  value={effectiveWorkDir ?? ''}
                  onChange={(e) => handleSelectWorkDir(e.target.value)}
                  tabIndex={collapsedTabIndex}
                >
                  {workingDirectories.map((dir) => (
                    <option key={dir.path} value={dir.path}>
                      {dir.name}
                    </option>
                  ))}
                </WorkDirSelect>
                <BrowseWorkDirButton
                  type="button"
                  onClick={() => void handleBrowseWorkDir()}
                  title={messages.messages.workDir.browse}
                  aria-label={messages.messages.workDir.browse}
                  tabIndex={collapsedTabIndex}
                >
                  <FaFolderOpen size={12} />
                </BrowseWorkDirButton>
              </WorkDirControlRow>
            </WorkDirSelector>
          )}

          {isCodeMode && workingDirectories.length === 0 && (
            <WorkDirSelector>
              <NoWorkDirHint>
                <FaFolder size={16} style={{ opacity: 0.3, marginBottom: 6 }} />
                <div>{messages.messages.workDir.addHint}</div>
              </NoWorkDirHint>
              <BrowseWorkDirButton
                type="button"
                onClick={() => void handleBrowseWorkDir()}
                title={messages.messages.workDir.browse}
                aria-label={messages.messages.workDir.browse}
                tabIndex={collapsedTabIndex}
                $wide
              >
                <FaFolderOpen size={12} />
                {messages.messages.workDir.browse}
              </BrowseWorkDirButton>
            </WorkDirSelector>
          )}

          <SidebarActions>
            <NewChatButton
              onClick={handleCreateConversation}
              tabIndex={collapsedTabIndex}
              disabled={!canCreateChat}
            >
              <FaPlus size={12} />
              {messages.sidebar.newChat}
            </NewChatButton>
          </SidebarActions>

          <ConversationList>
            {filteredConversations.map((conv) => (
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
