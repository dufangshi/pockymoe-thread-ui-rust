import type { MapNode, ThreadMapDevice, ThreadMapThread } from './model';
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

/** Phone +N entries zoom into their container instead of expanding in place
 * (ui-principles §5): never nest one fold entry inside another.
 * Readability wins over exact area. Rows share height by thread count, bounded
 * to prevent a large device leaving its neighbour as an unreadable strip. */
export function phoneLayout(items: MapNode[], bounds: MapRect, container: MapNode) {
  const gap = 5;
  const columns = Math.max(1, Math.min(2, Math.floor((bounds.width + gap) / (96 + gap)), items.length));
  const minHeight = items.some(item => item.kind !== 'thread') ? 94 : 44;
  const rows = Math.max(0, Math.floor((bounds.height + gap) / (minHeight + gap)));
  const capacity = rows * columns;
  if (!capacity || bounds.width < 96) return [];
  const shown = items.slice(0, items.length > capacity ? Math.max(0, capacity - 1) : capacity);
  if (shown.length < items.length) shown.push({ ...container, id: `phone-fold:${container.id}`, kind: 'compressed',
    label: `+${items.slice(shown.length).reduce((sum, item) => sum + item.threads, 0)}`, parent: container, children: [] });
  const rowCount = Math.ceil(shown.length / columns);
  const weights = Array.from({ length: rowCount }, (_, row) => Math.min(2, Math.sqrt(Math.max(1, ...shown.slice(row * columns, (row + 1) * columns).map(item => item.threads)))));
  const available = bounds.height - Math.max(0, rowCount - 1) * gap;
  const spare = Math.max(0, available - rowCount * minHeight);
  let y = bounds.y;
  return weights.flatMap((weight, row) => {
    const height = minHeight + spare * weight / weights.reduce((a, b) => a + b, 0);
    const cells = shown.slice(row * columns, (row + 1) * columns);
    // Keep a lone last device the same width as its peers, rather than a huge empty row.
    const width = (bounds.width - (columns - 1) * gap) / columns;
    const result = cells.map((item, col) => ({ item, rect: { x: bounds.x + col * (width + gap), y, width, height } }));
    y += height + gap;
    return result;
  });
}
