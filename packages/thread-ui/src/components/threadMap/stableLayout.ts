import type { MapNode } from './model';
import { squarify, type MapRect } from './squarify';

interface Order { ids: string[]; weights: Map<string, number>; displayed: Map<string, number>; nodes: Map<string, MapNode> }
/** Baselines are retained until a reorder, so several small changes accumulate. */
export class StableMapOrder {
  private levels = new Map<string, Order>();
  clear() { this.levels.clear(); }
  apply(root: MapNode, frozen: boolean) {
    const visit = (node: MapNode) => {
      // Thread leaves have no membership to reconcile. Tracking their empty
      // levels allocated several maps per leaf on every live index refresh.
      if (node.kind === 'thread' && node.children.length === 0) return;
      const old = this.levels.get(node.id);
      const changed = !old || node.children.some(child => {
        const weight = old.weights.get(child.id);
        return weight === undefined || Math.abs(child.weight - weight) / Math.max(weight, 0.001) > 0.3;
      }) || old.ids.length !== node.children.length;
      if (!old || old.ids.length === 0 && node.children.length > 0 || (!frozen && changed)) {
        this.levels.set(node.id, { ids: node.children.map(child => child.id), weights: new Map(node.children.map(child => [child.id, child.weight])), displayed: new Map(node.children.map(child => [child.id, child.weight])), nodes: new Map(node.children.map(child => [child.id, child])) });
      } else {
        if (frozen) {
          const incoming = new Map(node.children.map(child => [child.id, child]));
          // A new/deleted tile must not move the one under the pointer or focus.
          // Reconcile membership together with ordering after interaction ends.
          node.children = old.ids.flatMap(id => {
            const child = incoming.get(id) ?? old.nodes.get(id);
            return child ? [{ ...child, parent: node }] : [];
          });
        }
        const ranks = new Map(old.ids.map((id, index) => [id, index]));
        node.children.sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
        // Interaction freezes geometry too: only the tile's contents change.
        if (frozen) for (const child of node.children) child.weight = old.displayed.get(child.id) ?? child.weight;
        else {
          old.displayed = new Map(node.children.map(child => [child.id, child.weight]));
          old.nodes = new Map(node.children.map(child => [child.id, child]));
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(root);
    return root;
  }
}

/** Geometry cache, independent of live content and filter text; bounded per level. */
export class MapLayoutCache {
  private levels = new Map<string, { signature: string; rects: MapRect[] }>();
  layout(id: string, items: readonly MapNode[], bounds: MapRect) {
    const signature = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}|${items.map(item => `${item.id}:${item.weight}`).join('|')}`;
    let cached = this.levels.get(id);
    if (!cached || cached.signature !== signature) {
      cached = { signature, rects: squarify(items, item => item.weight, bounds).map(entry => entry.rect) };
      if (this.levels.size > 200) this.levels.clear();
      this.levels.set(id, cached);
    }
    return items.map((item, index) => ({ item, rect: cached!.rects[index]! })).filter(entry => entry.rect);
  }
}

export interface SpatialTarget { id: string; rect: MapRect }
/** Pick the nearest center in the requested half-plane, favouring alignment. */
export function spatialNeighbor(items: readonly SpatialTarget[], from: string, direction: string) {
  const origin = items.find(item => item.id === from);
  if (!origin) return items[0]?.id;
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
  const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
  let best: string | undefined, score = Infinity;
  for (const item of items) {
    if (item === origin) continue;
    const dx = item.rect.x + item.rect.width / 2 - origin.rect.x - origin.rect.width / 2;
    const dy = item.rect.y + item.rect.height / 2 - origin.rect.y - origin.rect.height / 2;
    const primary = (horizontal ? dx : dy) * sign, cross = horizontal ? dy : dx;
    if (primary <= 0) continue;
    const distance = primary * primary + cross * cross * 2;
    if (distance < score) { score = distance; best = item.id; }
  }
  return best;
}
