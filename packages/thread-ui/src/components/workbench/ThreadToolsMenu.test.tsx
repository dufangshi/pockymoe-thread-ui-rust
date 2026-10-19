/**
 * @vitest-environment jsdom
 */
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { ThreadToolsMenu } from './ThreadToolsMenu';

let root: Root;
let host: HTMLDivElement;
const onFavorite = vi.fn();
const onDownload = vi.fn();

function Fixture() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <div className="thread-ui-shell">
      <button ref={toggle} aria-label="Thread tools" aria-expanded={open} onClick={() => setOpen((value) => !value)}>tools</button>
      <ThreadToolsMenu id="tools" open={open} anchorRef={toggle} path="/home/ubuntu/dev/remoteCodex" title="thread ui"
        favorite={false} onToggleFavorite={onFavorite} onClose={(restore) => { setOpen(false); if (restore) toggle.current?.focus(); }}>
        <div><button aria-label="Download transcript" onClick={onDownload}>D</button></div>
      </ThreadToolsMenu>
    </div>
  );
}

beforeEach(() => {
  setLocale('en', false);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Fixture />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const toggle = () => document.querySelector<HTMLButtonElement>('[aria-label="Thread tools"]')!;
const menu = () => document.querySelector<HTMLElement>('#tools[data-open]');

it('opens under its toggle with the workspace path, the thread and its star, then the actions', async () => {
  act(() => toggle().click());
  expect(menu()?.getAttribute('role')).toBe('menu');
  expect(menu()?.querySelector('.matter-thread-tools-path')?.textContent).toContain('~/dev/remoteCodex');
  expect(menu()?.querySelector('.matter-thread-tools-title')?.textContent).toBe('thread ui');
  // The star keeps the menu open.
  act(() => menu()!.querySelector<HTMLButtonElement>('[aria-label="Add shortcut"]')!.click());
  expect(onFavorite).toHaveBeenCalledOnce();
  expect(menu()).not.toBeNull();
  // An action runs and the menu steps aside.
  vi.useFakeTimers();
  act(() => menu()!.querySelector<HTMLButtonElement>('[aria-label="Download transcript"]')!.click());
  act(() => { vi.runAllTimers(); });
  vi.useRealTimers();
  expect(onDownload).toHaveBeenCalledOnce();
  expect(menu()).toBeNull();
});

it('stays mounted while closed, so the windows its controls opened live on', () => {
  expect(document.querySelector('#tools')?.getAttribute('aria-hidden')).toBe('true');
  act(() => toggle().click());
  act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  expect(document.querySelector('#tools [aria-label="Download transcript"]')).not.toBeNull();
});

it('closes on Escape and on a press outside', () => {
  act(() => toggle().click());
  expect(menu()!.contains(document.activeElement)).toBe(true);
  act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(toggle());
  act(() => toggle().click());
  act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  expect(menu()).toBeNull();
});
