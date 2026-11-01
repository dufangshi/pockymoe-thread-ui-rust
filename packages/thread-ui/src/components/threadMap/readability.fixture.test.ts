import { describe, expect, it } from 'vitest';
import { buildThreadMap, type MapNode, type ThreadMapDevice } from './model';
import { mapPriority, ReadableSelection } from './readability';
import type { MapRect } from './squarify';

const now = Date.parse('2026-11-01T12:00:00Z');
function fixture(threadsPerWorkspace: number, extraUnread = false): ThreadMapDevice[] {
  return Array.from({ length: 3 }, (_, d) => ({ id: `d${d}`, name: ['Build Box', 'Studio Linux', 'MacBook Pro'][d]!, state: 'ready' as const,
    workspaces: Array.from({ length: 6 }, (_, w) => ({ id: `w${w}`, label: `Workspace ${w}`, threads: Array.from({ length: threadsPerWorkspace }, (_, t) => ({
      key: `${d}:${w}:${t}`, title: `Thread ${d}/${w}/${t}`, href: '#', agent: 'codex', turns: 1 + t * 7 % 47,
      running: w === 0 && t === 2, needsInput: w === 0 && t < 2 ? { kind: t === 0 ? 'approval' as const : 'input' as const } : undefined,
      unread: extraUnread && w === 0 && (t === 3 || t === 4), failed: extraUnread && w === 0 && t === 3,
      activeMs: t * 120000, lastActiveAt: new Date(now - (w >= 4 ? 30 * 86400000 : (t % 5) * 86400000 + t * 60000)).toISOString(),
    })) })),
  }));
}
function draw(root: MapNode, bounds: MapRect) {
  const cache = new ReadableSelection(), visible: string[] = [], containers: string[] = [];
  const visit = (parent: MapNode, area: MapRect) => {
    const kind = parent.kind === 'workspace' ? 'threads' : parent.kind === 'device' ? 'workspaces' : 'devices';
    const plan = cache.select(parent.id, parent.children, area, kind, false);
    for (const { node, rect } of plan.entries) {
      if (node.thread) {
        expect(rect.width - 6).toBeGreaterThanOrEqual(131.99); expect(rect.height - 6).toBeGreaterThanOrEqual(63.99);
        visible.push(node.id);
      } else {
        containers.push(node.id); const header = node.kind === 'device' ? 36 : 28;
        visit(node, { x: 3, y: header, width: rect.width - 12, height: rect.height - 6 - header - 3 });
      }
    }
  };
  visit(root, bounds); return { visible, containers };
}
function urgent(root: MapNode): string[] { return root.thread ? mapPriority(root) < 4 ? [root.id] : [] : root.children.flatMap(urgent); }

describe('real desktop fixture hierarchy', () => {
  for (const threadsPerWorkspace of [10, 60]) for (const size of [{ width: 1240, height: 900 }, { width: 1000, height: 550 }]) {
    it(`keeps all important threads at root: 3 devices × 6 workspaces × ${threadsPerWorkspace}, ${size.width}×${size.height}`, () => {
      const root = buildThreadMap(fixture(threadsPerWorkspace), 'All', { scope: 'week', now, keepDeviceRoot: true });
      const drawn = draw(root, { x: 0, y: 0, ...size });
      expect(drawn.visible).toEqual(expect.arrayContaining(urgent(root)));
      for (let d = 0; d < 3; d++) expect(drawn.containers).toContain(`workspace:d${d}:w0`);
    });
  }
  it('still exposes the leading workspace when unread history exceeds the whole device budget', () => {
    const devices = fixture(60);
    for (const d of devices) for (const w of d.workspaces) for (const t of w.threads) t.unread = true;
    const root = buildThreadMap(devices, 'All', { scope: 'week', now, keepDeviceRoot: true });
    for (const device of root.children) {
      const drawn = draw(device, { x: 0, y: 0, width: 300, height: 500 });
      for (let t = 0; t < 3; t++) expect(drawn.visible).toContain(`thread:${device.device!.id.slice(1)}:0:${t}`);
    }
  });

  it('reserves compact overflow area rather than scaling it with the busiest workspace', () => {
    const root = buildThreadMap(fixture(60), 'All', { scope: 'week', now, keepDeviceRoot: true });
    const device = root.children[0]!;
    const plan = new ReadableSelection().select(device.id, device.children, { x: 0, y: 0, width: 1200, height: 800 }, 'workspaces', false);
    expect(plan.entries.length).toBeGreaterThan(0);
    expect(plan.overflow!.rect.width * plan.overflow!.rect.height).toBeLessThan(1200 * 800 * .25);
  });

  it('does not fold a whole spacious narrow device into one overflow', () => {
    const root = buildThreadMap(fixture(60), 'All', { scope: 'week', now, keepDeviceRoot: true });
    for (const device of root.children) {
      const drawn = draw({ ...device, kind: 'device' }, { x: 0, y: 0, width: 300, height: 500 });
      expect(drawn.visible).toEqual(expect.arrayContaining(urgent(device)));
    }
  });
});
