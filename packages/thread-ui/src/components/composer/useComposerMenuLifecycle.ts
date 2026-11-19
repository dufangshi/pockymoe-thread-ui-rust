import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { McpPanelMode, SettingsMenu, SlashPanelView } from './types';

export interface UseComposerMenuLifecycleInput {
  openMenu: SettingsMenu;
  setOpenMenu: Dispatch<SetStateAction<SettingsMenu>>;
  slashPanelView: SlashPanelView;
  setSlashPanelView: Dispatch<SetStateAction<SlashPanelView>>;
  setMcpPanelMode: Dispatch<SetStateAction<McpPanelMode>>;
  clearMcpConfigStatus: () => void;
  clearHookConfigStatus: () => void;
}

export interface UseComposerMenuLifecycleResult {
  copiedSkillName: string | null;
  copySkillInvokeName: (skillName: string) => Promise<void>;
}

export function useComposerMenuLifecycle({
  openMenu,
  setOpenMenu,
  slashPanelView,
  setSlashPanelView,
  setMcpPanelMode,
  clearMcpConfigStatus,
  clearHookConfigStatus,
}: UseComposerMenuLifecycleInput): UseComposerMenuLifecycleResult {
  const [copiedSkillName, setCopiedSkillName] = useState<string | null>(null);

  useEffect(() => {
    if (openMenu !== 'slash') {
      setSlashPanelView('root');
      setMcpPanelMode('list');
      clearMcpConfigStatus();
      clearHookConfigStatus();
    }
  }, [
    clearHookConfigStatus,
    clearMcpConfigStatus,
    openMenu,
    setMcpPanelMode,
    setSlashPanelView,
  ]);

  useEffect(() => {
    if (slashPanelView !== 'mcp') {
      setMcpPanelMode('list');
      clearMcpConfigStatus();
    }
  }, [clearMcpConfigStatus, setMcpPanelMode, slashPanelView]);

  useEffect(() => {
    if (!copiedSkillName) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedSkillName((current) =>
        current === copiedSkillName ? null : current,
      );
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copiedSkillName]);

  useEffect(() => {
    function handleWindowPointerDown(event: PointerEvent) {
      const eventPath =
        typeof event.composedPath === 'function' ? event.composedPath() : [];
      const clickedInsideInteractiveMenu = eventPath.some(
        (node) =>
          node instanceof HTMLElement &&
          (node.dataset.composerMenuSurface === 'true' ||
            node.dataset.composerMenuTrigger === 'true'),
      );
      if (clickedInsideInteractiveMenu) {
        return;
      }

      if (openMenu) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        // Captured before anything else sees it: this Esc belongs to the open
        // menu, so a surrounding split pane must not close as well (§4).
        event.preventDefault();
        // Removing a focused menu item otherwise sends focus to the document.
        // Return to its composer trigger before closing the surface.
        const surface = document.activeElement?.closest('[data-composer-menu-surface]');
        surface?.parentElement?.querySelector<HTMLElement>('[data-composer-menu-trigger="true"]')?.focus({ preventScroll: true });
        setOpenMenu(null);
      }
    }

    if (openMenu) {
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('pointerdown', handleWindowPointerDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('pointerdown', handleWindowPointerDown);
      };
    }
  }, [openMenu, setOpenMenu]);

  const copySkillInvokeName = useCallback(async (skillName: string) => {
    try {
      await navigator.clipboard.writeText(`$${skillName}`);
      setCopiedSkillName(skillName);
    } catch {
      setCopiedSkillName(null);
    }
  }, []);

  return {
    copiedSkillName,
    copySkillInvokeName,
  };
}
