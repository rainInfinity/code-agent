import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FaAngleLeft,
  FaAngleRight,
  FaBars,
  FaRegWindowMaximize,
  FaRegWindowMinimize,
  FaRegWindowRestore,
  FaXmark,
} from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  messages,
} from '@/i18n';

type TitleBarMenuKey = keyof typeof messages.titleBar.menus;

const TITLEBAR_HEIGHT = 42;

const TitleBarRoot = styled.header`
  display: flex;
  align-items: stretch;
  width: 100vw;
  height: ${TITLEBAR_HEIGHT}px;
  min-height: ${TITLEBAR_HEIGHT}px;
  background-color: ${({ theme }) =>
    theme.mode === 'dark' ? '#111318' : theme.colors.bgSecondary};
  border-bottom: 1px solid
    ${({ theme }) => (theme.mode === 'dark' ? '#252933' : theme.colors.border)};
  color: ${({ theme }) => theme.colors.textPrimary};
  user-select: none;
`;

const DragSurface = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
`;

const LeftControls = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  height: 100%;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const Menus = styled.nav`
  display: flex;
  align-items: center;
  height: 100%;
  min-width: 0;
  overflow: hidden;
`;

const DragFill = styled.div`
  flex: 1;
  align-self: stretch;
  min-width: 24px;
`;

const WindowControls = styled.div`
  display: flex;
  align-items: stretch;
  height: 100%;
  flex-shrink: 0;
`;

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: -2px;
  }
`;

const IconButton = styled.button`
  ${buttonBase}
  width: 32px;

  &:hover:not(:disabled) {
    background-color: ${({ theme }) =>
      theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:disabled {
    cursor: default;
    color: ${({ theme }) => theme.colors.textTertiary};
    opacity: 0.48;
  }
`;

const MenuGroup = styled.div`
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
`;

const MenuTrigger = styled.button<{ $open: boolean }>`
  ${buttonBase}
  min-width: 44px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  white-space: nowrap;

  ${({ $open, theme }) =>
    $open &&
    css`
      background-color: ${theme.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : theme.colors.bgActive};
      color: ${theme.colors.textPrimary};
    `}

  &:hover {
    background-color: ${({ theme }) =>
      theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const MenuSurface = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 168px;
  padding: ${({ theme }) => theme.spacing.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: 50;
`;

const PlaceholderItem = styled.button`
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: not-allowed;
  text-align: left;
`;

const WindowButton = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: background-color ${({ theme }) => theme.transitions.fast},
    color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ $danger, theme }) =>
      $danger ? theme.colors.error : theme.colors.bgHover};
    color: ${({ $danger, theme }) =>
      $danger ? theme.colors.textInverse : theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: -2px;
  }
`;

const titleBarMessages = messages.titleBar;

const menuEntries = Object.entries(titleBarMessages.menus) as Array<
  [TitleBarMenuKey, string]
>;

export const TitleBar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore();
  const [openMenu, setOpenMenu] = useState<TitleBarMenuKey | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const window = useMemo(() => getCurrentWindow(), []);

  useEffect(() => {
    let cleanupResize: (() => void) | undefined;
    let cleanupMove: (() => void) | undefined;
    let cancelled = false;

    const syncMaximizedState = async () => {
      const maximized = await window.isMaximized();
      if (!cancelled) {
        setIsMaximized(maximized);
      }
    };

    syncMaximizedState();
    window.onResized(syncMaximizedState).then((unlisten) => {
      cleanupResize = unlisten;
    });
    window.onMoved(syncMaximizedState).then((unlisten) => {
      cleanupMove = unlisten;
    });

    return () => {
      cancelled = true;
      cleanupResize?.();
      cleanupMove?.();
    };
  }, [window]);

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const activeMenu = menuRefs.current[openMenu];
      if (!activeMenu?.contains(target)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const startDragging = (event: React.MouseEvent) => {
    if (event.button !== 0 || event.detail > 1) {
      return;
    }

    window.startDragging().catch(() => {
      // Dragging is a desktop-only best-effort affordance.
    });
  };

  const toggleMaximize = async () => {
    await window.toggleMaximize();
    setIsMaximized(await window.isMaximized());
  };

  const handleDoubleClick = () => {
    toggleMaximize().catch(() => {
      // Window control failures are surfaced by Tauri in development logs.
    });
  };

  const stopDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <TitleBarRoot>
      <DragSurface onMouseDown={startDragging} onDoubleClick={handleDoubleClick}>
        <LeftControls onMouseDown={stopDrag} onDoubleClick={stopDrag}>
          <IconButton
            type="button"
            onClick={toggleSidebar}
            title={
              sidebarCollapsed
                ? titleBarMessages.controls.showSidebar
                : titleBarMessages.controls.hideSidebar
            }
            aria-label={
              sidebarCollapsed
                ? titleBarMessages.controls.showSidebar
                : titleBarMessages.controls.hideSidebar
            }
          >
            <FaBars size={14} />
          </IconButton>
          <IconButton
            type="button"
            disabled
            title={titleBarMessages.controls.backUnavailable}
            aria-label={titleBarMessages.controls.backUnavailable}
          >
            <FaAngleLeft size={14} />
          </IconButton>
          <IconButton
            type="button"
            disabled
            title={titleBarMessages.controls.forwardUnavailable}
            aria-label={titleBarMessages.controls.forwardUnavailable}
          >
            <FaAngleRight size={14} />
          </IconButton>
        </LeftControls>

        <Menus
          aria-label={titleBarMessages.menuBarLabel}
          onMouseDown={stopDrag}
          onDoubleClick={stopDrag}
        >
          {menuEntries.map(([key, label]) => (
            <MenuGroup
              key={key}
              ref={(element) => {
                menuRefs.current[key] = element;
              }}
            >
              <MenuTrigger
                type="button"
                $open={openMenu === key}
                aria-haspopup="menu"
                aria-expanded={openMenu === key}
                onClick={() => setOpenMenu((current) => (current === key ? null : key))}
              >
                {label}
              </MenuTrigger>
              {openMenu === key && (
                <MenuSurface role="menu">
                  <PlaceholderItem
                    type="button"
                    role="menuitem"
                    aria-disabled="true"
                    title={titleBarMessages.menuPlaceholderUnavailable}
                    onClick={(event) => event.preventDefault()}
                  >
                    {titleBarMessages.menuPlaceholderItem}
                  </PlaceholderItem>
                </MenuSurface>
              )}
            </MenuGroup>
          ))}
        </Menus>

        <DragFill />
      </DragSurface>

      <WindowControls onMouseDown={stopDrag} onDoubleClick={stopDrag}>
        <WindowButton
          type="button"
          onClick={() => window.minimize()}
          title={titleBarMessages.controls.minimize}
          aria-label={titleBarMessages.controls.minimize}
        >
          <FaRegWindowMinimize size={13} />
        </WindowButton>
        <WindowButton
          type="button"
          onClick={() => toggleMaximize()}
          title={
            isMaximized
              ? titleBarMessages.controls.restore
              : titleBarMessages.controls.maximize
          }
          aria-label={
            isMaximized
              ? titleBarMessages.controls.restore
              : titleBarMessages.controls.maximize
          }
        >
          {isMaximized ? (
            <FaRegWindowRestore size={13} />
          ) : (
            <FaRegWindowMaximize size={13} />
          )}
        </WindowButton>
        <WindowButton
          type="button"
          $danger
          onClick={() => window.close()}
          title={titleBarMessages.controls.close}
          aria-label={titleBarMessages.controls.close}
        >
          <FaXmark size={15} />
        </WindowButton>
      </WindowControls>
    </TitleBarRoot>
  );
};
