/** @vitest-environment jsdom */
import { act, type default as React } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { MatterWorkbench, type MatterWorkbenchOptions } from './MatterWorkbench';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const baseOptions: MatterWorkbenchOptions = {
  threads: [], currentKey: 'local:a', favorite: false, workspacePath: '/workspace', activeView: 'chat',
  terminalEnabled: true, onViewChange: () => {}, onToggleFavorite: () => {}, onNavigate: () => {}, onSearch: () => {},
  notifications: [], unreadCount: 0, onReadNotifications: () => {},
};
let options = baseOptions;
function render(statusActions: React.ReactNode = null) {
  act(() => root.render(
    <MatterWorkbench options={{ ...options, statusActions }} title="A" homeHref="/workspaces" settings={<button aria-label="Open settings" />}
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
  options = baseOptions;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete document.documentElement.dataset.themeFeatures;
  localStorage.removeItem('pockymoe.phoneDock');
  vi.unstubAllGlobals();
});

describe('phone top bar without the dock', () => {
  beforeEach(() => localStorage.setItem('pockymoe.phoneDock', 'off'));

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

const thread = (key: string, status = 'idle') => ({ key, title: key.toUpperCase(), subtitle: 'ws', href: `/threads/${key}`, status, favorite: false });
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
function pointer(target: Element, type: string, clientX: number, clientY = 10) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.assign(event, { pointerId: 1, pointerType: 'touch' });
  act(() => { target.dispatchEvent(event); });
}

describe('one-handed phone dock', () => {
  it('keeps only status in the top bar and moves navigation to the bottom', () => {
    options = { ...baseOptions, threads: [thread('a'), thread('b', 'running'), thread('c', 'running')], unreadCount: 2 };
    render();
    expect(topbar().classList.contains('is-status-only')).toBe(true);
    expect(topbar().querySelector('button[aria-label="Device monitor"]')).not.toBeNull();
    expect(topbar().querySelector('button[aria-label="Notifications"]')).not.toBeNull();
    expect(topbar().querySelector('.matter-running-chip')?.textContent).toBe('2');
    for (const label of ['Chat', 'Terminal', 'Toggle Explorer', 'Open settings', 'Go back']) {
      expect(topbar().querySelector(`button[aria-label="${label}"]`)).toBeNull();
    }
    expect(host.querySelector('.matter-tabs-row')).toBeNull();
    const dock = host.querySelector('nav.matter-phone-dock')!;
    expect(dock.querySelector('button[aria-label="Chat"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(dock.querySelector('.matter-phone-thread-title')?.textContent).toBe('A');
  });

  it('switches views from the dock', () => {
    const onViewChange = vi.fn();
    options = { ...baseOptions, onViewChange };
    render();
    act(() => button('Terminal')!.click());
    expect(onViewChange).toHaveBeenCalledWith('shell');
    act(() => button('Toggle Explorer')!.click());
    expect(host.querySelector('aside.matter-explorer')).not.toBeNull();
    expect(button('Toggle Explorer')!.getAttribute('aria-pressed')).toBe('true');
    act(() => button('Chat')!.click());
    expect(host.querySelector('aside.matter-explorer')).toBeNull();
  });

  it('opens the thread sheet from the thread button and navigates from it', () => {
    const onNavigate = vi.fn();
    options = { ...baseOptions, onNavigate, threads: [thread('a'), thread('b', 'unread')], workspaceThreads: [thread('a'), thread('b', 'unread')] };
    render();
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!;
    expect(sheet.hasAttribute('data-open')).toBe(false);
    act(() => host.querySelector<HTMLButtonElement>('.matter-phone-thread')!.click());
    expect(sheet.hasAttribute('data-open')).toBe(true);
    // Unread threads come before idle ones.
    expect([...sheet.querySelectorAll('.matter-thread-row')].map(row => row.textContent)).toEqual(['Bws', 'Aws']);
    act(() => sheet.querySelector<HTMLAnchorElement>('a[href="/threads/b"]')!.click());
    expect(onNavigate).toHaveBeenCalledWith('/threads/b');
    expect(sheet.hasAttribute('data-open')).toBe(false);
  });

  it('switches to the neighbouring open thread with a sideways swipe', () => {
    const onNavigate = vi.fn();
    options = { ...baseOptions, currentKey: 'b', onNavigate, workspaceThreads: [thread('a'), thread('b'), thread('c')] };
    render();
    const chip = host.querySelector('.matter-phone-thread')!;
    pointer(chip, 'pointerdown', 200);
    pointer(chip, 'pointermove', 140);
    pointer(chip, 'pointerup', 120);
    act(() => (chip as HTMLButtonElement).click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/threads/c');
    expect(host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!.hasAttribute('data-open')).toBe(false);
  });

  it('keeps the moved actions mounted in the More sheet', () => {
    render(<button aria-label="Automations" />);
    const more = host.querySelector('section.matter-phone-sheet[aria-label="More actions"]')!;
    expect(more.querySelector('button[aria-label="Open settings"]')).not.toBeNull();
    expect(more.querySelector('button[aria-label="Automations"]')).not.toBeNull();
    expect(more.hasAttribute('inert')).toBe(true);
    act(() => button('More actions')!.click());
    expect(more.hasAttribute('data-open')).toBe(true);
    expect(more.hasAttribute('inert')).toBe(false);
  });

  it('hides the More sheet behind a modal dialog but keeps it for popovers', () => {
    vi.useFakeTimers();
    render(<><button aria-label="Split" aria-haspopup="dialog" aria-expanded="false" /><button aria-label="Settings dialog" data-slot="dialog-trigger" aria-expanded="false" /></>);
    const more = host.querySelector('section.matter-phone-sheet[aria-label="More actions"]')!;
    act(() => button('More actions')!.click());
    act(() => { button('Split')!.click(); vi.runAllTimers(); });
    expect(more.hasAttribute('data-open')).toBe(true);
    act(() => { button('Settings dialog')!.click(); vi.runAllTimers(); });
    expect(more.hasAttribute('data-open')).toBe(false);
    vi.useRealTimers();
  });

  it('hides the dock while a field in the conversation has focus', () => {
    act(() => root.render(
      <MatterWorkbench options={options} title="A" settings={null} newThread={null} actions={null} threadMenu={null} connection={null} explorer={null} revealExplorer={0}>
        <div role="textbox" contentEditable aria-label="Prompt" />
      </MatterWorkbench>,
    ));
    const workbench = host.querySelector('.matter-workbench')!;
    act(() => host.querySelector<HTMLElement>('[aria-label="Prompt"]')!.focus());
    expect(workbench.classList.contains('is-typing')).toBe(true);
  });
});
