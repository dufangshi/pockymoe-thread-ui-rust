import { createContext, useContext } from 'react';

import type { AgentBackendIdDto } from '@pockymoe/shared';
import type { ComposerSendShortcut } from '../components/composer/composerUtils';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AgentBackendId = AgentBackendIdDto;

export interface AppShellNavContextValue {
  navOpen: boolean;
  openNav: () => void;
  toggleNav: () => void;
  closeNav: () => void;
  settingsOpen: boolean;
  openSettings: () => void;
  /** Opens settings on one section, such as `resources`. */
  openSettingsSection?: (sectionId: string) => void;
  /** The section the settings dialog opens on; the first one when unset. */
  settingsSection?: string | null;
  closeSettings: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  effectiveTheme: 'light' | 'dark';
  defaultBackend: AgentBackendId;
  setDefaultBackend: (backend: AgentBackendId) => void;
  autoCollapseCompletedTurns?: boolean;
  setAutoCollapseCompletedTurns?: (enabled: boolean) => void;
  showReasoningSummaries?: boolean;
  setShowReasoningSummaries?: (enabled: boolean) => void;
  sendShortcut?: ComposerSendShortcut;
  setSendShortcut?: (shortcut: ComposerSendShortcut) => Promise<void>;
  sendShortcutLoading?: boolean;
  sendShortcutSaving?: boolean;
  sendShortcutError?: string | null;
  refreshSendShortcut?: () => Promise<void>;
}

export const AppShellNavContext = createContext<AppShellNavContextValue | null>(
  null,
);

export function useAppShellNav() {
  return useContext(AppShellNavContext);
}
