/** @vitest-environment jsdom */
import { act, type default as React } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellNavContext, type AppShellNavContextValue } from '../app-shell/AppShellNavContext';
import { setLocale } from '../i18n';
import { MatterWorkbench, type MatterWorkbenchOptions, type WorkbenchThread } from './MatterWorkbench';

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
    expect(topbar().querySelector('.matter-running-chip')?.getAttribute('aria-label')).toBe('2 conversations are running on this account. Show them');
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
    // Shortcuts start folded and need no reorder hint.
    const shortcuts = drawer.querySelector<HTMLButtonElement>('button.matter-section-heading')!;
    expect(shortcuts.getAttribute('aria-expanded')).toBe('false');
    act(() => shortcuts.click());
    expect([...drawer.querySelectorAll('[data-testid="shortcuts"] [data-shortcut]')].map(row => row.getAttribute('data-shortcut'))).toEqual(['b', 'a']);
    expect(drawer.querySelector('.matter-shortcut-hint')).toBeNull();
    expect(drawer.querySelector('.matter-sidebar-footer')).toBeNull();
  });

  it("lists this workspace's threads above the recent ones from elsewhere", () => {
    options = { ...baseOptions, threads: [thread('a'), thread('x'), thread('y')], workspaceThreads: [thread('a'), thread('b')] };
    render();
    const sidebar = host.querySelector('aside.matter-sidebar')!;
    const keys = (id: string) => [...sidebar.querySelectorAll(`[data-testid="${id}"] .matter-thread-row`)].map(row => row.getAttribute('href'));
    expect(sidebar.querySelector('.matter-sidebar-upper [data-testid="workspace-threads"]')).not.toBeNull();
    expect(keys('workspace-threads')).toEqual([thread('a').href, thread('b').href]);
    expect(keys('recent-chats')).toEqual([thread('x').href, thread('y').href]);
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

  it('counts the account\'s running threads and opens them, then finished unread ones', () => {
    options = {
      ...baseOptions,
      threads: [thread('a', 'running'), thread('b', 'unread'), thread('c'), thread('e', 'unread')],
      // A thread never opened, on another device, one already listed, and the
      // one finished thread the host knows was read before (e was never opened).
      activeThreads: [{ ...thread('d', 'running'), key: 'mac:d', title: 'D elsewhere' }, thread('a', 'running'), thread('b', 'unread')],
    };
    render();
    const chip = topbar().querySelector<HTMLButtonElement>('.matter-running-chip')!;
    expect(chip.textContent).toContain('2');
    expect(chip.getAttribute('aria-label')).toBe('2 conversations are running on this account. Show them');
    act(() => chip.click());
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Running threads"]')!;
    expect(sheet.hasAttribute('data-open')).toBe(true);
    const sections = [...sheet.querySelectorAll('h3')].map(heading => heading.textContent);
    expect(sections).toEqual(['Running 2', 'Finished, not read yet 1']);
    const rows = [...sheet.querySelectorAll('.matter-thread-row .matter-thread-copy > span')].map(row => row.textContent);
    expect(rows).toEqual(['A', 'D elsewhere', 'B']);
    expect(host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!.hasAttribute('data-open')).toBe(false);
    act(() => [...sheet.querySelectorAll('button')].find(item => item.textContent === 'All threads')!.click());
    expect(sheet.hasAttribute('data-open')).toBe(false);
    expect(host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!.hasAttribute('data-open')).toBe(true);
  });

  it('lists running and unread agent threads inside their conversations, counting conversations', () => {
    const agent = (key: string, status: string) => ({ ...thread(key, status), rootKey: 'root', parentKey: 'root' });
    options = {
      ...baseOptions,
      threads: [thread('x')],
      activeThreads: [agent('w1', 'running'), agent('w2', 'running'), thread('solo', 'running'), thread('root'), agent('w3', 'unread')],
    };
    render();
    const chip = topbar().querySelector<HTMLButtonElement>('.matter-running-chip')!;
    expect(chip.getAttribute('aria-label')).toBe('2 conversations are running on this account. Show them');
    act(() => chip.click());
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Running threads"]')!;
    expect([...sheet.querySelectorAll('h3')].map(heading => heading.textContent)).toEqual(['Running 2', 'Finished, not read yet 1']);
    const [running, unread] = [...sheet.querySelectorAll('.matter-thread-section')];
    // The root leads its group (its dot says its agent threads run); the agents fold under it.
    expect([...running!.querySelectorAll(':scope > div > .matter-thread-entry .matter-thread-copy > span')].map(row => row.textContent)).toEqual(['ROOT', 'SOLO']);
    // The count is a small toggle in the root's row; the agents open under it on demand.
    const toggle = running!.querySelector<HTMLButtonElement>('.matter-agent-toggle')!;
    expect(toggle.textContent).toBe('2');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(running!.querySelector('.matter-agent-children')).toBeNull();
    act(() => toggle.click());
    expect([...running!.querySelectorAll('.matter-agent-children .matter-thread-copy > span')].map(row => row.textContent)).toEqual(['W1', 'W2']);
    expect(running!.querySelector('.matter-status-dot')?.getAttribute('data-status')).toBe('agents-running');
    expect([...unread!.querySelectorAll(':scope > div > .matter-thread-entry .matter-thread-copy > span')].map(row => row.textContent)).toEqual(['ROOT']);
  });

  it('lists an agent thread\'s notifications under its conversation', () => {
    const at = (minute: number) => `2026-10-16T10:${String(minute).padStart(2, '0')}:00Z`;
    options = { ...baseOptions, unreadCount: 3, notifications: [
      { id: 'n1', title: 'Worker done', href: '/threads/w1', occurredAt: at(3), threadKey: 'w1', rootKey: 'r', rootTitle: 'Main task', rootHref: '/threads/r' },
      { id: 'n2', title: 'Other done', href: '/threads/o', occurredAt: at(2), threadKey: 'o' },
      { id: 'n3', title: 'Helper done', href: '/threads/w2', occurredAt: at(1), threadKey: 'w2', rootKey: 'r', rootTitle: 'Main task', rootHref: '/threads/r' },
    ] };
    render();
    act(() => button('Notifications')!.click());
    const panel = host.querySelector('section.matter-notifications')!;
    const group = panel.querySelector('.matter-notification-group')!;
    expect(group.querySelector('.matter-notification-root')?.textContent).toBe('Main task');
    expect([...group.querySelectorAll(':scope > a:not(.matter-notification-root)')].map(item => item.textContent?.slice(0, 11))).toEqual(['Worker done', 'Helper done']);
    expect([...panel.querySelectorAll(':scope > a')].map(item => item.textContent?.slice(0, 10))).toEqual(['Other done']);
  });

  it('keeps notifications on the bell, out of the thread sheet', () => {
    options = { ...baseOptions, unreadCount: 1, notifications: [{ id: 'n1', title: 'Build finished', href: '/threads/x', occurredAt: '2026-10-16T10:00:00Z' }] };
    render();
    const sheet = host.querySelector('section.matter-phone-sheet[aria-label="Threads"]')!;
    expect(sheet.textContent).not.toContain('Build finished');
    expect(button('Notifications')).not.toBeNull();
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
    expect(icon('.matter-nav-strip > button[aria-expanded]')).toBe('sidebar');
    expect(icon('button[aria-label="Go back"]')).toBe('back');
    expect(icon('button[aria-label="Go forward"]')).toBe('forward');
    // On the desktop the rail's brand is the way home; the tabs row starts with search.
    expect(host.querySelector('.matter-rail a.matter-brand')?.getAttribute('href')).toBe('/workspaces');
    expect(host.querySelector('header.matter-topbar')).toBeNull();
    expect(host.querySelector('.matter-tabs-row .matter-tabs-search .matter-search-trigger')).not.toBeNull();
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

describe('desktop tabs', () => {
  const tab = (key: string, extra: Partial<WorkbenchThread> = {}): WorkbenchThread => ({ key, title: key.toUpperCase(), subtitle: '', href: `/threads/${key}`, status: 'idle', favorite: false, ...extra });
  it('lists the open conversations and closes them like editor tabs', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const onNavigate = vi.fn(), onCloseTab = vi.fn();
    options = { ...baseOptions, currentKey: 'local:b', onNavigate, onCloseTab,
      workspaceThreads: [tab('local:z')],
      openTabs: [tab('local:a'), tab('local:b'), tab('local:b1', { rootKey: 'local:b' }), tab('local:c')] };
    render();
    const titles = [...host.querySelectorAll('.matter-thread-tabs .matter-group-tab > span:last-child')].map(node => node.textContent);
    expect(titles).toEqual(['LOCAL:A', 'LOCAL:B', 'LOCAL:C']);
    // Closing another tab only closes it; closing the open one moves to its neighbour.
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close LOCAL:A"]')!.click());
    expect(onCloseTab).toHaveBeenLastCalledWith('local:a');
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close LOCAL:B"]')!.click());
    expect(onNavigate).toHaveBeenCalledWith('/threads/local:c');
    expect(onCloseTab).toHaveBeenLastCalledWith('local:b');
  });

  it('keeps the sidebar switch, Back and Forward atop the sidebar, then in the tabs row when it folds', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    render();
    const strip = () => host.querySelector('.matter-nav-strip');
    expect(strip()?.parentElement?.classList.contains('matter-sidebar')).toBe(true);
    expect(host.querySelector('nav.matter-rail button[aria-label="Go back"]')).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('.matter-nav-strip button[aria-expanded]')!.click());
    expect(strip()?.parentElement?.classList.contains('matter-tabs-row')).toBe(true);
    expect([...strip()!.querySelectorAll('button, a')].map(control => control.getAttribute('aria-label'))).toEqual(['Toggle shortcuts sidebar', 'Go back', 'Go forward', 'Back to workspaces']);
    expect(strip()!.querySelector('a')?.getAttribute('href')).toBe('/workspaces');
  });

  it('offers New thread right after this workspace\'s count', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    options = { ...baseOptions, workspaceThreads: [tab('local:a')] };
    act(() => root.render(
      <AppShellNavContext.Provider value={{ phoneDock: false } as AppShellNavContextValue}>
        <MatterWorkbench options={options} title="A" homeHref="/workspaces" settings={null}
          newThread={<button aria-label="New thread" />} actions={null} threadMenu={null} connection={null}
          explorer={null} revealExplorer={0}><p>Conversation</p></MatterWorkbench>
      </AppShellNavContext.Provider>,
    ));
    const row = host.querySelector('.matter-section-heading-row')!;
    expect(row.querySelector('.matter-section-heading')?.textContent).toContain('This workspace');
    expect(row.querySelector('.matter-section-add [aria-label="New thread"]')).not.toBeNull();
  });

  it('opens the thread\'s own menu on a right-click on a tab or a row, instead of the browser\'s', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const contexts: { key: string; x: number; y: number; close: () => void }[] = [];
    options = { ...baseOptions, currentKey: 'local:a', workspaceThreads: [tab('local:a'), tab('local:b')],
      renderThreadMenu: (thread, context) => {
        if (!context) return null;
        contexts.push({ key: thread.key, x: context.x, y: context.y, close: context.onClose });
        return <div data-testid="thread-menu">{thread.title}</div>;
      } };
    render();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 30 });
    act(() => { host.querySelectorAll('.matter-thread-tabs .matter-group-tab')[1]!.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(host.querySelector('[data-testid="thread-menu"]')?.textContent).toBe('LOCAL:B');
    expect(contexts.at(-1)).toMatchObject({ key: 'local:b', x: 120, y: 30 });
    act(() => contexts.at(-1)!.close());
    expect(host.querySelector('[data-testid="thread-menu"]')).toBeNull();
    const row = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 200 });
    act(() => { host.querySelector('[data-testid="workspace-threads"] .matter-thread-row')!.dispatchEvent(row); });
    expect(row.defaultPrevented).toBe(true);
    expect(contexts.at(-1)).toMatchObject({ key: 'local:a', x: 40, y: 200 });
  });
});
