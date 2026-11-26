/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatShortcut, isMacPlatform, matchesModKey, matchesSendModKey, setHostPlatform } from './shortcuts';

/** A browser as the page sees it: the UA client hint when it has one, and the legacy platform. */
function browser(platform: string, hinted?: string) {
  vi.stubGlobal('navigator', { platform, ...(hinted ? { userAgentData: { platform: hinted } } : {}) });
}
const mac = () => browser('MacIntel', 'macOS');
const windows = () => browser('Win32', 'Windows');

afterEach(() => { setHostPlatform(null); vi.unstubAllGlobals(); });

describe('isMacPlatform', () => {
  it.each([
    ['MacIntel', 'macOS', true], ['MacIntel', undefined, true], ['iPhone', undefined, true], ['iPad', undefined, true],
    ['Win32', 'Windows', false], ['Linux x86_64', 'Linux', false], ['Linux armv8l', 'Android', false],
    ['Linux x86_64', 'Chrome OS', false], ['', undefined, false],
  ] as const)('reads navigator.platform %j with client hint %j as %j', (platform, hinted, expected) => {
    browser(platform, hinted);
    expect(isMacPlatform()).toBe(expected);
  });
  it('prefers the client hint over the legacy platform', () => {
    browser('Linux x86_64', 'macOS');
    expect(isMacPlatform()).toBe(true);
    browser('MacIntel', 'Windows');
    expect(isMacPlatform()).toBe(false);
  });
  it('lets the desktop host decide, and returns to the browser when it is cleared', () => {
    windows();
    setHostPlatform('darwin');
    expect(isMacPlatform()).toBe(true);
    mac();
    for (const platform of ['win32', 'linux', 'android']) { setHostPlatform(platform); expect(isMacPlatform()).toBe(false); }
    setHostPlatform('ios');
    expect(isMacPlatform()).toBe(true);
    setHostPlatform(null);
    expect(isMacPlatform()).toBe(true);
  });
  it('is not a Mac where there is no navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isMacPlatform()).toBe(false);
  });
});

describe('matchesModKey', () => {
  it('takes only ⌘ on a Mac, so Ctrl stays a text-editing and terminal key', () => {
    mac();
    expect(matchesModKey({ metaKey: true })).toBe(true);
    expect(matchesModKey({ ctrlKey: true })).toBe(false);
    expect(matchesModKey({ metaKey: true, ctrlKey: true })).toBe(false);
    expect(matchesModKey({})).toBe(false);
  });
  it('takes only Ctrl on Windows and Linux', () => {
    windows();
    expect(matchesModKey({ ctrlKey: true })).toBe(true);
    expect(matchesModKey({ metaKey: true })).toBe(false);
    expect(matchesModKey({ metaKey: true, ctrlKey: true })).toBe(false);
    expect(matchesModKey({})).toBe(false);
  });
  it('accepts a keyboard event', () => {
    mac();
    expect(matchesModKey(new KeyboardEvent('keydown', { key: 'f', metaKey: true }))).toBe(true);
    expect(matchesModKey(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))).toBe(false);
  });
});

it('matchesSendModKey takes Ctrl or ⌘ on every platform', () => {
  for (const platform of [mac, windows]) {
    platform();
    expect(matchesSendModKey({ ctrlKey: true })).toBe(true);
    expect(matchesSendModKey({ metaKey: true })).toBe(true);
    expect(matchesSendModKey({})).toBe(false);
  }
});

describe('formatShortcut', () => {
  it.each([
    ['Mod+F', '⌘F', 'Ctrl+F'], ['Mod+f', '⌘F', 'Ctrl+F'], ['Mod+0', '⌘0', 'Ctrl+0'], ['Mod+Enter', '⌘Enter', 'Ctrl+Enter'],
    ['Mod+Shift+Enter', '⇧⌘Enter', 'Ctrl+Shift+Enter'], ['Shift+Enter', '⇧Enter', 'Shift+Enter'],
    ['Mod+Alt+←', '⌥⌘←', 'Ctrl+Alt+←'], ['Alt+←', '⌥←', 'Alt+←'], ['Ctrl+`', '⌃`', 'Ctrl+`'],
    ['Ctrl+Shift+V', '⌃⇧V', 'Ctrl+Shift+V'], ['Enter', 'Enter', 'Enter'],
  ])('writes %s as %s on a Mac and %s elsewhere', (shortcut, onMac, elsewhere) => {
    mac();
    expect(formatShortcut(shortcut)).toBe(onMac);
    windows();
    expect(formatShortcut(shortcut)).toBe(elsewhere);
  });
});
