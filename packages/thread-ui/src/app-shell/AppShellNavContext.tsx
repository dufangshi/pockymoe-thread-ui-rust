import { createContext, useContext } from 'react';

import type { AgentBackendIdDto } from '@pockymoe/shared';
import type { ComposerSendShortcut } from '../components/composer/composerUtils';

export type ThemeMode = 'system' | 'light' | 'dark';
export type PhoneHand = 'right' | 'left';
export type AgentBackendId = AgentBackendIdDto;

export interface AppShellNavContextValue {
  navOpen: boolean;
  openNav: () => void;
  toggleNav: () => void;
  closeNav: () => void;
  settingsOpen: boolean;
  openSettings: () => void;
  /** Opens settings on one section, such as `resources`. */
  /** `deviceId`: the device a device-level section is for, where the caller knows it. */
  openSettingsSection?: (sectionId: string, deviceId?: string | null) => void;
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
  /** One-handed phone layout: status-only top bar, controls in a bottom dock. */
  phoneDock?: boolean;
  setPhoneDock?: (enabled: boolean) => void;
  /** The thumb the one-handed layout is arranged for; left mirrors it. */
  phoneHand?: PhoneHand;
  setPhoneHand?: (hand: PhoneHand) => void;
  /** Opens the map of every thread on the account's devices. */
  openThreadMap?: () => void;
  showReasoningSummaries?: boolean;
  setShowReasoningSummaries?: (enabled: boolean) => void;
  sendShortcut?: ComposerSendShortcut;
  setSendShortcut?: (shortcut: ComposerSendShortcut) => Promise<void>;
  /** Where the choice is kept: the Relay account, or (local mode) this browser. */
  sendShortcutScope?: 'account' | 'browser';
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
