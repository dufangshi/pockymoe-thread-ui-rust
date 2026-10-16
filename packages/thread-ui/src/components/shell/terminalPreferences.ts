import { useSyncExternalStore } from 'react';

/** How the terminal treats the clipboard keys and the mouse, per browser. */
export interface TerminalPreferences {
  /** Copy a mouse selection as soon as it is made. */
  copyOnSelect: boolean;
  /** `smart`: Ctrl+V pastes at a shell prompt and stays a key in full-screen
      programs (vim, less); `paste`: Ctrl+V always pastes. */
  ctrlV: 'smart' | 'paste';
  /** `menu`: right-click opens copy, paste and the rest; `copyPaste`: it copies
      a selection, or pastes when nothing is selected. */
  rightClick: 'menu' | 'copyPaste';
  /** Confirm a multi-line paste a shell could run line by line. */
  pasteWarning: boolean;
}

export const DEFAULT_TERMINAL_PREFERENCES: TerminalPreferences = {
  copyOnSelect: true,
  ctrlV: 'smart',
  rightClick: 'menu',
  pasteWarning: true,
};

const STORAGE_KEY = 'pockymoe.terminal';
const listeners = new Set<() => void>();
let cached: TerminalPreferences | null = null;

function read(): TerminalPreferences {
  if (cached) return cached;
  let stored: Partial<TerminalPreferences> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<TerminalPreferences>;
  } catch { /* Private browsing or a damaged value: defaults. */ }
  const value = { ...DEFAULT_TERMINAL_PREFERENCES };
  if (typeof stored.copyOnSelect === 'boolean') value.copyOnSelect = stored.copyOnSelect;
  if (stored.ctrlV === 'smart' || stored.ctrlV === 'paste') value.ctrlV = stored.ctrlV;
  if (stored.rightClick === 'menu' || stored.rightClick === 'copyPaste') value.rightClick = stored.rightClick;
  if (typeof stored.pasteWarning === 'boolean') value.pasteWarning = stored.pasteWarning;
  cached = value;
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storage);
  };
}

export function terminalPreferences() {
  return read();
}

export function setTerminalPreferences(change: Partial<TerminalPreferences>) {
  cached = { ...read(), ...change };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* Kept for this page only. */ }
  for (const listener of listeners) listener();
}

export function useTerminalPreferences() {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_TERMINAL_PREFERENCES);
}
