import { describe, expect, it } from 'vitest';
import {
  buildThreadMap,
  type ThreadMapDevice,
  type ThreadMapThread,
  type MapNode,
} from './model';
import { DenseLayout, type DenseBox } from './density';
const now = Date.now();
const thread = (i: number): ThreadMapThread => ({
  key: String(i),
  title: `Thread ${i}`,
  href: `#${i}`,
  running: i === 3 || i === 65,
  needsInput: i === 0 ? { kind: 'approval' } : undefined,
  unread: i % 3 === 2,
  failed: i % 6 === 2,
  turns: (i * 7) % 180,
  activeMs: 0,
  lastActiveAt: new Date(
    now - (i < 5 ? i : 100 + i * 23) * 3600000,
  ).toISOString(),
});
export function realShape(): ThreadMapDevice[] {
  let serial = 0;
  return (
    [
      ['wsl', 21, 58],
      ['ubuntu', 4, 21],
      ['zzq docker', 2, 5],
      ['mac', 7, 17],
      ['LuisMini2', 0, 0],
      ['Ubuntu Docker', 1, 4],
      ['Titoliember', 2, 4],
      ['gm wsl', 1, 7],
      ['LuisMini1', 1, 1],
    ] as const
  ).map(([name, spaces, total], d) => ({
    id: String(d),
    name,
    state: 'ready',
    workspaces: Array.from({ length: spaces }, (_, w) => ({
      id: String(w),
      label: `workspace-${w}`,
      threads: Array.from(
        { length: Math.floor(total / spaces) + (w < total % spaces ? 1 : 0) },
        () => thread(serial++),
      ),
    })),
  }));
}
const root = (devices = realShape()) =>
  buildThreadMap(
    devices.filter((d) => d.workspaces.some((w) => w.threads.length)),
    'All',
    { scope: 'all', dense: true, keepDeviceRoot: true, now },
  );
const flat = (boxes: DenseBox[]): DenseBox[] =>
  boxes.flatMap((b) => [b, ...flat(b.children ?? [])]);
describe('desktop density from real account shape', () => {
  it.each([706, 662])(
    'shows every one of 117 threads at 1240×%i with no overflow',
    (height) => {
      const boxes = flat(
        new DenseLayout().layout(
          root(),
          { x: 0, y: 0, width: 1240, height },
          false,
          'all',
        ),
      );

      expect(boxes.filter((b) => b.node.thread && !b.overflow)).toHaveLength(
        117,
      );
      expect(boxes.filter((b) => b.overflow)).toHaveLength(0);
      for (const b of boxes.filter((b) => b.node.thread)) {
        expect(b.rect.width).toBeGreaterThanOrEqual(87.99);
        expect(b.rect.height).toBeGreaterThanOrEqual(33.99);
      }
    },
  );
  it('active filters historical unread failures rather than allocating earlier blocks', () => {
    const tree = buildThreadMap(realShape(), 'All', {
      scope: 'active',
      dense: true,
      keepDeviceRoot: true,
      now,
    });
    const visit = (n: MapNode): MapNode[] => [n, ...n.children.flatMap(visit)];
    expect(visit(tree).filter((n) => n.thread)).toHaveLength(6);
    expect(visit(tree).some((n) => n.kind === 'compressed')).toBe(false);
  });
});
