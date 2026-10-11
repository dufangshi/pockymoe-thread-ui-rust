/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { MatterWorkbench, type MatterWorkbenchOptions } from './MatterWorkbench';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const options: MatterWorkbenchOptions = {
  threads: [], currentKey: 'local:a', favorite: false, workspacePath: '/workspace', activeView: 'chat',
  terminalEnabled: true, onViewChange: () => {}, onToggleFavorite: () => {}, onNavigate: () => {}, onSearch: () => {},
  notifications: [], unreadCount: 0, onReadNotifications: () => {},
};
function render() {
  act(() => root.render(
    <MatterWorkbench options={options} title="A" homeHref="/workspaces" settings={<button aria-label="Open settings" />}
      newThread={null} actions={null} threadMenu={null} connection={null}
      deviceMonitor={<button aria-label="Device monitor" />} explorer={null} revealExplorer={0}>
      <p>Conversation</p>
    </MatterWorkbench>,
  ));
}
const topbar = () => host.querySelector('header.matter-topbar')!;
const drawer = () => host.querySelector('aside.matter-sidebar')!;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete document.documentElement.dataset.themePreset;
  vi.unstubAllGlobals();
});

describe('phone top bar', () => {
  it('keeps every control in the Classic top bar', () => {
    render();
    expect(topbar().querySelector('a[href="/workspaces"]')).not.toBeNull();
    expect(topbar().querySelector('button[aria-label="Chat"]')).not.toBeNull();
    expect(topbar().querySelector('button[aria-label="Device monitor"]')).not.toBeNull();
    expect(drawer().querySelector('.matter-drawer-tools')).toBeNull();
  });

  it('moves Home, Chat and the device monitor into the Plum Pocket drawer once each', () => {
    document.documentElement.dataset.themePreset = 'plum-pocket';
    render();
    for (const selector of ['a[href="/workspaces"]', 'button[aria-label="Device monitor"]']) {
      expect(topbar().querySelector(selector)).toBeNull();
      expect(host.querySelectorAll(selector)).toHaveLength(1);
    }
    const tools = drawer().querySelector('[role="group"].matter-drawer-tools')!;
    expect(tools.querySelector('a[href="/workspaces"]')?.textContent).toBe('Workspaces');
    expect(tools.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Chat');
    expect(topbar().querySelector('button[aria-label="Terminal"]')).not.toBeNull();
    expect(topbar().querySelector('button[aria-label="Open settings"]')).not.toBeNull();
  });

  it('follows a live preset switch', async () => {
    render();
    await act(async () => { document.documentElement.dataset.themePreset = 'plum-pocket'; await Promise.resolve(); });
    expect(drawer().querySelector('.matter-drawer-tools')).not.toBeNull();
    await act(async () => { document.documentElement.dataset.themePreset = 'classic'; await Promise.resolve(); });
    expect(drawer().querySelector('.matter-drawer-tools')).toBeNull();
    expect(topbar().querySelector('button[aria-label="Chat"]')).not.toBeNull();
  });
});
