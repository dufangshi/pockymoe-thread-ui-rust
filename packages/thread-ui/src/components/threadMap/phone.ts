import { runningWeight, threadWeight, type MapNode, type ThreadMapDevice, type ThreadMapThread } from './model';
import type { MapRect } from './squarify';

/** The Web's phone breakpoint. Native desktop chrome always keeps the dense map. */
export function mapPresentation(width: number, host?: 'mobile' | 'desktop' | 'browser') {
  return host === 'mobile' || host !== 'desktop' && width < 640 ? 'dialog' : 'page';
}

/** Filter before building/compacting the tree, including folded agents and CJK. */
export function filterPhoneDevices(devices: ThreadMapDevice[], query: string): ThreadMapDevice[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return devices;
  return devices.flatMap(device => {
    const workspaces = device.workspaces.flatMap(workspace => {
      const parentMatches = `${device.name}\n${workspace.label}`.toLocaleLowerCase().includes(needle);
      const filter = (thread: ThreadMapThread): ThreadMapThread | null => {
        if (parentMatches) return thread;
        const children = thread.children?.flatMap(child => { const match = filter(child); return match ? [match] : []; });
        return thread.title.toLocaleLowerCase().includes(needle) || children?.length ? { ...thread, children } : null;
      };
      const threads = workspace.threads.flatMap(thread => { const match = filter(thread); return match ? [match] : []; });
      return threads.length ? [{ ...workspace, threads }] : [];
    });
    return workspaces.length ? [{ ...device, workspaces }] : [];
  });
}

/** Restore the old phone geometry: area follows turns, with extra room for
 * running conversations. Recency-based dense geometry stays on the page. */
export function restorePhoneWeights(node: MapNode): MapNode {
  for (const child of node.children) restorePhoneWeights(child);
  node.weight = node.thread ? (node.running ? runningWeight(node.thread.turns) : threadWeight(node.thread.turns))
    : node.children.length ? node.children.reduce((sum, child) => sum + child.weight, 0) : node.weight;
  node.children.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
  return node;
}

/** Icon-only previews may be small; only text-labelled tiles require 96×44. */
export function phoneTileTier(box: MapRect) {
  return box.width >= 96 && box.height >= 44 ? 'label' : box.width >= 22 && box.height >= 20 ? 'icon' : 'dot';
}
