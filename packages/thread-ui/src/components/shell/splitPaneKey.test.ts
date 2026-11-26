import { afterEach, expect, it, vi } from 'vitest';
import { isSplitPaneKey } from './splitPaneKey';

const key = (init: Partial<Parameters<typeof isSplitPaneKey>[0]>) => ({ key: 'ArrowLeft', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...init });
afterEach(() => vi.unstubAllGlobals());

it('moves between split panes with Alt+arrows on Windows and Linux', () => {
  vi.stubGlobal('navigator', { platform: 'Win32' });
  expect(isSplitPaneKey(key({ altKey: true }))).toBe(true);
  expect(isSplitPaneKey(key({ altKey: true, key: 'ArrowRight' }))).toBe(true);
  expect(isSplitPaneKey(key({ altKey: true, key: 'ArrowUp' }))).toBe(false);
  expect(isSplitPaneKey(key({ altKey: true, ctrlKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({ altKey: true, metaKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({ altKey: true, shiftKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({}))).toBe(false);
});

it('leaves Option+arrows to the shell on a Mac and takes ⌥⌘ arrows instead', () => {
  vi.stubGlobal('navigator', { platform: 'MacIntel' });
  expect(isSplitPaneKey(key({ altKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({ altKey: true, metaKey: true }))).toBe(true);
  expect(isSplitPaneKey(key({ altKey: true, metaKey: true, key: 'ArrowRight' }))).toBe(true);
  expect(isSplitPaneKey(key({ altKey: true, metaKey: true, ctrlKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({ altKey: true, metaKey: true, shiftKey: true }))).toBe(false);
  expect(isSplitPaneKey(key({ metaKey: true }))).toBe(false);
});
