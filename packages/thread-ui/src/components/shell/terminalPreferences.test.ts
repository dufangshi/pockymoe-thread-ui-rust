/** @vitest-environment jsdom */
import { beforeEach, expect, it } from 'vitest';
import { isRiskyPaste, pastedLineCount } from './terminalClipboard';
import { DEFAULT_TERMINAL_PREFERENCES, setTerminalPreferences, terminalPreferences } from './terminalPreferences';

beforeEach(() => {
  localStorage.clear();
  setTerminalPreferences(DEFAULT_TERMINAL_PREFERENCES);
});

it('defaults to smart Ctrl+V, copy on select, a right-click menu and paste confirmation', () => {
  expect(terminalPreferences()).toEqual({ copyOnSelect: true, ctrlV: 'smart', rightClick: 'menu', pasteWarning: true });
});

it('stores changes in this browser', () => {
  setTerminalPreferences({ copyOnSelect: false, ctrlV: 'paste' });
  expect(JSON.parse(localStorage.getItem('pockymoe.terminal')!)).toMatchObject({ copyOnSelect: false, ctrlV: 'paste', rightClick: 'menu' });
  expect(terminalPreferences().ctrlV).toBe('paste');
});

it('treats only several lines without bracketed paste as risky', () => {
  expect(isRiskyPaste('ls\n', false)).toBe(false);
  expect(isRiskyPaste('make\nmake install', false)).toBe(true);
  expect(isRiskyPaste('make\nmake install', true)).toBe(false);
  expect(pastedLineCount('a\r\nb\nc\n\n')).toBe(3);
});
