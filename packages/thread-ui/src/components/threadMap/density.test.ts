import { describe, expect, it } from 'vitest';
import {
  buildThreadMap,
  type ThreadMapDevice,
  type ThreadMapThread,
  type MapNode,
} from './model';
import { threadLeaves, mapPriority } from './readability';
import { DenseLayout, type DenseBox } from './density';
import { recencyFactor } from './model';
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

const collect = (items: DenseBox[]): DenseBox[] =>
  items.flatMap((b) => [b, ...collect(b.children ?? [])]);
it('never draws undersized thread or overflow cells on a narrow account map', () => {
  const boxes = collect(
    new DenseLayout().layout(
      root(),
      { x: 0, y: 0, width: 390, height: 750 },
      false,
      'all',
    ),
  );
  for (const box of boxes.filter((b) => b.node.thread && !b.overflow)) {
    expect(box.rect.width).toBeGreaterThanOrEqual(87.99);
    expect(box.rect.height).toBeGreaterThanOrEqual(33.99);
  }
  // Folded items sit in a low strip so the tiles keep the height.
  for (const box of boxes.filter((b) => b.overflow)) {
    expect(box.rect.width).toBeGreaterThanOrEqual(87.99);
    expect(box.rect.height).toBeLessThanOrEqual(22);
    expect(box.rect.height).toBeGreaterThanOrEqual(18);
  }
  expect(
    boxes.some((b) => b.overflow && b.overflow[0]?.kind === 'workspace'),
  ).toBe(true);
});
it('prioritizes waiting, running, unread failure, unread, pinned, then score in normal-sized overflow', () => {
  const list: ThreadMapThread[] = Array.from({ length: 60 }, (_, i) => ({
    ...thread(i),
    needsInput: undefined,
    running: false,
    failed: false,
    unread: false,
    turns: 4,
  }));
  list[59] = { ...list[59]!, needsInput: { kind: 'input' } };
  list[58] = { ...list[58]!, running: true };
  list[57] = { ...list[57]!, unread: true, failed: true };
  list[56] = { ...list[56]!, unread: true };
  list[55] = { ...list[55]!, pinned: true };
  const workspace = root([
    {
      id: 'a',
      name: 'A',
      state: 'ready',
      workspaces: [{ id: 'w', label: 'W', threads: list }],
    },
  ]).children[0]!.children[0]!;
  const boxes = new DenseLayout().layout(
    workspace,
    { x: 0, y: 0, width: 450, height: 216 },
    false,
    'all',
  );
  expect(
    boxes
      .filter((b) => !b.overflow)
      .slice(0, 5)
      .map((b) => b.node.thread!.key),
  ).toEqual(['59', '58', '57', '56', '55']);
  const overflow = boxes.find((b) => b.overflow)!;
  expect(
    overflow.overflow!.every(
      (n) => !['59', '58', '57', '56', '55'].includes(n.thread!.key),
    ),
  ).toBe(true);
  // Low enough to leave the height to tiles, and it never covers one.
  expect(overflow.rect.height).toBeLessThanOrEqual(22);
  for (const box of boxes.filter((b) => !b.overflow))
    expect(box.rect.y + box.rect.height).toBeLessThanOrEqual(overflow.rect.y + 0.01);
});
it('holds membership below 30% and through pointer freeze, then reconciles priority after thaw', () => {
  const device: ThreadMapDevice = {
    id: 'a',
    name: 'A',
    state: 'ready',
    workspaces: [
      {
        id: 'w',
        label: 'W',
        threads: Array.from({ length: 60 }, (_, i) => ({
          ...thread(i),
          needsInput: undefined,
          running: false,
          failed: false,
          unread: false,
          turns: 4,
        })),
      },
    ],
  };
  const make = () => root([device]).children[0]!.children[0]!;
  const first = make(),
    model = new DenseLayout(),
    bounds = { x: 0, y: 0, width: 360, height: 180 };
  const before = model.layout(first, bounds, false, 'all');
  const hidden = before.find((b) => b.overflow)!.overflow![0]!.id;
  const tiny = make();
  tiny.children.find((n) => n.id === hidden)!.weight *= 1.2;
  const shape = (boxes: DenseBox[]) =>
    boxes.map((b) => ({
      id: b.node.id,
      rect: b.rect,
      hidden: b.overflow?.map((n) => n.id),
    }));
  expect(shape(model.layout(tiny, bounds, false, 'all'))).toEqual(
    shape(before),
  );
  const waiting = make(),
    target = waiting.children.find((n) => n.id === hidden)!;
  target.thread = { ...target.thread!, needsInput: { kind: 'input' } };
  expect(shape(model.layout(waiting, bounds, true, 'all'))).toEqual(
    shape(before),
  );
  expect(model.layout(waiting, bounds, false, 'all')[0]!.node.id).toBe(hidden);
});

it.each([900, 390])(
  'never hides waiting or running threads behind history at %ipx',
  (width) => {
    const boxes = collect(
      new DenseLayout().layout(
        root(),
        { x: 0, y: 0, width, height: 706 },
        false,
        'all',
      ),
    );
    const hidden = boxes.flatMap((b) =>
      b.overflow ? threadLeaves(b.overflow) : [],
    );
    expect(hidden.some((n) => mapPriority(n) < 2)).toBe(false);
    if (width === 900)
      expect(hidden.some((n) => mapPriority(n) < 4)).toBe(false);
  },
);

it('includes recent folded-agent activity in active scope without reviving old unread history', () => {
  const old = {
    ...thread(9),
    unread: true,
    failed: true,
    lastActiveAt: new Date(now - 40 * 86400000).toISOString(),
  };
  const tree = buildThreadMap(
    [
      {
        id: 'd',
        name: 'D',
        state: 'ready',
        workspaces: [
          {
            id: 'w',
            label: 'W',
            threads: [
              {
                ...old,
                key: 'parent',
                children: [
                  {
                    ...thread(10),
                    running: false,
                    unread: false,
                    lastActiveAt: new Date(now).toISOString(),
                  },
                ],
              },
              old,
            ],
          },
        ],
      },
    ],
    'All',
    { scope: 'active', dense: true, keepDeviceRoot: true, now },
  );
  expect(
    tree.children[0]!.children[0]!.children.map((n) => n.thread!.key),
  ).toEqual(['parent']);
});
it('reconciles an unchanged-score thread that moves workspaces after freeze lifts', () => {
  const a = thread(10),
    b = thread(11),
    c = thread(12);
  const make = (moved: boolean) =>
    buildThreadMap(
      [
        {
          id: 'd',
          name: 'D',
          state: 'ready',
          workspaces: [
            { id: 'one', label: 'One', threads: moved ? [a] : [a, b] },
            { id: 'two', label: 'Two', threads: moved ? [b, c] : [c] },
          ],
        },
      ],
      'All',
      { scope: 'all', dense: true, keepDeviceRoot: true, now },
    );
  const cache = new DenseLayout(),
    bounds = { x: 0, y: 0, width: 900, height: 600 };
  cache.layout(make(false), bounds, false, 'all');
  const frozen = collect(cache.layout(make(true), bounds, true, 'all'));
  expect(
    frozen
      .find((n) => n.node.id === 'workspace:d:one')!
      .children!.some((n) => n.node.id === 'thread:11'),
  ).toBe(true);
  const thawed = collect(cache.layout(make(true), bounds, false, 'all'));
  expect(
    thawed
      .find((n) => n.node.id === 'workspace:d:two')!
      .children!.some((n) => n.node.id === 'thread:11'),
  ).toBe(true);
});

it('rebinds fresh content in a cached workspace when a sibling priority changes', () => {
  const make = (changed: boolean) =>
    buildThreadMap(
      [
        {
          id: 'd',
          name: 'D',
          state: 'ready',
          workspaces: [
            {
              id: 'one',
              label: 'One',
              threads: [
                {
                  ...thread(10),
                  needsInput: changed ? { kind: 'input' } : undefined,
                },
              ],
            },
            {
              id: 'two',
              label: 'Two',
              threads: [
                {
                  ...thread(11),
                  title: changed ? 'Renamed result' : 'Old result',
                },
              ],
            },
          ],
        },
      ],
      'All',
      { scope: 'all', dense: true, keepDeviceRoot: true, now },
    );
  const cache = new DenseLayout(),
    bounds = { x: 0, y: 0, width: 900, height: 600 };
  cache.layout(make(false), bounds, false, 'all');
  const plan = collect(cache.layout(make(true), bounds, false, 'all'));
  expect(plan.find((b) => b.node.id === 'thread:11')!.node.label).toBe(
    'Renamed result',
  );
  expect(
    plan.find((b) => b.node.id === 'thread:10')!.node.thread!.needsInput?.kind,
  ).toBe('input');
});
describe('recently used groups come first', () => {
  const stale = (i: number): ThreadMapThread => ({ ...thread(1000 + i), running: false, needsInput: undefined, unread: false, failed: false, interrupted: false, turns: 200, activeMs: 0, lastActiveAt: new Date(now - 10 * 86_400_000).toISOString() });
  const today = (i: number): ThreadMapThread => ({ ...thread(2000 + i), running: false, needsInput: undefined, unread: false, failed: false, interrupted: false, turns: 12, activeMs: 2 * 3_600_000, lastActiveAt: new Date(now - 3_600_000).toISOString() });
  const device = (old: number, fresh: number): ThreadMapDevice[] => [{ id: 'd', name: 'Device', state: 'ready', workspaces: [
    { id: 'old', label: 'old', threads: Array.from({ length: old }, (_, i) => stale(i)) },
    { id: 'fresh', label: 'fresh', threads: Array.from({ length: fresh }, (_, i) => today(i)) },
  ] }];
  const place = (devices: ThreadMapDevice[], width: number, height: number) => {
    const boxes = flat(new DenseLayout().layout(root(devices), { x: 0, y: 0, width, height }, false, 'all'));
    return { boxes, of: (id: string) => boxes.find((b) => b.node.id === `workspace:d:${id}`)! };
  };
  it('ranks a small workspace used today above a big one idle for over a week', () => {
    const tree = root(device(20, 2));
    const workspaces = tree.children[0]!.children;
    expect(workspaces[0]!.workspace!.id).toBe('fresh');
    expect(workspaces[0]!.weight).toBeGreaterThan(workspaces[1]!.weight);
  });
  it('gives it the larger block when everything fits', () => {
    const { of } = place(device(6, 2), 1200, 700);
    expect(of('fresh').rect.width * of('fresh').rect.height).toBeGreaterThan(of('old').rect.width * of('old').rect.height);
  });
  it('folds old threads rather than recent ones when room runs out', () => {
    const { boxes } = place(device(40, 4), 420, 300);
    const shown = boxes.filter((b) => b.node.thread && !b.overflow).map((b) => b.node.thread!.key);
    for (let i = 0; i < 4; i++) expect(shown).toContain(today(i).key);
    expect(boxes.filter((b) => b.overflow).flatMap((b) => b.overflow!).every((n) => n.workspace?.id !== 'fresh')).toBe(true);
  });
  it('still shows a long thread well when nothing else is recent', () => {
    expect(root(device(1, 0)).threads).toBe(1);
    expect(recencyFactor(stale(0), now)).toBeLessThan(0.1);
    expect(recencyFactor(today(0), now)).toBeGreaterThan(0.9);
  });
});
