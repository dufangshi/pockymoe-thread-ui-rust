import type { MapNode } from './model';
import { byPriority, mapPriority, threadLeaves } from './readability';
import { squarify, type MapRect } from './squarify';

export const DENSE_MIN = { width: 88, height: 34 };
const GAP = 2;
export interface DenseBox {
  node: MapNode;
  rect: MapRect;
  children?: DenseBox[];
  overflow?: MapNode[];
}
interface Result {
  boxes: DenseBox[];
  missing: number;
  important: number;
}
const fits = (r: MapRect) =>
  r.width >= DENSE_MIN.width - 0.01 && r.height >= DENSE_MIN.height - 0.01;
const inside = (r: MapRect): MapRect => ({
  x: r.x,
  y: r.y,
  width: Math.max(0, r.width - GAP),
  height: Math.max(0, r.height - GAP),
});
const header = (n: MapNode) => (n.kind === 'device' ? 22 : 18);
const children = (n: MapNode) =>
  n.children.filter(
    (c) => c.kind !== 'compressed' && (c.thread || c.threads > 0),
  );
// Container area reflects the number of minimum readable cells plus header
// overhead, rather than accumulated turns that can starve sparse workspaces.
function footprint(n: MapNode): number {
  return n.thread
    ? 1
    : children(n).reduce((sum, c) => sum + footprint(c), 0) +
        (n.kind === 'device' ? 1 : 0.6);
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
    const cells = [
      ...visible.map((node) => ({
        node,
        overflow: undefined as MapNode[] | undefined,
      })),
      ...(hidden.length ? [{ node: hidden[0]!, overflow: hidden }] : []),
    ];
    if (!cells.length) return { boxes: [], missing: 0, important: 0 };
    const median =
      [...visible].sort((a, b) => a.weight - b.weight)[
        Math.floor(visible.length / 2)
      ]?.weight || 1;
    const candidates = [
      squarify(
        cells,
        (c) =>
          c.overflow ? 1 : Math.max(1, Math.min(1.8, c.node.weight / median)),
        bounds,
      ),
      squarify(cells, () => 1, bounds),
      ...grids(cells, bounds, 36),
    ];
    const layout = candidates.find((c) => c.every((e) => fits(inside(e.rect))));
    if (!layout && count > 0) continue;
    const boxes = (layout ?? [{ item: cells[0]!, rect: bounds }]).map(
      ({ item, rect }) => ({ ...item, rect: inside(rect) }),
    );
    return {
      boxes,
      missing: hidden.length,
      important: hidden.filter((n) => mapPriority(n) < 4).length,
    };
  }
  return { boxes: [], missing: items.length, important: 0 };
}
function layoutLevel(items: MapNode[], bounds: MapRect): Result {
  if (!items.length) return { boxes: [], missing: 0, important: 0 };
  if (items.every((n) => n.thread)) return threadPlan(items, bounds);
  const candidates = [
    squarify(items, footprint, bounds),
    squarify(items, (n) => footprint(n) + 0.75, bounds),
    squarify(items, (n) => footprint(n) ** 0.85, bounds),
    squarify(items, (n) => Math.sqrt(footprint(n)), bounds),
    ...grids(items, bounds, 56),
  ];
  let best: Result | undefined;
  for (const candidate of candidates) {
    const boxes: DenseBox[] = [];
    let missing = 0,
      important = 0;
    for (const { item: node, rect: r } of candidate) {
      const rect = inside(r),
        h = header(node),
        area = {
          x: rect.x,
          y: rect.y + h,
          width: rect.width + GAP,
          height: Math.max(0, rect.height - h + GAP),
        };
      const nested = layoutLevel(children(node), area);
      boxes.push({ node, rect, children: nested.boxes });
      missing += nested.missing;
      important += nested.important;
    }
    const result = { boxes, missing, important };
    if (
      !best ||
      important < best.important ||
      (important === best.important && missing < best.missing)
    )
      best = result;
    if (!missing) return result;
  }
  return best!;
}

/** One geometry snapshot: tiny score updates and pointer/focus freezes never
 * change membership or positions. Live content is rebound without DOM reads. */
export class DenseLayout {
  private snapshot?: {
    key: string;
    scores: Map<string, { weight: number; rank: number }>;
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
        leaves.map((n) => [n.id, { weight: n.weight, rank: mapPriority(n) }]),
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
          Math.abs(s.weight - before.weight) / Math.max(0.001, before.weight) >
            0.3
        );
      });
    if (old && old.key === key && old.boxes.length && (frozen || !changed)) {
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
      return rebind(old.boxes);
    }
    const result = layoutLevel(children(root), bounds);
    this.snapshot = { key, scores, boxes: result.boxes };
    return result.boxes;
  }
}
