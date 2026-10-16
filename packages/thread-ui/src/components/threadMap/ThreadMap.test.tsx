/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { ThreadMap } from './ThreadMap';
import { buildThreadMap, heatLevel, threadWeight, type ThreadMapDevice, type ThreadMapThread } from './model';
import { squarify } from './squarify';

const thread = (key: string, extra: Partial<ThreadMapThread> = {}): ThreadMapThread => ({
  key, title: `Thread ${key}`, href: `/threads/${key}`, agent: 'codex', running: false, turns: 4, activeMs: 0, ...extra,
});
const devices: ThreadMapDevice[] = [
  { id: 'laptop', name: 'Laptop', state: 'ready', workspaces: [
    { id: 'app', label: 'app', threads: [thread('a', { turns: 100, activeMs: 4 * 3_600_000, running: true }), thread('b', { agent: 'claude' })] },
    { id: 'docs', label: 'docs', threads: [thread('c', { turns: null, activeMs: null })] },
    { id: 'empty', label: 'empty', threads: [] },
  ] },
  { id: 'server', name: 'Server', state: 'offline', workspaces: [] },
];

describe('thread map model', () => {
  it('lays weights out as areas inside the bounds', () => {
    const placed = squarify([6, 3, 1], value => value, { x: 0, y: 0, width: 100, height: 50 });
    const areas = placed.map(({ rect }) => rect.width * rect.height);
    expect(areas.map(area => Math.round(area))).toEqual([3000, 1500, 500]);
    for (const { rect } of placed) {
      expect(rect.x + rect.width).toBeLessThanOrEqual(100.0001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(50.0001);
    }
    expect(squarify([0, 0], value => value, { x: 0, y: 0, width: 10, height: 10 })).toEqual([]);
  });

  it('grows gently with turns and heats like a contribution graph', () => {
    expect(threadWeight(0)).toBe(1);
    expect(threadWeight(100)).toBe(11);
    expect(threadWeight(null)).toBe(1);
    expect([0, 1, 10 * 60_000, 11 * 60_000, 3_600_000, 3 * 3_600_000, 4 * 3_600_000].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 4]);
  });

  it('groups threads by device and workspace, skips empty workspaces and keeps unlisted devices', () => {
    const root = buildThreadMap(devices, 'All');
    expect(root.children.map(node => node.label)).toEqual(['Laptop', 'Server']);
    const laptop = root.children[0]!;
    expect(laptop.children.map(node => node.label)).toEqual(['app', 'docs']);
    expect(laptop).toMatchObject({ threads: 3, running: 1, turns: 104 });
    expect(root.children[1]!.weight).toBeGreaterThan(0);
    // One device needs no device level.
    expect(buildThreadMap([devices[0]!], 'All')).toMatchObject({ kind: 'root', label: 'Laptop' });
  });
});

describe('ThreadMap', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let host: HTMLDivElement, root: Root;
  beforeEach(() => {
    setLocale('en', false);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const show = (list: ThreadMapDevice[], onOpen = vi.fn(), currentKey?: string) => {
    act(() => root.render(<ThreadMap devices={list} currentKey={currentKey} onOpen={onOpen} />));
    return onOpen;
  };
  const tile = (key: string) => host.querySelector<HTMLAnchorElement>(`a[href="/threads/${key}"]`);
  const button = (label: RegExp | string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find(item => (typeof label === 'string' ? item.getAttribute('aria-label') === label || item.textContent === label : label.test(item.getAttribute('aria-label') ?? '')))!;
  const crumbs = () => [...host.querySelectorAll('.thread-map-crumbs button')].map(item => `${item.textContent}${item.hasAttribute('aria-current') ? '*' : ''}`);
  const click = (target: Element) => act(() => { target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
  const choose = (value: string) => {
    const picker = host.querySelector<HTMLSelectElement>('.thread-map-goto select')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(picker, value);
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  it('shows threads with their agent, heat and running state, and opens one', () => {
    const onOpen = show(devices, vi.fn(), 'b');
    const busy = tile('a')!;
    expect(busy.getAttribute('aria-label')).toBe('Thread a · Codex · app · 100 turns · ran 4 h 0 min in 24 h · Running');
    expect(busy.dataset.heat).toBe('4');
    expect(busy.hasAttribute('data-running')).toBe(true);
    expect(busy.querySelector('.thread-map-agent')!.getAttribute('data-agent')).toBe('codex');
    const current = tile('b')!;
    expect(current.getAttribute('aria-label')).toMatch(/^Thread b · Claude · app · 4 turns · idle for 24 h$/);
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.dataset.heat).toBe('0');
    expect(host.querySelector('section[aria-label="Server · Offline"]')!.getAttribute('data-state')).toBe('offline');
    expect(host.querySelector('.thread-map-summary')!.textContent).toBe('3 threads · 1 running');
    click(current);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'b' }));
    // A block too small for its threads folds up and opens to them.
    const docs = host.querySelector('section[aria-label^="docs"]')!;
    expect(docs.hasAttribute('data-collapsed')).toBe(true);
    click(docs.querySelector('button')!);
    // Without activity from its device a thread still shows, unheated.
    expect(tile('c')!.getAttribute('aria-label')).toBe('Thread c · Codex · docs');
    expect(tile('c')!.dataset.heat).toBe('0');
  });

  it('drills into a device and a workspace and back', () => {
    show(devices);
    click(button(/^Open Laptop/));
    expect(crumbs()).toEqual(['All devices', 'Laptop*']);
    click(button(/^Open app/));
    expect(crumbs()).toEqual(['All devices', 'Laptop', 'app*']);
    expect(tile('c')).toBeNull();
    click(button('Up one level'));
    expect(crumbs()).toEqual(['All devices', 'Laptop*']);
    click(button('All devices'));
    expect(button('Up one level').disabled).toBe(true);
  });

  it('reaches every block from the Go to picker', () => {
    const onOpen = show([devices[0]!]);
    expect(crumbs()).toEqual(['Laptop*']);
    choose('workspace:laptop:docs');
    expect(crumbs()).toEqual(['Laptop', 'docs*']);
    choose('thread:c');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'c' }));
  });

  it('says when there is nothing to show yet', () => {
    show([{ id: 'd', name: 'D', state: 'loading', workspaces: [] }]);
    expect(host.querySelector('section[aria-label="D · Loading…"]')).not.toBeNull();
    show([{ id: 'd', name: 'D', state: 'ready', workspaces: [] }]);
    expect(host.querySelector('[role="status"]')!.textContent).toBe('No threads yet');
  });
});
