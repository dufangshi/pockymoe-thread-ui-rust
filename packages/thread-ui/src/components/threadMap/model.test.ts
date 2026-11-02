import { describe, expect, it } from 'vitest';
import { buildThreadMap, inScope, recencyWeight, runningWeight, type MapNode, type ThreadMapDevice, type ThreadMapThread } from './model';
import { MapLayoutCache, spatialNeighbor, StableMapOrder } from './stableLayout';
import { orderAttention, type MapAttention } from './types';

const now = Date.parse('2026-11-01T12:00:00Z');
const day = 86_400_000;
const thread = (key: string, days = 0, extra: Partial<ThreadMapThread> = {}): ThreadMapThread => ({
  key, title: key, href: `/t/${key}`, running: false, turns: 9, activeMs: 0, lastActiveAt: new Date(now - days * day).toISOString(), ...extra,
});
const device = (threads: ThreadMapThread[]): ThreadMapDevice => ({ id: 'd', name: 'D', state: 'ready', workspaces: [{ id: 'w', label: 'W', threads }] });
const leaves = (root: MapNode) => root.children[0]!.children;

describe('map v2 model', () => {
  it('includes live, waiting and unread at every scope, with a 24h / 7d boundary', () => {
    expect([thread('new'), thread('yesterday', 1), thread('week', 7), thread('old', 8)].map(t => inScope(t, 'active', now))).toEqual([true, true, false, false]);
    expect([thread('new'), thread('week', 7), thread('old', 8)].map(t => inScope(t, 'week', now))).toEqual([true, true, false]);
    for (const t of [thread('live', 30, { running: true }), thread('wait', 30, { needsInput: { kind: 'input' } }), thread('read', 30, { unread: true }), thread('failed', .5, { failed: true }), thread('parent', 30, { children: [thread('child', 30, { needsInput: { kind: 'approval' } })] })]) {
      expect(inScope(t, 'active', now)).toBe(true); expect(inScope(t, 'week', now)).toBe(true);
    }
    expect(inScope(thread('failed', 2, { failed: true }), 'active', now)).toBe(false);
    expect(inScope(thread('unknown', 0, { lastActiveAt: undefined }), 'week', now)).toBe(false);
  });

  it('compresses older threads at weight 1.5 and expands only that workspace', () => {
    const devices = [device([thread('new'), thread('older', 20)]), { ...device([thread('other-old', 30)]), id: 'other' }];
    const root = buildThreadMap(devices, 'All', { scope: 'week', now });
    const ws = root.children.find(node => node.device?.id === 'd')!.children[0]!;
    expect(ws.children.find(node => node.compressed)).toMatchObject({ weight: 1.5, threads: 1, compressed: 'threads' });
    const expanded = buildThreadMap(devices, 'All', { scope: 'week', now, expandedWorkspaces: new Set(['workspace:d:w']) });
    expect(expanded.children.find(node => node.device?.id === 'd')!.children[0]!.children.map(n => n.thread?.key).sort()).toEqual(['new', 'older']);
    expect(expanded.children.find(node => node.device?.id === 'other')!.children[0]!.compressed).toBe('workspaces');
  });

  it('compresses wholly inactive workspaces and expands only that device', () => {
    const d = device([thread('old', 30)]);
    d.workspaces.push({ id: 'second', label: 'Second', threads: [thread('older', 40)] });
    const root = buildThreadMap([d], 'All', { scope: 'week', now });
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({ compressed: 'workspaces', threads: 2, weight: 1.5 });
    const expanded = buildThreadMap([d], 'All', { scope: 'week', now, expandedDevices: new Set(['device:d']) });
    expect(expanded.children.map(n => n.kind)).toEqual(['workspace', 'workspace']);
  });

  it('weights recency and keeps waiting and running threads above the live floor', () => {
    // Half every two days, down to a floor, so a month-old thread barely asks for room.
    expect([0, 4, 30].map(days => recencyWeight(thread('t', days), now))).toEqual([4, 1, 0.12]);
    expect(recencyWeight(thread('t', 0, { activeMs: 2 * 3_600_000 }), now)).toBe(10);
    expect(recencyWeight(thread('t', 30, { running: true }), now)).toBe(runningWeight(9));
    expect(recencyWeight(thread('t', 30, { needsInput: { kind: 'approval' } }), now)).toBe(runningWeight(9));
  });

  it('keeps order below 30% cumulative change and reorders after crossing it', () => {
    const order = new StableMapOrder();
    const build = (turns: number) => buildThreadMap([device([thread('a', 0, { turns: 100 }), thread('b', 0, { turns })])], 'All', { now });
    expect(leaves(order.apply(build(81), false)).map(n => n.label)).toEqual(['a', 'b']);
    expect(leaves(order.apply(build(121), false)).map(n => n.label)).toEqual(['a', 'b']); // b: 10 → 12
    expect(leaves(order.apply(build(196), false)).map(n => n.label)).toEqual(['b', 'a']); // b: 10 → 15
  });

  it('freezes the last displayed geometry, rather than snapping to a hysteresis baseline', () => {
    const order = new StableMapOrder();
    const build = (turns: number) => buildThreadMap([device([thread('a', 0, { turns: 100 }), thread('b', 0, { turns })])], 'All', { now });
    order.apply(build(81), false);
    order.apply(build(121), false);
    expect(leaves(order.apply(build(121), true)).map(n => [n.label, n.weight])).toEqual([['a', 11], ['b', 12]]);
  });

  it('freezes positions and weights during interaction, then applies pending order', () => {
    const order = new StableMapOrder();
    order.apply(buildThreadMap([device([thread('a', 0, { turns: 100 }), thread('b')])], 'All', { now }), false);
    const changed = () => buildThreadMap([device([thread('a', 0, { turns: 100 }), thread('b', 0, { turns: 900 })])], 'All', { now });
    expect(leaves(order.apply(changed(), true)).map(n => [n.label, n.weight])).toEqual([['a', 11], ['b', 4]]);
    expect(leaves(order.apply(changed(), false)).map(n => n.label)).toEqual(['b', 'a']);
    order.clear();
    expect(leaves(order.apply(changed(), true)).map(n => n.label)).toEqual(['b', 'a']);
  });

  it('defers additions and removals until the interaction freeze lifts', () => {
    const order = new StableMapOrder();
    order.apply(buildThreadMap([device([thread('a'), thread('b')])], 'All', { now }), false);
    const changed = () => buildThreadMap([device([thread('b'), thread('new')])], 'All', { now });
    expect(leaves(order.apply(changed(), true)).map(n => n.label)).toEqual(['a', 'b']);
    expect(leaves(order.apply(changed(), false)).map(n => n.label)).toEqual(['b', 'new']);
  });

  it('navigates by spatial direction, with no DOM geometry reads', () => {
    const items = [{ id: 'a', rect: { x: 0, y: 0, width: 100, height: 100 } }, { id: 'b', rect: { x: 120, y: 0, width: 100, height: 100 } }, { id: 'c', rect: { x: 0, y: 120, width: 100, height: 100 } }];
    expect(spatialNeighbor(items, 'a', 'ArrowRight')).toBe('b');
    expect(spatialNeighbor(items, 'a', 'ArrowDown')).toBe('c');
    expect(spatialNeighbor(items, 'c', 'ArrowUp')).toBe('a');
    expect(spatialNeighbor(items, 'b', 'ArrowLeft')).toBe('a');
    expect(spatialNeighbor(items, 'a', 'ArrowLeft')).toBeUndefined();
  });

  it('keeps activity-source ordering inside attention categories', () => {
    const items = ['unread', 'input', 'failed', 'approval', 'input'].map((kind, i) => ({ key: String(i), kind, title: '', device: '', workspace: '', since: '' } as MapAttention));
    expect(orderAttention(items).map(n => n.key)).toEqual(['1', '3', '4', '2', '0']);
  });

  it('lays out 650 threads inside one frame, including cache reuse after content changes', () => {
    const devices = [device(Array.from({ length: 650 }, (_, i) => thread(String(i), i % 30, { turns: i % 100 })))];
    const cache = new MapLayoutCache();
    const bounds = { x: 0, y: 0, width: 1440, height: 800 };
    // Warm the JIT; measure geometry, not React/jsdom or machine startup.
    for (let i = 0; i < 10; i++) cache.layout('w', leaves(buildThreadMap(devices, 'All')), bounds);
    const begin = performance.now();
    for (let i = 0; i < 20; i++) cache.layout('w', leaves(buildThreadMap(devices, 'All')), bounds);
    expect((performance.now() - begin) / 20).toBeLessThan(16);
  });
});
