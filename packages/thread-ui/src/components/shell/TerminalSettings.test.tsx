/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import { setHostPlatform } from '../shortcuts';
import { TerminalSettings } from './TerminalSettings';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => { setLocale('en', false); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); setHostPlatform(null); });
const legends = () => [...host.querySelectorAll('legend')].map(legend => legend.textContent);
const note = () => host.querySelector('.terminal-settings-note')?.textContent ?? '';

it('offers the Ctrl+V choice and names the Ctrl keys on Windows and Linux', () => {
  setHostPlatform('win32');
  act(() => root.render(<TerminalSettings />));
  expect(legends()).toEqual(['Ctrl+V', 'Right-click']);
  expect(note()).toContain('Ctrl+C copies a selection');
  expect(note()).not.toContain('⌘');
});

it('names ⌘C and ⌘V on a Mac, where Ctrl+V is always the terminal\'s key and there is nothing to choose', () => {
  setHostPlatform('darwin');
  act(() => root.render(<TerminalSettings />));
  expect(legends()).toEqual(['Right-click']);
  expect(note()).toContain('⌘C and ⌘V copy and paste');
  expect(note()).not.toContain('Ctrl+C');
});
