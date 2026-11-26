/**
 * Keyboard shortcuts by platform (docs/ui-principles.md §19, in the Pockymoe
 * repository). "Mod" is ⌘ on Apple keyboards and Ctrl everywhere else: on a
 * Mac, Ctrl with a letter is a text-editing or terminal key (Ctrl+F moves the
 * caret, Ctrl+K kills the line) and must reach the field untouched.
 */

/** What a key or pointer event says about its modifiers. */
export interface ShortcutModifiers { metaKey?: boolean; ctrlKey?: boolean }

// One answer even if a bundler duplicates this module across entries.
const storeKey = Symbol.for('pockymoe.shortcut-platform');
const store = globalThis as typeof globalThis & { [storeKey]?: { host: string | null } };
const state = store[storeKey] ??= { host: null };

/**
 * The desktop client reports its operating system through the host bridge
 * (`capabilities.platform`); that answer wins over the browser's. `null`
 * returns to asking the browser.
 */
export function setHostPlatform(platform: string | null | undefined): void {
  state.host = platform || null;
}

/** macOS, and iOS/iPadOS with a hardware keyboard: the platforms whose command key is ⌘. */
export function isMacPlatform(): boolean {
  if (state.host) return state.host === 'darwin' || state.host === 'ios';
  if (typeof navigator === 'undefined') return false;
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return /^(?:mac|iphone|ipad|ipod|ios)/i.test(hinted || navigator.platform || '');
}

/**
 * The platform's command modifier, and not the other platform's: ⌘ without
 * Ctrl on a Mac, Ctrl without ⌘ elsewhere. The caller checks the key, Alt and
 * Shift.
 */
export function matchesModKey(event: ShortcutModifiers): boolean {
  return isMacPlatform()
    ? Boolean(event.metaKey) && !event.ctrlKey
    : Boolean(event.ctrlKey) && !event.metaKey;
}

/**
 * The composer's send modifier. The one binding that takes Ctrl or ⌘ on every
 * platform: Ctrl+Enter has no other meaning in a text field on a Mac, and the
 * send setting follows the account across machines
 * (docs/account-composer-shortcuts.md). Labels still name the platform's key.
 */
export function matchesSendModKey(event: ShortcutModifiers): boolean {
  return Boolean(event.metaKey || event.ctrlKey);
}

const MAC_SYMBOLS: Record<string, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', mod: '⌘' };
const MAC_ORDER = ['ctrl', 'alt', 'shift', 'mod'];
const NAMES: Record<string, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', mod: 'Ctrl' };

/**
 * A shortcut as this platform writes it: `Mod+F` is ⌘F on a Mac and Ctrl+F
 * elsewhere, `Mod+Shift+Enter` is ⇧⌘Enter and Ctrl+Shift+Enter. Modifiers are
 * `Mod`, `Ctrl`, `Alt` and `Shift`; the last part is the key, written as it
 * should be shown (a single letter is capitalized).
 */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('+').map(part => part.trim());
  const last = parts.pop() ?? '';
  const key = last.length === 1 ? last.toUpperCase() : last;
  const modifiers = parts.map(part => part.toLowerCase());
  if (!isMacPlatform()) return [...modifiers.map(name => NAMES[name] ?? name), key].join('+');
  return MAC_ORDER.filter(name => modifiers.includes(name)).map(name => MAC_SYMBOLS[name]).join('') + key;
}
