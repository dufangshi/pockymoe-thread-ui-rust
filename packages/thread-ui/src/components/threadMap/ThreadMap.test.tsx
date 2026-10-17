/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { ThreadMap } from './ThreadMap';
import { buildThreadMap, heatLevel, runningWeight, threadWeight, type MapNode, type ThreadMapDevice, type ThreadMapThread } from './model';
import { ageTier, formatAge, formatShortDuration, promptLine, ThreadTile } from './ThreadTile';
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

  it('weighs a running thread, or one whose agent threads run, like a long one at least', () => {
    expect(runningWeight(0)).toBe(10);
    expect(runningWeight(100)).toBe(30);
    const root = buildThreadMap([{ id: 'd', name: 'D', state: 'ready', workspaces: [{ id: 'w', label: 'w', threads: [
      thread('idle', { turns: 100 }),
      thread('lead', { turns: 1, children: [thread('worker', { running: true })] }),
    ] }] }], 'All');
    const [first, second] = root.children[0]!.children;
    expect(first!.thread!.key).toBe('lead');
    expect(first).toMatchObject({ weight: runningWeight(1), running: 1 });
    expect(second).toMatchObject({ weight: 11, running: 0 });
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
  const link = (key: string) => host.querySelector<HTMLAnchorElement>(`a.thread-map-tile-link[href="/threads/${key}"]`);
  const tile = (key: string) => link(key)?.closest<HTMLElement>('.thread-map-tile') ?? null;
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
    expect(link('a')!.getAttribute('aria-label')).toBe('Thread a · Codex · app · 100 turns · ran 4 h 0 min in 24 h · Running');
    expect(busy.dataset.heat).toBe('4');
    expect(busy.hasAttribute('data-running')).toBe(true);
    expect(busy.querySelector('.thread-map-agent')!.getAttribute('data-agent')).toBe('codex');
    const current = tile('b')!;
    expect(link('b')!.getAttribute('aria-label')).toMatch(/^Thread b · Claude · app · 4 turns · idle for 24 h$/);
    expect(link('b')!.getAttribute('aria-current')).toBe('page');
    expect(current.dataset.heat).toBe('0');
    expect(host.querySelector('section[aria-label="Server · Offline"]')!.getAttribute('data-state')).toBe('offline');
    expect(host.querySelector('.thread-map-summary')!.textContent).toBe('3 threads · 1 running');
    // Every level answers: a thread opens from its tile inside its device...
    expect(host.querySelector('[inert]')).toBeNull();
    click(link('b')!);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'b' }));
    // ...and a workspace inside a device opens from its header row, straight from the top.
    const appHead = button(/^Open app/);
    expect(appHead.classList.contains('thread-map-section-head')).toBe(true);
    click(appHead);
    expect(crumbs()).toEqual(['All devices', 'Laptop', 'app*']);
    click(button('Up one level'));
    // A block too small for its threads folds up and opens to them.
    click(button('Up one level'));
    const docs = host.querySelector('section[aria-label^="docs"]')!;
    expect(docs.hasAttribute('data-collapsed')).toBe(true);
    click(docs.querySelector('button.thread-map-zoom')!);
    // Without activity from its device a thread still shows, unheated.
    expect(link('c')!.getAttribute('aria-label')).toBe('Thread c · Codex · docs');
    expect(tile('c')!.dataset.heat).toBe('0');
  });

  it('shows the agents running inside a block too small for everything in it', () => {
    // A small map and a crowded workspace: everything in it cannot show.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160);
    const crowd = Array.from({ length: 300 }, (_, index) => thread(`q${index}`, { turns: 0 }));
    show([
      { id: 'big', name: 'Big', state: 'ready', workspaces: [{ id: 'main', label: 'main', threads: Array.from({ length: 6 }, (_, index) => thread(`m${index}`, { turns: 2500 })) }] },
      { id: 'wsl', name: 'WSL', state: 'ready', workspaces: [{ id: 'lab', label: 'lab', threads: [...crowd, thread('live', { turns: 2, running: true })] }] },
    ]);
    const lab = host.querySelector<HTMLElement>('section[data-map-id="workspace:wsl:lab"]')!;
    expect(lab.hasAttribute('data-collapsed')).toBe(false);
    expect(lab.hasAttribute('data-live')).toBe(true);
    expect(lab.querySelector('a.thread-map-tile-link[href="/threads/live"]')).not.toBeNull();
    expect(lab.querySelector('a.thread-map-tile-link[href="/threads/q0"]')).toBeNull();
    expect(lab.querySelector('.thread-map-section-summary')!.textContent).toBe('+300 more threads');
    expect(host.querySelector('section[data-map-id="device:wsl"]')!.hasAttribute('data-live')).toBe(true);
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

  it('opens a thread up into its agent threads and folds them back from its bar', () => {
    const parentThread = thread('p', { title: 'Plan', turns: 40, children: [
      thread('k1', { title: 'Worker one', turns: 9, running: true }),
      thread('k2', { title: 'Worker two', turns: 4 }),
    ] });
    show([{ id: 'laptop', name: 'Laptop', state: 'ready', workspaces: [{ id: 'app', label: 'app', threads: [parentThread] }] }]);
    click(button(/^Open app/));
    expect(link('k1')).toBeNull();
    click(button(/^Show the 2 agent threads Plan started/));
    const group = host.querySelector('section.thread-map-group')!;
    expect(group.querySelector('.thread-map-section-label')!.textContent).toBe('Plan');
    expect(link('k1')!.closest('section')).toBe(group);
    expect(tile('k1')!.hasAttribute('data-running')).toBe(true);
    expect(group.querySelector('a.thread-map-group-open')!.getAttribute('href')).toBe('/threads/p');
    click(button('Fold the agent threads back into Plan'));
    expect(host.querySelector('section.thread-map-group')).toBeNull();
    expect(link('k1')).toBeNull();
  });

  // jsdom has no Touch: plain events carry the lists the handlers read.
  const touch = (type: string, points: [number, number][]) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const list = points.map(([clientX, clientY]) => ({ clientX, clientY }));
    Object.assign(event, { touches: type === 'touchend' ? [] : list, changedTouches: list });
    act(() => { host.querySelector('.thread-map-canvas')!.dispatchEvent(event); });
  };

  it('goes up a level when two fingers pinch in', () => {
    show(devices);
    click(button(/^Open Laptop/));
    expect(crumbs()).toEqual(['All devices', 'Laptop*']);
    touch('touchstart', [[100, 300], [500, 300]]);
    touch('touchmove', [[250, 300], [350, 300]]);
    touch('touchend', []);
    expect(crumbs()).toEqual(['All devices*']);
  });

  it('closes when dragged down, and settles back after a short drag', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      act(() => root.render(<div className="thread-map-dialog"><ThreadMap devices={devices} onOpen={() => {}} onDismiss={onDismiss} /></div>));
      touch('touchstart', [[300, 200]]);
      touch('touchmove', [[302, 240]]);
      touch('touchend', []);
      act(() => { vi.runAllTimers(); });
      expect(onDismiss).not.toHaveBeenCalled();
      expect(host.querySelector<HTMLElement>('.thread-map-dialog')!.style.transform).toBe('');
      touch('touchstart', [[300, 200]]);
      touch('touchmove', [[300, 260]]);
      touch('touchmove', [[301, 360]]);
      touch('touchend', []);
      act(() => { vi.runAllTimers(); });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says when there is nothing to show yet', () => {
    show([{ id: 'd', name: 'D', state: 'loading', workspaces: [] }]);
    expect(host.querySelector('section[aria-label="D · Loading…"]')).not.toBeNull();
    show([{ id: 'd', name: 'D', state: 'ready', workspaces: [] }]);
    expect(host.querySelector('[role="status"]')!.textContent).toBe('No threads yet');
  });
});

describe('ThreadTile', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let host: HTMLDivElement, root: Root;
  const now = Date.parse('2026-10-16T12:00:00Z');
  beforeEach(() => {
    setLocale('zh-CN', false);
    vi.useFakeTimers({ now, toFake: ['Date'] });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    setLocale('en', false);
  });
  const busy = thread('a', {
    agent: 'claude', agentName: 'Claude', model: 'opus', running: true, turns: 69, totalMs: 25 * 3_600_000, activeMs: 2 * 3_600_000,
    hourlyMs: [...Array(22).fill(0), 3_600_000, 3_600_000], createdAt: '2026-10-09T08:00:00Z', lastActiveAt: '2026-10-16T11:58:00Z',
    lastPrompt: '[PHOTO ./a.png] 看一下 这个  页面',
  });
  const show = (box: { width: number; height: number }, item = busy) => {
    const parent = { id: 'w', kind: 'workspace', label: 'app', children: [], weight: 0, turns: 0, activeMs: 0, threads: 0, running: 0, usd: 0, tokens: 0 } as MapNode;
    const node: MapNode = { id: 'thread:a', kind: 'thread', label: item.title, parent, children: [], weight: 1, turns: 0, activeMs: 0, threads: 1, running: 0, usd: 0, tokens: 0, thread: item };
    act(() => root.render(<ThreadTile node={node} box={{ x: 0, y: 0, ...box }} hours={24} current={false} onOpen={() => {}} hover={{}} />));
    return host.querySelector<HTMLElement>('.thread-map-tile')!;
  };
  const text = (tile: Element, selector: string) => tile.querySelector(selector)?.textContent ?? null;

  it('fills a big tile: who and what, the latest prompt, total and recent run time, an hourly strip and the age', () => {
    const tile = show({ width: 300, height: 260 });
    expect(tile.dataset.size).toBe('card');
    expect(text(tile, '.thread-map-tile-who')).toBe('Claude · opus');
    expect(text(tile, '.thread-map-tile-live')).toBe('运行中');
    expect(text(tile, '.thread-map-tile-prompt')).toBe('[图片] 看一下 这个 页面');
    expect([...tile.querySelectorAll('.thread-map-stats > span')].map(cell => cell.textContent)).toEqual(['69轮', '25 小时总运行', '2 小时近 24 小时']);
    expect(tile.querySelectorAll('.thread-map-spark i')).toHaveLength(24);
    expect(tile.querySelector('.thread-map-age-glyph')!.getAttribute('data-age')).toBe('2');
    expect(text(tile, '.thread-map-age')).toBe('7 天');
    expect(tile.querySelector('a')!.getAttribute('aria-label')).toContain('总运行 25 小时 0 分钟 · 近 24 小时运行 2 小时 0 分钟');
  });

  it('shows tokens and the API price with its breakdown control', () => {
    const tile = show({ width: 300, height: 260 }, { ...busy, tokenUsage: { totalTokens: 17_200_000, inputTokens: 17_000_000, cachedInputTokens: 16_000_000, outputTokens: 200_000, reasoningOutputTokens: 0 },
      priceEstimate: { totalUsd: 4.55, inputUsd: 0.5, cachedInputUsd: 3.42, outputUsd: 0.63 } });
    const usage = tile.querySelector('.thread-map-stats .thread-map-usage')!;
    expect(usage.querySelector('button.thread-turn-usage-price')!.textContent).toBe('$4.55');
    expect(text(usage, '.thread-map-tokens')).toBe('17m');
    expect(tile.querySelector('a')!.getAttribute('aria-label')).toContain('17m tokens · API 费用 $4.55');
    // A narrower card has them on a row of their own; a small tile leaves them out.
    expect(show({ width: 200, height: 200 }, { ...busy, priceEstimate: { totalUsd: 4.55, inputUsd: 0, cachedInputUsd: 0, outputUsd: 0 } })
      .querySelector(':scope > .thread-map-usage')).not.toBeNull();
    expect(show({ width: 100, height: 60 }, { ...busy, priceEstimate: { totalUsd: 4.55, inputUsd: 0, cachedInputUsd: 0, outputUsd: 0 } })
      .querySelector('.thread-map-usage')).toBeNull();
  });

  it('says which thread started an agent thread shown on its own, where the tile has room', () => {
    const worker = { ...busy, from: '重构首页' };
    const tile = show({ width: 300, height: 260 }, worker);
    expect(text(tile, '.thread-map-tile-from')).toBe('由 重构首页 创建');
    expect(tile.querySelector('a')!.getAttribute('aria-label')).toContain('Claude · opus · app · 由 重构首页 创建');
    // Small tiles drop the words; the tile's label keeps them.
    const small = show({ width: 120, height: 90 }, worker);
    expect(small.querySelector('.thread-map-tile-from')).toBeNull();
    expect(small.querySelector('a')!.getAttribute('aria-label')).toContain('由 重构首页 创建');
  });

  it('drops details as the tile shrinks, keeping what fits', () => {
    const tall = show({ width: 110, height: 220 });
    expect(tall.querySelector('.thread-map-stats')!.getAttribute('data-layout')).toBe('column');
    expect(tall.querySelector('.thread-map-tile-who')).toBeNull();
    const medium = show({ width: 120, height: 60 });
    expect(text(medium, '.thread-map-tile-meta')).toBe('69 轮 · 共 25 小时');
    expect(medium.querySelector('.thread-map-age-glyph')).not.toBeNull();
    expect(medium.querySelector('.thread-map-tile-prompt, .thread-map-spark, .thread-map-stats')).toBeNull();
    const small = show({ width: 70, height: 30 });
    expect(small.dataset.size).toBe('named');
    expect(small.querySelector('.thread-map-age, .thread-map-tile-meta')).toBeNull();
    expect(show({ width: 12, height: 12 }).textContent).toBe('');
  });

  it('formats figures, ages and prompts', () => {
    expect([30_000, 37 * 60_000, 4.24 * 3_600_000, 37 * 3_600_000, 300 * 3_600_000].map(formatShortDuration)).toEqual(['<1 分', '37 分', '4.2 小时', '37 小时', '13 天']);
    expect(['2026-10-16T01:00:00Z', '2026-10-12T00:00:00Z', '2026-09-30T00:00:00Z', '2026-08-01T00:00:00Z', '2025-01-01T00:00:00Z', 'bad'].map(at => ageTier(at, now))).toEqual([0, 1, 2, 3, 4, null]);
    expect(formatAge('2026-08-01T00:00:00Z', now)).toBe('2 个月');
    expect(promptLine('fix [FILE /tmp/a.log]\n now')).toBe('fix [文件] now');
  });
});
