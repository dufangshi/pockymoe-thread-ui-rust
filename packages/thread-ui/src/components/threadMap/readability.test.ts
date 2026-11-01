import { describe, expect, it } from 'vitest';
import { buildThreadMap, type ThreadMapThread } from './model';
import { byPriority, mapPriority, ReadableSelection } from './readability';

const now = Date.parse('2026-11-01T12:00:00Z');
const thread = (key: string, extra: Partial<ThreadMapThread> = {}): ThreadMapThread => ({ key, title: key, href: '#', running: false, turns: 4, activeMs: 0, lastActiveAt: new Date(now).toISOString(), ...extra });
const workspace = (threads: ThreadMapThread[], scope: 'all' | 'week' = 'all') => buildThreadMap([{ id: 'd', name: 'D', state: 'ready', workspaces: [{ id: 'w', label: 'W', threads }] }], 'All', { scope, now }).children[0]!;
const crowd = (count = 150) => workspace(Array.from({ length: count }, (_, i) => thread(`t${String(i).padStart(3, '0')}`))).children;
const bounds = { x: 0, y: 0, width: 640, height: 400 };
const ids = (plan: ReturnType<ReadableSelection['select']>) => plan.entries.map(entry => entry.node.id);

describe('page map readability selection', () => {
  it('prioritizes waiting, running, unread failure/interruption, completed unread and shortcuts before scores', () => {
    const nodes = workspace([
      thread('idle', { turns: 900 }), thread('pin', { shortcut: true }), thread('read-fail', { failed: true }),
      thread('unread', { unread: true }), thread('failure', { failed: true, unread: true }),
      thread('interrupted', { interrupted: true, unread: true }), thread('running', { running: true }), thread('waiting', { needsInput: { kind: 'approval' } }),
    ]).children.sort(byPriority);
    expect(nodes.map(mapPriority)).toEqual([0, 1, 2, 2, 3, 4, 5, 5]);
    expect(nodes[0]!.thread!.key).toBe('waiting');
    expect(nodes[1]!.thread!.key).toBe('running');
    expect(nodes.at(-2)!.thread!.key).toBe('idle');
  });

  it('keeps every chosen thread above the readable minimum and uses exactly one overflow', () => {
    for (const size of [{ width: 640, height: 400 }, { width: 284, height: 258 }, { width: 1440, height: 700 }]) {
      const plan = new ReadableSelection().select('w', crowd(600), { x: 0, y: 0, ...size }, 'threads', false);
      expect(plan.entries.length).toBeGreaterThan(0); expect(plan.entries.length).toBeLessThan(600);
      for (const { rect } of plan.entries) { expect(rect.width - 6).toBeGreaterThanOrEqual(131.99); expect(rect.height - 6).toBeGreaterThanOrEqual(63.99); }
      expect(plan.overflow!.count + plan.entries.length).toBe(600);
      expect(plan.overflow!.rect.width).toBeGreaterThanOrEqual(138);
      expect(plan.overflow!.rect.height).toBeGreaterThanOrEqual(70);
    }
  });

  it('uses readable wide rows when squarify would choose narrow columns', () => {
    const plan = new ReadableSelection().select('w', crowd(10), { x: 0, y: 0, width: 264, height: 144 }, 'threads', false);
    expect(plan.entries.length).toBe(1);
    expect(plan.entries[0]!.rect.width - 6).toBeGreaterThanOrEqual(132);
    expect(plan.entries[0]!.rect.height - 6).toBeGreaterThanOrEqual(64);
  });

  it('retains the important set before showing any ordinary scored thread', () => {
    const nodes = workspace([thread('waiting', { needsInput: { kind: 'input' } }), thread('running', { running: true }), thread('failed', { unread: true, failed: true }), ...Array.from({ length: 40 }, (_, i) => thread(String(i), { turns: 10000 }))]).children;
    const plan = new ReadableSelection().select('w', nodes, bounds, 'threads', false);
    expect(ids(plan)).toEqual(expect.arrayContaining(['thread:waiting', 'thread:running', 'thread:failed']));
    expect(plan.overflow?.waiting).toBe(0); expect(plan.overflow?.running).toBe(0);
  });

  it('aggregates urgent counts when the important set alone cannot fit', () => {
    const nodes = workspace(Array.from({ length: 30 }, (_, i) => thread(String(i), i % 2 ? { running: true } : { needsInput: { kind: 'input' } }))).children;
    const plan = new ReadableSelection().select('w', nodes, { x: 0, y: 0, width: 300, height: 220 }, 'threads', false);
    expect(plan.overflow!.waiting + plan.overflow!.running + plan.entries.length).toBe(30);
  });

  it('merges out-of-scope and out-of-room threads, retaining preview titles', () => {
    const ws = workspace([...Array.from({ length: 20 }, (_, i) => thread(`recent${i}`)), thread('older1', { lastActiveAt: '2026-01-01' }), thread('older2', { lastActiveAt: '2026-01-02' })], 'week');
    const plan = new ReadableSelection().select('w', ws.children, { x: 0, y: 0, width: 300, height: 220 }, 'threads', false);
    expect(plan.overflow?.older).toBe(2);
    expect(plan.overflow!.count + plan.entries.length).toBe(22);
    expect(plan.overflow!.recent.length).toBe(3);
  });

  it('holds chosen membership and geometry below 30% cumulative score movement', () => {
    const cache = new ReadableSelection(), nodes = crowd(30).map(node => ({ ...node, weight: 10 }));
    const initial = cache.select('w', nodes, bounds, 'threads', false);
    const hidden = nodes.find(node => !ids(initial).includes(node.id))!;
    const changed = (weight: number) => nodes.map(node => node.id === hidden.id ? { ...node, weight } : node);
    const small = cache.select('w', changed(12), bounds, 'threads', false);
    expect(ids(small)).toEqual(ids(initial)); expect(small.entries.map(entry => entry.rect)).toEqual(initial.entries.map(entry => entry.rect));
    expect(ids(cache.select('w', changed(15), bounds, 'threads', false))).toContain(hidden.id);
  });

  it('defers state-class promotion under pointer/focus freeze, then reveals it on thaw', () => {
    const cache = new ReadableSelection(), nodes = crowd(30);
    const initial = cache.select('w', nodes, bounds, 'threads', false);
    const hidden = nodes.find(node => !ids(initial).includes(node.id))!;
    const waiting = nodes.map(node => node.id === hidden.id ? { ...node, thread: { ...node.thread!, needsInput: { kind: 'input' as const } } } : node);
    const initialOrder = cache.ordered('w', nodes).map(node => node.id);
    const frozen = cache.select('w', waiting, bounds, 'threads', true);
    expect(cache.ordered('w', waiting).map(node => node.id)).toEqual(initialOrder);
    expect(cache.rank('w', waiting.find(node => node.id === hidden.id)!)).toBe(5);
    expect(ids(frozen)).toEqual(ids(initial)); expect(frozen.overflow!.waiting).toBe(1);
    expect(ids(cache.select('w', waiting, bounds, 'threads', false))[0]).toBe(hidden.id);
    expect(cache.rank('w', waiting.find(node => node.id === hidden.id)!)).toBe(0);
  });

  it('fills a first nonempty level even if interaction was already frozen', () => {
    const cache = new ReadableSelection(); cache.select('w', [], bounds, 'threads', true);
    expect(cache.select('w', crowd(10), bounds, 'threads', true).entries.length).toBeGreaterThan(0);
  });

  it('compresses groups without starving the leading device under skewed weights', () => {
    const root = buildThreadMap(Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: String(i), state: 'ready' as const, workspaces: [{ id: 'w', label: 'W', threads: [thread(String(i), i === 0 ? { needsInput: { kind: 'approval' }, turns: 1000 } : {})] }] })), 'All', { keepDeviceRoot: true });
    const plan = new ReadableSelection().select('root', root.children, { x: 0, y: 0, width: 870, height: 650 }, 'devices', false);
    expect(plan.entries[0]!.node.device!.id).toBe('0');
    expect(plan.overflow!.count + plan.entries.length).toBe(12);
    for (const { rect } of plan.entries) { expect(rect.width).toBeGreaterThanOrEqual(176); expect(rect.height).toBeGreaterThanOrEqual(236); }
  });
});
