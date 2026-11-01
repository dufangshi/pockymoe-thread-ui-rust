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

describe('ThreadMap v2 page', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let host: HTMLDivElement, root: Root;
  beforeEach(() => {
    setLocale('en', false);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const show = (props: Partial<ThreadMapProps> = {}) => act(() => root.render(<ThreadMap devices={makeDevices()} onOpen={vi.fn()} presentation="page" {...props} />));
  const click = (element: Element) => act(() => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  const key = (element: Element, value: string) => act(() => { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); });
  const tile = (id: string) => host.querySelector<HTMLElement>(`[data-map-id="thread:${id}"]`)!;
  const link = (id: string) => tile(id).querySelector<HTMLAnchorElement>('a')!;

  it('defaults page scope to week, compresses locally, and switches scope with 1/2/3', () => {
    const scopeChanged = vi.fn(); show({ onScopeChange: scopeChanged });
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe('7 days');
    expect(tile('a')).toBeTruthy(); expect(tile('old')).toBeFalsy();
    click(host.querySelector('[data-map-id="earlier:workspace:d:w"]')!);
    expect(tile('old')).toBeTruthy(); expect(tile('archive')).toBeFalsy();
    key(host.querySelector('.thread-map')!, '1');
    expect(scopeChanged).toHaveBeenLastCalledWith('active'); expect(tile('b')).toBeFalsy();
    key(host.querySelector('.thread-map')!, '3');
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

  it('renders attention in priority order, caps at six, and resolves approvals', () => {
    const decision = vi.fn();
    const attention = ['unread', 'failed', 'input', 'approval', 'unread', 'unread', 'input'].map((kind, i) => ({ key: String(i), kind: kind as 'approval' | 'input' | 'failed' | 'unread', title: `Attention ${i}`, device: 'Mac', workspace: 'Product', since: '', summary: 'Review changes', requestId: 'r' }));
    show({ attention, onRequestDecision: decision });
    expect([...host.querySelectorAll('.thread-map-attention-card b')].map(n => n.textContent)).toEqual(['Attention 2', 'Attention 3', 'Attention 6', 'Attention 1', 'Attention 0', 'Attention 4']);
    click([...host.querySelectorAll('button')].find(b => b.textContent === 'Approve')!);
    expect(decision).toHaveBeenCalledWith('3', 'r', 'approve');
    click(host.querySelector('.thread-map-attention-more')!);
    expect(host.querySelectorAll('.thread-map-attention-card')).toHaveLength(7);
    show({ attention: [] }); expect(host.querySelector('.thread-map-attention-wrap')?.hasAttribute('data-visible')).toBe(false);
  });

  it('shows offline devices at the end and opens their cached view', () => {
    const offline: ThreadMapDevice = { id: 'offline', name: 'Travel Mac', state: 'offline', cachedAt: new Date(now - 3 * 3_600_000).toISOString(), workspaces: [{ id: 'cached', label: 'Cached work', threads: [thread('cached')] }] };
    show({ devices: [...makeDevices(), offline] });
    expect(tile('cached')).toBeFalsy();
    const row = host.querySelector('.thread-map-offline-strip button')!;
    expect(row.textContent).toContain('Travel MacOffline3 hr. agoCached');
    expect(row.querySelector('.thread-map-device-state')?.hasAttribute('data-offline')).toBe(true);
    click(row); expect(tile('cached')).toBeTruthy(); expect(host.querySelector('.thread-map-cached-label')?.textContent).toContain('Cached');
    click(host.querySelector('.thread-map-path > button')!);
    expect(tile('cached')).toBeFalsy(); expect(host.querySelector('.thread-map-offline-strip')?.textContent).toContain('Travel Mac');
  });

  it('marks waiting and unread independently and does not animate a waiting tile', () => {
    show({ devices: [{ ...makeDevices()[0]!, workspaces: [{ id: 'w', label: 'Product', threads: [thread('waiting', 60, { needsInput: { kind: 'approval' }, unread: true, running: true })] }] }] });
    expect(tile('waiting').hasAttribute('data-running')).toBe(false);
    expect(tile('waiting').querySelector('[data-status="waiting"]')?.getAttribute('aria-label')).toBe('Waiting for you');
    expect(tile('waiting').querySelector('[data-status="unread"]')).toBeTruthy();
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
