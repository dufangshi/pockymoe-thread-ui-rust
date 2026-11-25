import { matchesModKey } from '../../shortcuts';
import type { WorkspaceExplorerRowProjection } from './workspaceExplorerTypes';

export type WorkspaceExplorerCommand =
  | { type: 'focus'; id: string }
  | { type: 'expand'; path: string }
  | { type: 'collapse'; path: string }
  | { type: 'activate'; id: string }
  | { type: 'select'; id: string }
  | { type: 'open-filter' };

export function workspaceExplorerCommandForKey(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  focusedId: string | null;
  rows: WorkspaceExplorerRowProjection[];
}): WorkspaceExplorerCommand | null {
  const currentIndex = input.focusedId
    ? input.rows.findIndex((row) => row.id === input.focusedId)
    : -1;
  const current = currentIndex >= 0 ? input.rows[currentIndex] : null;
  const focusAt = (index: number): WorkspaceExplorerCommand | null => {
    const row = input.rows[index];
    return row ? { type: 'focus', id: row.id } : null;
  };

  // Mod+F: ⌘F on a Mac, Ctrl+F elsewhere (§19).
  if (matchesModKey(input) && !input.altKey && !input.shiftKey && input.key.toLowerCase() === 'f') {
    return { type: 'open-filter' };
  }
  switch (input.key) {
    case 'ArrowDown':
      return focusAt(Math.min(input.rows.length - 1, currentIndex + 1));
    case 'ArrowUp':
      return focusAt(Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1));
    case 'Home':
      return focusAt(0);
    case 'End':
      return focusAt(input.rows.length - 1);
    case 'ArrowRight': {
      if (!current) {
        return focusAt(0);
      }
      if (current.node.kind === 'directory' && current.expanded === false) {
        return { type: 'expand', path: current.node.path };
      }
      const next = input.rows[currentIndex + 1];
      return next?.parentId === current.id
        ? { type: 'focus', id: next.id }
        : null;
    }
    case 'ArrowLeft':
      if (!current) {
        return null;
      }
      if (current.node.kind === 'directory' && current.expanded) {
        return { type: 'collapse', path: current.node.path };
      }
      return current.parentId ? { type: 'focus', id: current.parentId } : null;
    case 'Enter':
      return current ? { type: 'activate', id: current.id } : null;
    case ' ':
      return current ? { type: 'select', id: current.id } : null;
    default:
      return null;
  }
}
