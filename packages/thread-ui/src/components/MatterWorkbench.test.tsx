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
  delete document.documentElement.dataset.themeFeatures;
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

  it('moves Home and Chat into the drawer for themes with phone drawer tools and keeps the device monitor in the top bar', () => {
    document.documentElement.dataset.themeFeatures = 'workbench.phoneDrawerTools';
    render();
    expect(topbar().querySelector('a[href="/workspaces"]')).toBeNull();
    expect(host.querySelectorAll('a[href="/workspaces"]')).toHaveLength(1);
    expect(topbar().querySelector('button[aria-label="Device monitor"]')).not.toBeNull();
    expect(host.querySelectorAll('button[aria-label="Device monitor"]')).toHaveLength(1);
    const tools = drawer().querySelector('[role="group"].matter-drawer-tools')!;
    expect(tools.querySelector('a[href="/workspaces"]')?.textContent).toBe('Workspaces');
    expect(tools.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Chat');
    expect(topbar().querySelector('button[aria-label="Terminal"]')).not.toBeNull();
    expect(topbar().querySelector('button[aria-label="Open settings"]')).not.toBeNull();
  });

  it('follows a live theme feature switch', async () => {
    render();
    await act(async () => { document.documentElement.dataset.themeFeatures = 'composer.richMenus workbench.phoneDrawerTools'; await Promise.resolve(); });
    expect(drawer().querySelector('.matter-drawer-tools')).not.toBeNull();
    await act(async () => { document.documentElement.dataset.themeFeatures = ''; await Promise.resolve(); });
    expect(drawer().querySelector('.matter-drawer-tools')).toBeNull();
    expect(topbar().querySelector('button[aria-label="Chat"]')).not.toBeNull();
  });
});

describe('icon hooks', () => {
  it('names each chrome icon with a neutral data-icon for theme packs', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    render();
    const icon = (selector: string) => host.querySelector(selector)?.querySelector('svg')?.getAttribute('data-icon');
    expect(icon('header.matter-topbar > button[aria-expanded]')).toBe('sidebar');
    expect(icon('button[aria-label="Go back"]')).toBe('back');
    expect(icon('button[aria-label="Go forward"]')).toBe('forward');
    expect(icon('header.matter-topbar a[href="/workspaces"]')).toBe('home');
    expect(icon('.matter-search-trigger')).toBe('search');
    expect(icon('button[aria-label="Notifications"]')).toBe('notifications');
    expect(icon('.matter-rail button[aria-label="Chat"]')).toBe('chat');
    expect(icon('.matter-rail button[aria-label="Terminal"]')).toBe('terminal');
    expect(icon('.matter-rail button[aria-label="Toggle Explorer"]')).toBe('explorer');
    expect(icon('.matter-toolbar-toggle')).toBe('thread-tools');
    // The hook is an attribute only: Classic renders the same lucide glyph.
    expect(host.querySelector('[data-icon="back"]')?.classList.contains('lucide')).toBe(true);
  });
});
