import { isLive, isWaiting, type MapNode } from './model';
import { squarify, type MapRect } from './squarify';

export const READABLE_THREAD = { width: 132, height: 64 };
const GAP = 3;
const childrenOf = (node: MapNode) => [...node.children, ...(node.hiddenNodes ?? [])];

/** Lower numbers need attention first; a container inherits its most urgent child. */
export function mapPriority(node: MapNode): number {
  const t = node.thread;
  if (t) {
    if (isWaiting(t)) return 0;
    if (isLive(t)) return 1;
    if (t.unread && (t.failed || t.interrupted)) return 2;
    if (t.unread) return 3;
    if (t.pinned || t.shortcut) return 4;
    return 5;
  }
  return childrenOf(node).reduce((rank, child) => Math.min(rank, mapPriority(child)), 5);
}
export const byPriority = (a: MapNode, b: MapNode) => mapPriority(a) - mapPriority(b) || b.weight - a.weight || a.id.localeCompare(b.id);

export function threadLeaves(nodes: readonly MapNode[]): MapNode[] {
  return nodes.flatMap(node => node.thread ? [node] : threadLeaves(childrenOf(node)));
}

export interface MapOverflow {
  nodes: MapNode[];
  /** Total threads/workspaces/devices represented, including older items. */
  count: number;
  older: number;
  kind: 'threads' | 'workspaces' | 'devices';
  waiting: number;
  running: number;
  failed: number;
  unread: number;
  recent: string[];
  rect: MapRect;
}
export interface ReadablePlan { entries: { node: MapNode; rect: MapRect }[]; overflow: MapOverflow | null }
interface Snapshot {
  signature: string;
  bounds: string;
  order: string[];
  scores: Map<string, { score: number; rank: number }>;
  plan: ReadablePlan;
}

function summary(nodes: MapNode[], kind: MapOverflow['kind'], older: number, rect: MapRect): MapOverflow {
  const threads = threadLeaves(nodes);
  return { nodes, kind, count: kind === 'threads' ? threads.length : nodes.length, older, rect,
    waiting: threads.filter(node => isWaiting(node.thread!)).length,
    running: threads.filter(node => isLive(node.thread!) && !isWaiting(node.thread!)).length,
    failed: threads.filter(node => node.thread!.unread && (node.thread!.failed || node.thread!.interrupted)).length,
    unread: threads.filter(node => node.thread!.unread && !node.thread!.failed && !node.thread!.interrupted && !isWaiting(node.thread!) && !isLive(node.thread!)).length,
    recent: [...threads].sort((a, b) => (Date.parse(b.thread!.lastActiveAt ?? '') || 0) - (Date.parse(a.thread!.lastActiveAt ?? '') || 0)).slice(0, 3).map(node => node.label),
  };
}

/** Selection is separate from live tile content. Sub-threshold score updates keep
 * both membership and geometry; category changes and accumulated >30% scores
 * reconcile only after pointer/focus freeze lifts. Resize always respects minima. */
export class ReadableSelection {
  private levels = new Map<string, Snapshot>();
  clear() { this.levels.clear(); }
  ordered(id: string, items: readonly MapNode[]) {
    const order = this.levels.get(id)?.order;
    if (!order) return [...items].sort(byPriority);
    const rank = new Map(order.map((key, index) => [key, index]));
    return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || byPriority(a, b));
  }
  select(id: string, items: readonly MapNode[], bounds: MapRect, kind: MapOverflow['kind'], frozen: boolean): ReadablePlan {
    const candidates = items.filter(node => node.kind !== 'compressed');
    const scoped = items.filter(node => node.kind === 'compressed');
    const olderNodes = scoped.flatMap(node => node.hiddenNodes ?? []);
    const older = kind === 'threads' ? threadLeaves(olderNodes).length : olderNodes.length;
    const size = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
    const signature = `${candidates.map(node => node.id).sort().join('|')}#${olderNodes.map(node => node.id).sort().join('|')}`;
    const old = this.levels.get(id);
    const latest = new Map([...candidates, ...olderNodes].map(node => [node.id, node]));
    const changed = !old || old.signature !== signature || candidates.some(node => {
      const baseline = old.scores.get(node.id);
      return !baseline || baseline.rank !== mapPriority(node) || Math.abs(node.weight - baseline.score) / Math.max(.001, baseline.score) > .3;
    });
    if (old && (old.plan.entries.length > 0 || old.plan.overflow) && old.bounds === size && (frozen || !changed)) {
      const entries = old.plan.entries.map(entry => ({ ...entry, node: latest.get(entry.node.id) ?? entry.node }));
      const overflow = old.plan.overflow;
      return { entries, overflow: overflow ? summary(overflow.nodes.map(node => latest.get(node.id) ?? node), kind, older, overflow.rect) : null };
    }
    const ranked = old && (frozen || !changed) && old.order.length > 0
      ? old.order.flatMap(key => latest.has(key) ? [latest.get(key)!] : [])
      : [...candidates].sort(byPriority);
    const minimum = kind === 'threads' ? { width: 132 + GAP * 2, height: 64 + GAP * 2 }
      : kind === 'workspaces' ? { width: 154, height: 190 } : { width: 176, height: 236 };
    const minimumFor = (node: MapNode) => {
      if (kind !== 'workspaces') return minimum;
      const important = Math.min(6, threadLeaves([node]).filter(child => mapPriority(child) < 4).length);
      if (important < 2) return minimum;
      const columns = important > 3 ? 2 : 1;
      return { width: columns === 2 ? 288 : 154, height: Math.max(190, 46 + Math.ceil((important + 1) / columns) * 70) };
    };
    const median = [...ranked].sort((a, b) => a.weight - b.weight)[Math.floor(ranked.length / 2)]?.weight || 1;
    // Area still expresses weight, within a readable range. The overflow gets a
    // card's area, rather than the entire hidden history's area or a thin sliver.
    const weight = (node: MapNode) => {
      const base = Math.max(1, Math.min(3, node.weight / median));
      return kind === 'threads' ? base : Math.max(base, Math.min(8, threadLeaves([node]).filter(child => mapPriority(child) < 4).length));
    };
    let count = Math.min(ranked.length, Math.max(0, Math.floor(bounds.width * bounds.height / (minimum.width * minimum.height))));
    let plan: ReadablePlan = { entries: [], overflow: null };
    for (; count >= 0; count--) {
      const visible = ranked.slice(0, count);
      const hidden = [...ranked.slice(count), ...olderNodes];
      const entries = visible.map(node => ({ node, overflow: false, weight: weight(node) }));
      if (hidden.length) entries.push({ node: ranked[0] ?? scoped[0]!, overflow: true, weight: visible.length ? Math.max(1.4, weight(visible[0]!) * .6) : 1 });
      let placed = squarify(entries, entry => entry.weight, bounds);
      const readable = (layout: typeof placed) => layout.every(({ item, rect }) => {
        const min = item.overflow ? { width: 138, height: 70 } : minimumFor(item.node);
        return rect.width + .01 >= min.width && rect.height + .01 >= min.height;
      });
      // Weight can refine a readable plan, never force a sliver. Relax it before
      // sacrificing a higher-priority tile that fits at a more even area.
      for (const exponent of [.5, 0]) {
        if (readable(placed)) break;
        placed = squarify(entries, entry => entry.weight ** exponent, bounds);
      }
      if (!readable(placed)) {
        // Squarify optimizes aspect ratio, which can choose two narrow columns
        // where two wide rows would be readable. Try a compact grid before
        // discarding another important tile.
        let best = Infinity;
        for (let columns = 1; columns <= entries.length; columns++) {
          const rows = Math.ceil(entries.length / columns);
          const width = bounds.width / columns, height = bounds.height / rows;
          if (width < 138 || height < 70) continue;
          const grid = entries.map((item, index) => ({ item, rect: { x: bounds.x + index % columns * width, y: bounds.y + Math.floor(index / columns) * height, width, height } }));
          const score = Math.abs(Math.log(width / height / 1.6));
          if (score < best && readable(grid)) { placed = grid; best = score; }
        }
      }
      const fits = readable(placed);
      if (!fits && count > 0) continue;
      plan = { entries: placed.filter(entry => !entry.item.overflow).map(({ item, rect }) => ({ node: item.node, rect })),
        overflow: hidden.length ? summary(hidden, kind, older, placed.find(entry => entry.item.overflow)?.rect ?? bounds) : null };
      break;
    }
    if (this.levels.size > 200) this.levels.clear();
    this.levels.set(id, { signature, bounds: size, order: ranked.map(node => node.id), scores: new Map(candidates.map(node => [node.id, { score: node.weight, rank: mapPriority(node) }])), plan });
    return plan;
  }
}
