/** @vitest-environment jsdom */
import { act, type default as React } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellNavContext, type AppShellNavContextValue } from '../app-shell/AppShellNavContext';
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
let phoneDock = true;
let nav: Partial<AppShellNavContextValue> = {};
function render(statusActions: React.ReactNode = null, children: React.ReactNode = <p>Conversation</p>) {
  act(() => root.render(
    <AppShellNavContext.Provider value={{ phoneDock, ...nav } as AppShellNavContextValue}>
      <MatterWorkbench options={{ ...options, statusActions }} title="A" homeHref="/workspaces" settings={<button aria-label="Open settings" />}
        newThread={null} actions={null} threadMenu={null} connection={null}
        deviceMonitor={<button aria-label="Device monitor" />} explorer={null} revealExplorer={0}>
        {children}
      </MatterWorkbench>
    </AppShellNavContext.Provider>,
  ));
}
const topbar = () => host.querySelector('header.matter-topbar')!;
const drawer = () => host.querySelector('aside.matter-sidebar')!;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  setLocale('en', false);
  options = baseOptions;
  phoneDock = true;
  nav = {};
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

describe('phone top bar without the dock', () => {
  beforeEach(() => { phoneDock = false; });

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

describe('phone files and conversation toggles', () => {
  beforeEach(() => { phoneDock = false; });
  const click = (label: string) => act(() => topbar().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
  const pressed = (label: string) => topbar().querySelector(`button[aria-label="${label}"]`)!.getAttribute('aria-pressed');

  it('closes Files with Chat, the button that is no longer pressed while Files covers it', () => {
    render();
    click('Toggle Explorer');
    expect(pressed('Toggle Explorer')).toBe('true');
    expect(pressed('Chat')).toBe('false');
    click('Chat');
    expect(pressed('Toggle Explorer')).toBe('false');
    expect(pressed('Chat')).toBe('true');
  });

  it('shows the terminal from over Files instead of toggling it unseen', () => {
    const onViewChange = vi.fn();
    options.onViewChange = onViewChange;
    try {
      render();
      click('Toggle Explorer');
      click('Terminal');
      expect(pressed('Toggle Explorer')).toBe('false');
      expect(onViewChange).toHaveBeenCalledWith('shell');
    } finally { options.onViewChange = () => {}; }
  });
});

const thread = (key: string, status = 'idle') => ({ key, title: key.toUpperCase(), subtitle: 'ws', href: `/threads/${key}`, status, favorite: false });
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
/** jsdom has no Touch: a plain event carrying the touch lists the handlers read. */
function touch(target: Element, type: string, clientY: number, clientX = 100) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === 'touchend' ? [] : [{ clientX, clientY }];
  Object.assign(event, { touches, changedTouches: [{ clientX, clientY }] });
  act(() => { target.dispatchEvent(event); });
}
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
    expect(topbar().querySelector('.matter-running-chip')?.getAttribute('aria-label')).toBe('2 other threads running');
    for (const label of ['Chat', 'Terminal', 'Toggle Explorer', 'Open settings', 'Go back']) {
      expect(topbar().querySelector(`button[aria-label="${label}"]`)).toBeNull();
    }
    expect(host.querySelector('.matter-tabs-row')).toBeNull();
    const dock = host.querySelector('nav.matter-phone-dock')!;
    expect(dock.querySelector('button[aria-label="Chat"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(dock.querySelector('.matter-phone-thread-title')?.textContent).toBe('A');
  });

  it('shows usage windows in the status bar', () => {
    options = { ...baseOptions, subscriptionUsage: {
      provider: 'codex', authKind: 'subscription', observedAt: new Date().toISOString(), stale: false,
      windows: [{ id: 'primary', durationMinutes: 300, label: '5h', usedPercent: 40, resetsAt: null }],
    } };
    render();
    expect(topbar().querySelector('.matter-topbar-usage .thread-subscription-usage')?.textContent).toContain('5h');
    phoneDock = false;
    render();
    expect(topbar().querySelector('.thread-subscription-usage')).toBeNull();
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

  it('lists the current thread first in the sheet, then by attention', () => {
    options = { ...baseOptions, currentKey: 'c', workspaceThreads: [thread('a'), thread('b', 'running'), thread('c')] };
    render();
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!;
    expect([...sheet.querySelectorAll('.matter-thread-row')].map(row => row.textContent)).toEqual(['Cws', 'Bws', 'Aws']);
  });

  it('opens a drawer with the app mark, all workspaces and ordered shortcuts, without a Files button', () => {
    const onReorderShortcuts = vi.fn();
    options = { ...baseOptions, onReorderShortcuts, threads: [
      { ...thread('a'), favorite: true }, { ...thread('b'), favorite: true, shortcutOrder: 0 }, thread('c'),
    ] };
    render();
    const drawer = host.querySelector('aside.matter-sidebar')!;
    expect(drawer.querySelector('.matter-drawer-brand')?.textContent).toContain('Pockymoe');
    expect(drawer.querySelector('button[aria-label="Open Explorer"]')).toBeNull();
    expect(drawer.querySelector('a.matter-drawer-home')?.getAttribute('href')).toBe('/workspaces');
    expect([...drawer.querySelectorAll('[data-testid="shortcuts"] [data-shortcut]')].map(row => row.getAttribute('data-shortcut'))).toEqual(['b', 'a']);
    expect(drawer.querySelector('.matter-shortcut-hint')?.textContent).toBe('Long-press and drag to reorder');
    expect(drawer.querySelector('.matter-sidebar-footer')).toBeNull();
  });

  it('does not switch threads with a sideways swipe on the dock', () => {
    const onNavigate = vi.fn();
    options = { ...baseOptions, currentKey: 'b', onNavigate, workspaceThreads: [thread('a'), thread('b'), thread('c')] };
    render();
    const chip = host.querySelector('.matter-phone-thread')!;
    pointer(chip, 'pointerdown', 200);
    pointer(chip, 'pointermove', 140);
    pointer(chip, 'pointerup', 120);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(host.querySelector('.matter-phone-thread-dots')).toBeNull();
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

  it('opens the thread sheet with a swipe up on the composer, not with a sideways one', () => {
    render(null, <div className="thread-graph-composer-host"><div role="textbox" aria-label="Prompt" /></div>);
    const prompt = host.querySelector('[aria-label="Prompt"]')!;
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!;
    touch(prompt, 'touchstart', 500);
    touch(prompt, 'touchend', 480, 200);
    expect(sheet.hasAttribute('data-open')).toBe(false);
    touch(prompt, 'touchstart', 500);
    touch(prompt, 'touchend', 430);
    expect(sheet.hasAttribute('data-open')).toBe(true);
  });

  it('mirrors the layout for the left hand and switches hands from More', () => {
    const setPhoneHand = vi.fn();
    nav = { phoneHand: 'left', setPhoneHand };
    render();
    expect(host.querySelector('.matter-workbench')!.classList.contains('is-left-handed')).toBe(true);
    const more = host.querySelector('section.matter-phone-sheet[aria-label="More actions"]')!;
    const toggle = [...more.querySelectorAll('button')].find(item => item.textContent === 'Left-handed')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    act(() => toggle.click());
    expect(setPhoneHand).toHaveBeenCalledWith('right');
    nav = { phoneHand: 'right', setPhoneHand };
    render();
    expect(host.querySelector('.matter-workbench')!.classList.contains('is-left-handed')).toBe(false);
  });

  it('opens the thread map from More and from the drawer when the host has one', () => {
    const openThreadMap = vi.fn();
    nav = { openThreadMap };
    render();
    const more = host.querySelector('section.matter-phone-sheet[aria-label="More actions"]')!;
    act(() => button('More actions')!.click());
    act(() => [...more.querySelectorAll('button')].find(item => item.textContent === 'Thread map')!.click());
    expect(openThreadMap).toHaveBeenCalledTimes(1);
    expect(more.hasAttribute('data-open')).toBe(false);
    act(() => [...drawer().querySelectorAll('button')].find(item => item.textContent === 'Thread map')!.click());
    expect(openThreadMap).toHaveBeenCalledTimes(2);
    nav = {};
    render();
    expect(host.textContent).not.toContain('Thread map');
  });

  it('brings the dock back only after the tap that moved focus has clicked', () => {
    vi.useFakeTimers();
    try {
      render(null, <><div role="textbox" contentEditable aria-label="Prompt" /><button aria-label="Send" /></>);
      const workbench = host.querySelector('.matter-workbench')!;
      act(() => host.querySelector<HTMLElement>('[aria-label="Prompt"]')!.focus());
      expect(workbench.classList.contains('is-typing')).toBe(true);
      // The tap's mousedown moves focus; the row must not return before its click.
      act(() => { button('Send')!.focus(); vi.advanceTimersByTime(50); });
      expect(workbench.classList.contains('is-typing')).toBe(true);
      act(() => { button('Send')!.click(); vi.advanceTimersByTime(1); });
      expect(workbench.classList.contains('is-typing')).toBe(false);
      // Without a click (the keyboard's own close button) it returns shortly after.
      act(() => host.querySelector<HTMLElement>('[aria-label="Prompt"]')!.focus());
      act(() => { (document.activeElement as HTMLElement).blur(); vi.advanceTimersByTime(50); });
      expect(workbench.classList.contains('is-typing')).toBe(true);
      act(() => { vi.advanceTimersByTime(500); });
      expect(workbench.classList.contains('is-typing')).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('pulls the workspace drawer in from the left part of the page and pushes it back', () => {
    render(null, <p>Conversation</p>);
    const page = host.querySelector('main p')!;
    const drawer = host.querySelector('aside.matter-sidebar')!;
    // The right side is left alone.
    touch(page, 'touchstart', 300, 700);
    touch(page, 'touchmove', 302, 800);
    touch(page, 'touchend', 302, 800);
    expect(drawer.classList.contains('is-open')).toBe(false);
    touch(page, 'touchstart', 300, 40);
    touch(page, 'touchmove', 302, 70);
    expect(drawer.hasAttribute('data-dragging')).toBe(true);
    touch(page, 'touchmove', 304, 200);
    touch(page, 'touchend', 304, 200);
    expect(drawer.classList.contains('is-open')).toBe(true);
    expect(drawer.hasAttribute('data-dragging')).toBe(false);
    const scrim = host.querySelector('.matter-sidebar-scrim')!;
    touch(scrim, 'touchstart', 300, 320);
    touch(scrim, 'touchmove', 300, 280);
    touch(scrim, 'touchmove', 300, 150);
    touch(scrim, 'touchend', 300, 150);
    expect(drawer.classList.contains('is-open')).toBe(false);
  });

  it('leaves vertical scrolling and the bottom panel to themselves', () => {
    render(null, <><p>Conversation</p><div className="thread-graph-composer-host"><div role="textbox" aria-label="Prompt" /></div></>);
    const drawer = host.querySelector('aside.matter-sidebar')!;
    const page = host.querySelector('main p')!;
    touch(page, 'touchstart', 300, 40);
    touch(page, 'touchmove', 380, 60);
    touch(page, 'touchmove', 460, 200);
    touch(page, 'touchend', 460, 200);
    expect(drawer.classList.contains('is-open')).toBe(false);
    const prompt = host.querySelector('[aria-label="Prompt"]')!;
    touch(prompt, 'touchstart', 600, 40);
    touch(prompt, 'touchmove', 602, 200);
    touch(prompt, 'touchend', 602, 200);
    expect(drawer.classList.contains('is-open')).toBe(false);
  });

  it('starts from the current focus when the dock comes back', () => {
    render(null, <div role="textbox" contentEditable aria-label="Prompt" />);
    act(() => host.querySelector<HTMLElement>('[aria-label="Prompt"]')!.focus());
    expect(host.querySelector('.matter-workbench')!.classList.contains('is-typing')).toBe(true);
    phoneDock = false;
    render(null, <div role="textbox" contentEditable aria-label="Prompt" />);
    act(() => (document.activeElement as HTMLElement).blur());
    phoneDock = true;
    render(null, <div role="textbox" contentEditable aria-label="Prompt" />);
    expect(host.querySelector('.matter-workbench')!.classList.contains('is-typing')).toBe(false);
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
    expect(host.querySelector('.matter-rail button[aria-label="Thread map"]')).toBeNull();
    nav = { openThreadMap: () => {} };
    render();
    expect(icon('.matter-rail button[aria-label="Thread map"]')).toBe('thread-map');
    expect(icon('.matter-toolbar-toggle')).toBe('thread-tools');
    // The hook is an attribute only: Classic renders the same lucide glyph.
    expect(host.querySelector('[data-icon="back"]')?.classList.contains('lucide')).toBe(true);
  });
});
