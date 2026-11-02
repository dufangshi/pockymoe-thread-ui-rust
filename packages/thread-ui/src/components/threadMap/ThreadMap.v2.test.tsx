/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { ThreadMap } from './ThreadMap';
import type { ThreadMapProps } from './types';
import type { ThreadMapDevice, ThreadMapThread } from './model';

const now = Date.parse('2026-11-01T12:00:00Z');
const thread = (key: string, days = 0, extra: Partial<ThreadMapThread> = {}): ThreadMapThread => ({ key, title: `Thread ${key}`, href: `/t/${key}`, running: false, turns: 4, activeMs: 0, lastActiveAt: new Date(now - days * 86_400_000).toISOString(), ...extra });
const makeDevices = (): ThreadMapDevice[] => [{ id: 'd', name: 'Mac Studio', state: 'ready', workspaces: [
  { id: 'w', label: 'Product', threads: [thread('a'), thread('b', 3), thread('old', 30)] },
  { id: 'other', label: 'Archive', threads: [thread('archive', 60)] },
] }];

describe('ThreadMap page', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let host: HTMLDivElement, root: Root;
  let resizeHandlers: (() => void)[];
  beforeEach(() => {
    setLocale('en', false);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    resizeHandlers = [];
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resizeHandlers.push(callback); } observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const show = (props: Partial<ThreadMapProps> = {}) => act(() => root.render(<ThreadMap devices={makeDevices()} onOpen={vi.fn()} presentation="page" {...props} />));
  const click = (element: Element) => act(() => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  const key = (element: Element, value: string) => act(() => { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); });
  const tile = (id: string) => host.querySelector<HTMLElement>(`[data-map-id="thread:${id}"]:not(.thread-map-overflow-row)`)!;
  const link = (id: string) => tile(id).querySelector<HTMLAnchorElement>('a')!;

  it('does not list a device in the bottom strip while it is still being read', () => {
    show({ presentation: 'page', devices: [...makeDevices(), { id: 'slow', name: 'Slow', state: 'loading', workspaces: [] }, { id: 'empty', name: 'Empty', state: 'ready', workspaces: [] }] });
    const strip = host.querySelector('.thread-map-offline-strip')!;
    expect(strip.textContent).toContain('Empty');
    expect(strip.textContent).not.toContain('Slow');
  });
  it('defaults to all with icon-only two-state scope and filters historical threads with 2', () => {
    const scopeChanged = vi.fn(); show({ onScopeChange: scopeChanged });
    expect(host.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label')).toBe('All');
    expect(tile('a')).toBeTruthy(); expect(tile('old')).toBeTruthy(); expect(tile('archive')).toBeTruthy();
    expect(host.querySelectorAll('.thread-map-scope button')).toHaveLength(2);
    expect(host.querySelector('select')).toBeNull(); expect(host.querySelector('.thread-map-path')).toBeNull();
    key(host.querySelector('.thread-map')!, '2');
    expect(scopeChanged).toHaveBeenLastCalledWith('active'); expect(tile('b')).toBeFalsy(); expect(tile('old')).toBeFalsy();
    key(host.querySelector('.thread-map')!, '1');
    expect(scopeChanged).toHaveBeenLastCalledWith('all'); expect(tile('old')).toBeTruthy();
    expect(host.querySelector('[data-map-id="earlier:device:d"]')).toBeNull();
  });

  it('keeps filtering out of layout and Enter opens the first match; / focuses the field', () => {
    const devices = makeDevices(), onOpen = vi.fn();
    show({ devices, onOpen }); const before = tile('a').getAttribute('style');
    show({ devices, onOpen, filterText: 'Thread b' });
    expect(tile('a').dataset.dimmed).toBe('true'); expect(tile('b').dataset.dimmed).toBeUndefined();
    expect(tile('a').getAttribute('style')).toBe(before); expect(host.textContent).toContain('1 matches');
    key(link('b'), '/'); expect(document.activeElement).toBe(host.querySelector('input'));
    key(host.querySelector('input')!, 'Enter'); expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'b' }));
  });

  it('moves focus spatially and Space requests Quick Look', () => {
    const onQuickLook = vi.fn(); show({ onQuickLook, revealKey: 'b' });
    act(() => link('a').focus());
    const a = tile('a').style, b = tile('b').style;
    const ax = parseFloat(a.left) + parseFloat(a.width) / 2, ay = parseFloat(a.top) + parseFloat(a.height) / 2;
    const bx = parseFloat(b.left) + parseFloat(b.width) / 2, by = parseFloat(b.top) + parseFloat(b.height) / 2;
    key(link('a'), Math.abs(bx - ax) > Math.abs(by - ay) ? bx > ax ? 'ArrowRight' : 'ArrowLeft' : by > ay ? 'ArrowDown' : 'ArrowUp');
    expect(document.activeElement).toBe(link('b'));
    key(link('b'), ' '); expect(onQuickLook).toHaveBeenCalledWith('b');
    key(link('b'), 'Backspace'); expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('Mac Studio');
  });

  it('explicit scope changes reveal older members while pointer geometry is frozen', () => {
    show({ stableLayout: true });
    const canvas = host.querySelector('.thread-map-canvas')!;
    act(() => { canvas.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    key(host.querySelector('.thread-map')!, '2'); expect(tile('old')).toBeFalsy();
    key(host.querySelector('.thread-map')!, '1'); expect(tile('old')).toBeTruthy();
  });

  it('keeps a sparse historical workspace visible and navigates from its header', () => {
    show({ stableLayout: true });
    const space = host.querySelector('[data-map-id="workspace:d:other"] .thread-map-section-head')!;
    expect(space).toBeTruthy(); click(space);
    expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('Archive');
    expect(tile('archive')).toBeTruthy();
  });

  it('groups dense workspace rows in priority order and navigates across headers', () => {
    const onOpen = vi.fn(), onQuickLook = vi.fn();
    const threads = Array.from({ length: 600 }, (_, i) => ({ ...thread(`dense${i}`, 0, i < 2 ? { needsInput: { kind: 'input' } } : i === 2 ? { running: true } : i === 3 ? { unread: true, failed: true } : i === 4 ? { unread: true } : {}), agent: 'codex' }));
    const devices: ThreadMapDevice[] = [{ id: 'd', name: 'D', state: 'ready', workspaces: [{ id: 'w', label: 'W', threads }] }];
    show({ devices, scope: 'all', revealKey: 'dense0', currentKey: 'dense1', stableLayout: true, onOpen, onQuickLook });
    expect([...host.querySelectorAll('.thread-map-list-status-heading > span')].map(el => el.textContent)).toEqual(['Waiting for you', 'Running', 'Unread', 'Other']);
    const rows = host.querySelectorAll<HTMLElement>('.thread-map-list-row');
    expect(rows[0]!.querySelector('.thread-map-list-status-slot [data-status="waiting"]')).toBeTruthy();
    expect(rows[1]!.dataset.current).toBe('true');
    act(() => link('dense0').focus()); key(link('dense0'), 'ArrowDown'); expect(document.activeElement).toBe(link('dense1'));
    key(link('dense1'), 'ArrowDown'); expect(document.activeElement).toBe(link('dense2'));
    key(link('dense2'), 'ArrowUp'); expect(document.activeElement).toBe(link('dense1'));
    key(link('dense1'), ' '); expect(onQuickLook).toHaveBeenCalledWith('dense1');
    click(link('dense1')); expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'dense1' }));
  });

  it('keeps a focused workspace list and its scroll position through host hiding', () => {
    const devices: ThreadMapDevice[] = [{ id: 'd', name: 'D', state: 'ready', workspaces: [{ id: 'w', label: 'W', threads: Array.from({ length: 600 }, (_, i) => thread(`t${i}`)) }] }];
    show({ devices, scope: 'all', revealKey: 't0' });
    const list = host.querySelector<HTMLElement>('.thread-map-list-scroll')!;
    expect(list).toBeTruthy(); list.scrollTop = 240; host.hidden = true;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(0);
    act(() => resizeHandlers.forEach(callback => callback()));
    host.hidden = false;
    expect(host.querySelector('.thread-map-list-scroll')).toBe(list); expect(list.scrollTop).toBe(240);
  });

  it('populates an initially empty frozen map when async data arrives', () => {
    show({ devices: [], stableLayout: true });
    const canvas = host.querySelector('.thread-map-canvas')!;
    act(() => { canvas.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    show({ devices: makeDevices(), stableLayout: true });
    expect(tile('a')).toBeTruthy(); expect(host.querySelector('.thread-map-empty')).toBeNull();
  });

  it('reveals data arriving after an empty frozen map, including a new hidden device', () => {
    show({ devices: [], stableLayout: true, revealKey: 'late' });
    const canvas = host.querySelector('.thread-map-canvas')!;
    act(() => { canvas.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    const later: ThreadMapDevice = { id: 'late', name: 'Late device', state: 'ready', workspaces: [{ id: 'w', label: 'Late workspace', threads: [thread('late', 30)] }] };
    show({ devices: [...makeDevices(), later], stableLayout: true, revealKey: 'late' });
    expect(tile('late')).toBeTruthy(); expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('Late workspace');
  });

  it('fits attention cards by width, preserves priority and opens overflow as a keyboard menu', () => {
    const decision = vi.fn();
    const attention = ['unread', 'failed', 'input', 'approval', 'unread', 'unread', 'input'].map((kind, i) => ({ key: String(i), kind: kind as 'approval' | 'input' | 'failed' | 'unread', title: `Attention ${i}`, device: 'Mac', workspace: 'Product', since: '', summary: 'Review changes', requestId: 'r' }));
    show({ attention, onRequestDecision: decision });
    expect([...host.querySelectorAll('.thread-map-attention-card b')].map(n => n.textContent)).toEqual(['Attention 2', 'Attention 3', 'Attention 6', 'Attention 1', 'Attention 0', 'Attention 4']);
    click(host.querySelector('[aria-label="Approve"]')!);
    expect(decision).toHaveBeenCalledWith('3', 'r', 'approve');
    click(host.querySelector('.thread-map-attention-more')!);
    expect(host.querySelectorAll('.thread-map-attention-card')).toHaveLength(6);
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
    expect(document.activeElement?.textContent).toContain('Attention 5');
    key(document.activeElement!, 'End'); expect(document.activeElement?.textContent).toContain('Attention 5');
    key(document.activeElement!, 'Escape'); expect(document.querySelector('[role="menu"]')).toBeNull();
    show({ attention: [] }); expect(host.querySelector('.thread-map-attention-wrap')?.hasAttribute('data-visible')).toBe(false);
  });

  it('puts zero-thread devices in the same bottom strip without a canvas rectangle', () => {
    show({ devices: [...makeDevices(), { id: 'empty', name: 'LuisMini2', state: 'ready', workspaces: [] }] });
    expect(host.querySelector('[data-map-id="device:empty"]')).toBeNull();
    expect(host.querySelector('.thread-map-offline-strip button')?.textContent).toContain('LuisMini2');
    click(host.querySelector('.thread-map-offline-strip button')!);
    expect(host.querySelector('.thread-map-empty')?.textContent).toBe('No threads yet');
    expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('LuisMini2');
  });

  it('shows offline devices at the end and opens their cached view', () => {
    const offline: ThreadMapDevice = { id: 'offline', name: 'Travel Mac', state: 'offline', cachedAt: new Date(now - 3 * 3_600_000).toISOString(), workspaces: [{ id: 'cached', label: 'Cached work', threads: [thread('cached')] }] };
    show({ devices: [...makeDevices(), offline], stableLayout: true });
    act(() => host.querySelector('.thread-map-canvas')!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
    expect(tile('cached')).toBeFalsy();
    const row = host.querySelector('.thread-map-offline-strip button')!;
    expect(row.textContent).toContain('Travel MacOffline3 hr. agoCached');
    expect(row.querySelector('.thread-map-device-state')?.hasAttribute('data-offline')).toBe(true);
    click(row); expect(tile('cached')).toBeTruthy(); expect(host.querySelector('.thread-map-cached-label')?.textContent).toContain('Cached');
    click(host.querySelector('.thread-map-dense-toolbar > button')!);
    expect(tile('cached')).toBeFalsy(); expect(host.querySelector('.thread-map-offline-strip')?.textContent).toContain('Travel Mac');
  });

  it('marks waiting and unread independently and does not animate a waiting tile', () => {
    show({ devices: [{ ...makeDevices()[0]!, workspaces: [{ id: 'w', label: 'Product', threads: [thread('waiting', 60, { needsInput: { kind: 'approval' }, unread: true, running: true })] }] }] });
    expect(tile('waiting').hasAttribute('data-running')).toBe(false);
    expect(tile('waiting').querySelector('[data-status="waiting"]')?.getAttribute('aria-label')).toBe('Waiting for you');
    expect(tile('waiting').querySelector('[data-status="unread"]')).toBeTruthy();
  });

  it('shows folded agent requests as a waiting root tile instead of a running-only root', () => {
    show({ devices: [{ ...makeDevices()[0]!, workspaces: [{ id: 'w', label: 'Product', threads: [thread('parent', 0, { running: true, children: [thread('agent', 0, { needsInput: { kind: 'input' } })] })] }] }] });
    expect(tile('parent').querySelector('[data-status="waiting"]')).toBeTruthy();
    expect(tile('parent').hasAttribute('data-running')).toBe(false);
  });

  it('freezes layout under pointer/focus and reorders only 800ms after both leave', () => {
    vi.useFakeTimers();
    const devices = makeDevices(); show({ devices, scope: 'all', stableLayout: true });
    const canvas = host.querySelector('.thread-map-canvas')!;
    act(() => { canvas.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    const before = tile('a').getAttribute('style');
    const changed = [{ ...devices[0]!, workspaces: [{ ...devices[0]!.workspaces[0]!, threads: [thread('a'), thread('b', 0, { turns: 900 }), thread('old', 30)] }] }];
    show({ devices: changed, scope: 'all', stableLayout: true });
    // Removed workspaces also wait for thaw, keeping the tile under the pointer fixed.
    expect([...host.querySelectorAll('.thread-map-tile')].map(n => n.getAttribute('data-map-id'))).toEqual(['thread:a', 'thread:b', 'thread:old', 'thread:archive']);
    expect(tile('a').getAttribute('style')).toBe(before);
    act(() => link('a').focus());
    act(() => { canvas.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })); vi.advanceTimersByTime(800); });
    expect([...host.querySelectorAll('.thread-map-tile')][0]).toBe(tile('a'));
    act(() => { (document.activeElement as HTMLElement).blur(); vi.advanceTimersByTime(799); });
    expect([...host.querySelectorAll('.thread-map-tile')][0]).toBe(tile('a'));
    act(() => vi.advanceTimersByTime(1));
    expect([...host.querySelectorAll('.thread-map-tile')][0]).toBe(tile('b'));
    expect(tile('archive')).toBeFalsy();
  });

  it('reveals compressed threads and pulses once, without replaying on data refresh', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const devices = makeDevices();
    show({ devices, revealKey: 'old' });
    expect(tile('old')).toBeTruthy();
    expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('Product');
    expect(tile('old').dataset.pulse).toBe('done');
    act(() => tile('old').dispatchEvent(new Event('animationend', { bubbles: true })));
    show({ devices: [...devices], revealKey: 'old' });
    expect(tile('old').dataset.pulse).toBeUndefined();
  });

  it('reveals a device from the host Devices page and pulses its cached canvas', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    show({ revealKey: 'device:d' });
    expect(host.querySelector('.thread-map-crumbs [aria-current]')?.textContent).toBe('Mac Studio');
    expect(host.querySelector<HTMLElement>('.thread-map-canvas')?.dataset.pulse).toBe('done');
  });

  it('uses amber pulses for waiting and consumes repeated pulseKeys only once', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const devices = [{ ...makeDevices()[0]!, workspaces: [{ id: 'w', label: 'Product', threads: [thread('waiting', 0, { needsInput: { kind: 'input' } })] }] }];
    show({ devices, pulseKeys: ['waiting'] });
    expect(tile('waiting').dataset.pulse).toBe('waiting');
    act(() => tile('waiting').dispatchEvent(new Event('animationend', { bubbles: true })));
    show({ devices, pulseKeys: ['waiting'] }); expect(tile('waiting').dataset.pulse).toBeUndefined();
    show({ devices, pulseKeys: [] }); show({ devices, pulseKeys: ['waiting'] }); expect(tile('waiting').dataset.pulse).toBe('waiting');
  });

  it('consumes event pulses while a persistent page is hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const devices = makeDevices(); host.hidden = true;
    show({ devices, pulseKeys: ['a'] }); expect(tile('a').dataset.pulse).toBeUndefined();
    host.hidden = false; show({ devices, pulseKeys: ['a'] }); expect(tile('a').dataset.pulse).toBeUndefined();
  });

  it('renders cached threads during a quiet loading refresh', () => {
    show({ devices: [{ ...makeDevices()[0]!, state: 'loading' }] });
    expect(tile('a')).toBeTruthy();
    expect(host.querySelector('.thread-map-empty')).toBeNull();
  });

  it('does not drag-dismiss a page even when a host supplies onDismiss', () => {
    vi.useFakeTimers(); const onDismiss = vi.fn(); show({ onDismiss });
    const canvas = host.querySelector('.thread-map-canvas')!;
    const send = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: type === 'touchend' ? [] : [{ clientX: 100, clientY: y }], changedTouches: [{ clientX: 100, clientY: y }] });
      act(() => canvas.dispatchEvent(event));
    };
    send('touchstart', 100); send('touchmove', 300); send('touchend', 300);
    act(() => vi.runAllTimers()); expect(onDismiss).not.toHaveBeenCalled();
    expect(host.querySelector('[data-slot="dialog-close"]')).toBeNull();
  });

  it('keeps the device menu keyboard contract, including focus restoration', () => {
    const selected = vi.fn(); show({ deviceExtras: { d: { latencyMs: 12, runtimeVersion: '0.13.41', updateAvailable: true, runningCount: 2, waitingCount: 1, todayCostUsd: 1.23, metrics: 'CPU 8% · RAM 4 GB', menuItems: [{ id: 'detail', label: 'Details', onSelect: selected }, { id: 'update', label: 'Check update', onSelect: vi.fn() }] } } });
    const trigger = host.querySelector<HTMLButtonElement>('.thread-map-device-menu-button')!; click(trigger);
    const menu = document.querySelector('[role="menu"]')!;
    expect(document.activeElement?.textContent).toBe('Details'); key(document.activeElement!, 'ArrowDown'); expect(document.activeElement?.textContent).toBe('Check update');
    key(document.activeElement!, 'Escape'); expect(document.querySelector('[role="menu"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(menu).toBeTruthy();
  });
});
