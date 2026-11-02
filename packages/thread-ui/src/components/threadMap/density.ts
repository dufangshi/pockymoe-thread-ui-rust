import type { MapNode } from './model';
import { mapPriority, threadLeaves } from './readability';
import { squarify, type MapRect } from './squarify';

export const DENSE_MIN = { width: 88, height: 34 };
const GAP = 2;
export interface DenseBox {
  node: MapNode;
  rect: MapRect;
  children?: DenseBox[];
  overflow?: MapNode[];
}
const roomOf = (nodes: readonly MapNode[]): number => nodes.reduce((sum, n) => sum + shape(n).room, 0);
interface Result {
  boxes: DenseBox[];
  missing: number;
  /** The room of the hidden threads: hiding a week-old thread costs less than hiding today's. */
  lost: number;
  important: number;
  invalid: number;
}
const fits = (r: MapRect) =>
  r.width >= DENSE_MIN.width - 0.01 && r.height >= DENSE_MIN.height - 0.01;
/** Devices and workspaces sit further apart than threads, so blocks read as groups. */
const gapOf = (n: MapNode) =>
  n.kind === 'device' ? 4 : n.kind === 'workspace' ? 3 : GAP;
const paddingOf = (n: MapNode) => (n.kind === 'device' ? 3 : 2);
// Children subtract their own trailing gap, so a frame gives it back.
const childGapOf = (n: MapNode) => (n.kind === 'device' ? 3 : GAP);
const inside = (r: MapRect, gap = GAP): MapRect => ({
  x: r.x,
  y: r.y,
  width: Math.max(0, r.width - gap),
  height: Math.max(0, r.height - gap),
});
interface Shape {
  leaves: number;
  workspaces: number;
  devices: number;
  rank: number;
  loss: number;
  /** Room its threads ask for, which follows how recently they were used. */
  room: number;
  fingerprint: string;
}
const shapes = new WeakMap<MapNode, Shape>();
/** Stats are immutable during one plan. Cache each subtree once instead of
 * walking all 600 leaves again for every allocation candidate and comparator. */
function shape(node: MapNode): Shape {
  const cached = shapes.get(node);
  if (cached) return cached;
  const rank = node.thread ? mapPriority(node) : 5;
  const value: Shape = {
    leaves: node.thread ? 1 : 0,
    workspaces: node.kind === 'workspace' ? 1 : 0,
    devices: node.kind === 'device' ? 1 : 0,
    rank,
    room: node.thread ? (node.room ?? 1) : 0,
    loss: node.thread ? ([1e12, 1e9, 1e6, 1e3, 0, 0][rank] ?? 0) : 0,
    fingerprint: `${node.id}:${node.parent?.id}:${node.weight}:${rank}`,
  };
  if (!node.thread)
    for (const child of children(node)) {
      const nested = shape(child);
      value.leaves += nested.leaves;
      value.workspaces += nested.workspaces;
      value.devices += nested.devices;
      value.rank = Math.min(value.rank, nested.rank);
      value.loss += nested.loss;
      value.room += nested.room;
      value.fingerprint += `[${nested.fingerprint}]`;
    }
  shapes.set(node, value);
  return value;
}
const byPriority = (a: MapNode, b: MapNode) =>
  shape(a).rank - shape(b).rank ||
  b.weight - a.weight ||
  a.id.localeCompare(b.id);
const priorityLoss = (nodes: readonly MapNode[]) =>
  nodes.reduce((sum, n) => sum + shape(n).loss, 0);
/** Folded items take one low strip along the bottom, so tiles keep the height. */
const OVERFLOW_STRIP = 22;
const overflowStrip = (bounds: MapRect): MapRect => ({
  x: bounds.x,
  y: bounds.y + Math.max(0, bounds.height - OVERFLOW_STRIP - GAP),
  width: Math.max(0, bounds.width - GAP),
  height: Math.min(OVERFLOW_STRIP, Math.max(0, bounds.height - GAP)),
});
const aboveStrip = (bounds: MapRect): MapRect => ({
  ...bounds,
  height: Math.max(0, bounds.height - OVERFLOW_STRIP - GAP),
});
const header = (n: MapNode) => (n.kind === 'device' ? 22 : 18);
/** What a framed node takes from its cell before its children get any. */
const frameOf = (n: MapNode) => {
  const gap = gapOf(n),
    pad = paddingOf(n),
    child = childGapOf(n);
  return { x: gap + pad * 2 - child, y: header(n) + gap + pad - child };
};
const children = (n: MapNode) =>
  n.children.filter(
    (c) => c.kind !== 'compressed' && (c.thread || c.threads > 0),
  );
// Container area reflects the number of minimum readable cells plus header
// overhead, rather than accumulated turns that can starve sparse workspaces.
function footprint(n: MapNode, overhead = 0.6): number {
  const value = shape(n);
  return value.leaves + value.workspaces * overhead + value.devices;
}
function grids<T>(items: T[], bounds: MapRect, minimumHeight: number) {
  const result: { item: T; rect: MapRect }[][] = [];
  const max = Math.min(
    items.length,
    Math.floor(bounds.width / (DENSE_MIN.width + GAP)),
  );
  for (let cols = 1; cols <= max; cols++) {
    const rows = Math.ceil(items.length / cols),
      w = bounds.width / cols,
      h = bounds.height / rows;
    if (h < minimumHeight) continue;
    result.push(
      items
        .map((item, i) => ({
          item,
          rect: {
            x: bounds.x + (i % cols) * w,
            y: bounds.y + Math.floor(i / cols) * h,
            width:
              i >= (rows - 1) * cols
                ? bounds.width / (items.length - (rows - 1) * cols)
                : w,
            height: h,
          },
        }))
        .map((entry, i) =>
          i >= (rows - 1) * cols
            ? {
                ...entry,
                rect: {
                  ...entry.rect,
                  x: bounds.x + (i % cols) * entry.rect.width,
                },
              }
            : entry,
        ),
    );
  }
  return result.sort(
    (a, b) =>
      Math.abs(Math.log(a[0]!.rect.width / a[0]!.rect.height / 2.5)) -
      Math.abs(Math.log(b[0]!.rect.width / b[0]!.rect.height / 2.5)),
  );
}
function threadPlan(items: MapNode[], bounds: MapRect): Result {
  const ordered = [...items].sort(byPriority);
  const maximum =
    Math.floor(bounds.width / 90) * Math.floor(bounds.height / 36);
  for (
    let count = Math.min(ordered.length, Math.max(0, maximum));
    count >= 0;
    count--
  ) {
    const hidden = ordered.slice(count),
      visible = ordered.slice(0, count);
    const cells = visible.map((node) => ({ node }));
    if (!cells.length && !hidden.length)
      return { boxes: [], missing: 0, lost: 0, important: 0, invalid: 0 };
    const area = hidden.length ? aboveStrip(bounds) : bounds;
    const median =
      [...visible].sort((a, b) => a.weight - b.weight)[
        Math.floor(visible.length / 2)
      ]?.weight || 1;
    const candidates = [
      squarify(
        cells,
        (c) =>
          Math.max(1, Math.min(1.8, c.node.weight / median)),
        area,
      ),
      squarify(cells, () => 1, area),
      ...grids(cells, area, 36),
    ];
    const layout = candidates.find(
      (c) => c.length === cells.length && c.every((e) => fits(inside(e.rect))),
    );
    if (!layout && count > 0) continue;
    const boxes: DenseBox[] = (layout ?? []).map(({ item, rect }) => ({
      ...item,
      rect: inside(rect),
    }));
    if (hidden.length)
      boxes.push({
        node: hidden[0]!,
        rect: overflowStrip(bounds),
        overflow: hidden,
      });
    return {
      boxes,
      missing: hidden.length,
      lost: roomOf(hidden),
      important: priorityLoss(hidden),
      invalid: fits(inside(bounds)) ? 0 : 1,
    };
  }
  return { boxes: [], missing: items.length, lost: roomOf(items), important: 0, invalid: 1 };
}
// Variable-height strips account for workspace headers and the *actual* leaf
// packing at this width. Equal-height grids unnecessarily fold a three-thread
// workspace next to a two-thread workspace despite having enough total area.
const minimumHeights = new WeakMap<MapNode, Map<number, number>>();
function minimumHeight(node: MapNode, cell: number): number {
  if (node.thread) return cell < 90 ? Infinity : 36;
  const frame = frameOf(node),
    width = cell - frame.x;
  if (width < 90) return Infinity;
  let sizes = minimumHeights.get(node);
  if (!sizes) {
    sizes = new Map();
    minimumHeights.set(node, sizes);
  }
  const key = Math.floor(width * 100) / 100,
    cached = sizes.get(key);
  if (cached !== undefined) return cached;
  const list = children(node);
  if (list.every((n) => n.thread)) {
    const h = frame.y + Math.ceil(list.length / Math.floor(width / 90)) * 36;
    sizes.set(key, h);
    return h;
  }
  let best = Infinity;
  for (
    let cols = 1;
    cols <= Math.min(list.length, Math.floor(width / 90));
    cols++
  ) {
    let h = frame.y;
    for (let i = 0; i < list.length; i += cols) {
      const row = list.slice(i, i + cols),
        w = width / row.length;
      h += Math.max(...row.map((n) => minimumHeight(n, w)));
    }
    best = Math.min(best, h);
  }
  sizes.set(key, best);
  return best;
}
function strips(items: MapNode[], bounds: MapRect) {
  const plans: { item: MapNode; rect: MapRect }[][] = [];
  for (
    let cols = 1;
    cols <= Math.min(items.length, Math.floor(bounds.width / 90));
    cols++
  ) {
    const rows = Array.from(
      { length: Math.ceil(items.length / cols) },
      (_, r) => {
        const list = items.slice(r * cols, (r + 1) * cols),
          w = bounds.width / list.length;
        return {
          list,
          w,
          h: Math.max(...list.map((n) => minimumHeight(n, w))),
        };
      },
    );
    const total = rows.reduce((s, r) => s + r.h, 0);
    if (!Number.isFinite(total)) continue;
    const extra = Math.max(0, bounds.height - total) / rows.length,
      scale = Math.min(1, bounds.height / total);
    let y = bounds.y;
    plans.push(
      rows.flatMap((row) => {
        const h = row.h * scale + extra;
        const cells = row.list.map((item, c) => ({
          item,
          rect: { x: bounds.x + c * row.w, y, width: row.w, height: h },
        }));
        y += h;
        return cells;
      }),
    );
  }
  return plans;
}
type LevelPlans = Map<string, Result>;
function layoutLevel(
  items: MapNode[],
  bounds: MapRect,
  levels: LevelPlans,
): Result {
  const key = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}|${items.map((n) => shape(n).fingerprint).join('|')}`;
  const cached = levels.get(key);
  if (cached) return cached;
  const save = (result: Result) => {
    if (levels.size >= 4096) levels.delete(levels.keys().next().value!);
    levels.set(key, result);
    return result;
  };
  if (!items.length) return { boxes: [], missing: 0, lost: 0, important: 0, invalid: 0 };
  if (items.every((n) => n.thread)) return save(threadPlan(items, bounds));
  const ranked = [...items].sort(byPriority);
  let best: Result | undefined;
  for (let count = items.length; count >= 0; count--) {
    const visible = count === items.length ? items : ranked.slice(0, count),
      hidden = ranked.slice(count);
    if (best?.invalid === 0 && priorityLoss(hidden) > best.important) break;
    const overflow = hidden.length
      ? {
          ...hidden[0]!,
          id: `group-overflow:${hidden[0]!.parent?.id}`,
          children: [],
          threads: 0,
        }
      : null;
    const cells = visible;
    const area = overflow ? aboveStrip(bounds) : bounds;
    const cost = (n: MapNode, overhead = 0.6) => footprint(n, overhead);
    // Recently used groups get the room first; the plans after these only make everything fit.
    const recent = (n: MapNode) => {
      const value = shape(n);
      return value.room + value.workspaces * 0.6 + value.devices;
    };
    const planned = [
      squarify(cells, recent, area),
      squarify(cells, (n) => (recent(n) + footprint(n)) / 2, area),
      squarify(cells, footprint, area),
      squarify(cells, (n) => Math.max(n.kind === 'device' ? 5 : 1, cost(n)), area),
      squarify(cells, (n) => Math.max(n.kind === 'device' ? 8 : 1, cost(n)), area),
      squarify(cells, (n) => cost(n, 1.2), area),
      squarify(cells, (n) => cost(n, 2), area),
      squarify(cells, (n) => cost(n) + 0.75, area),
      squarify(cells, (n) => cost(n) ** 0.85, area),
      squarify(cells, (n) => Math.sqrt(cost(n)), area),
      ...strips(cells, area),
      ...grids(cells, area, 56),
    ];
    // Nothing fits but the strip itself: one empty plan still places it.
    const candidates = cells.length ? planned : [[]];
    for (const candidate of candidates) {
      const boxes: DenseBox[] = [];
      let missing = 0,
        lost = 0,
        important = 0,
        invalid = 0;
      for (const { item: node, rect: r } of candidate) {
        const rect = inside(r, gapOf(node));
        const h = header(node),
          pad = paddingOf(node),
          childGap = childGapOf(node),
          area = {
            x: rect.x + pad,
            y: rect.y + h,
            width: Math.max(0, rect.width - pad * 2 + childGap),
            height: Math.max(0, rect.height - h - pad + childGap),
          };
        const nested = layoutLevel(children(node), area, levels);
        boxes.push({ node, rect, children: nested.boxes });
        missing += nested.missing;
        lost += nested.lost;
        important += nested.important;
        invalid += nested.invalid;
      }
      if (overflow) {
        const leaves = threadLeaves(hidden);
        missing += leaves.length;
        lost += roomOf(leaves);
        important += priorityLoss(leaves);
        if (!fits(inside(bounds))) invalid++;
        boxes.push({ node: hidden[0]!, rect: overflowStrip(bounds), overflow: hidden });
      }
      const result = { boxes, missing, lost, important, invalid };
      if (
        !best ||
        invalid < best.invalid ||
        (invalid === best.invalid &&
          (important < best.important ||
            (important === best.important && lost < best.lost)))
      )
        best = result;
      if (!missing && !invalid) return save(result);
    }
    // Keep every workspace whenever its children are readable; only fold whole
    // containers when minimum cells or a higher-priority thread need the room.
    if (best?.invalid === 0 && best.important === 0) return save(best);
  }
  return save(best!);
}

/** One geometry snapshot: tiny score updates and pointer/focus freezes never
 * change membership or positions. Live content is rebound without DOM reads. */
export class DenseLayout {
  private levels: LevelPlans = new Map();
  private snapshot?: {
    key: string;
    scores: Map<
      string,
      { weight: number; rank: number; parent: string | undefined }
    >;
    boxes: DenseBox[];
  };
  layout(
    root: MapNode,
    bounds: MapRect,
    frozen: boolean,
    version: string,
  ): DenseBox[] {
    const leaves = threadLeaves(root.children),
      scores = new Map(
        leaves.map((n) => [
          n.id,
          { weight: n.weight, rank: mapPriority(n), parent: n.parent?.id },
        ]),
      );
    const key = `${version}:${root.id}:${bounds.width}:${bounds.height}`;
    const old = this.snapshot;
    const changed =
      !old ||
      old.scores.size !== scores.size ||
      [...scores].some(([id, s]) => {
        const before = old.scores.get(id);
        return (
          !before ||
          before.rank !== s.rank ||
          before.parent !== s.parent ||
          Math.abs(s.weight - before.weight) / Math.max(0.001, before.weight) >
            0.3
        );
      });
    const latest = new Map<string, MapNode>();
    const visit = (n: MapNode) => {
      latest.set(n.id, n);
      n.children.forEach(visit);
    };
    visit(root);
    const rebind = (boxes: DenseBox[]): DenseBox[] =>
      boxes.map((b) => ({
        ...b,
        node: latest.get(b.node.id) ?? b.node,
        children: b.children ? rebind(b.children) : undefined,
        overflow: b.overflow?.map((n) => latest.get(n.id) ?? n),
      }));
    if (old && old.key === key && old.boxes.length && (frozen || !changed))
      return rebind(old.boxes);
    const result = layoutLevel(children(root), bounds, this.levels);
    const boxes = rebind(result.boxes);
    this.snapshot = { key, scores, boxes };
    return boxes;
  }
}
