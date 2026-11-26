import { isMacPlatform, matchesModKey } from '../shortcuts';

/**
 * Left or Right between the split panes of a terminal group: Alt+←/→, and
 * ⌥⌘←/→ on a Mac, where Option+←/→ alone belongs to the shell (move by word).
 * Both are VS Code's keys for the platform (docs/ui-principles.md §19).
 */
export function isSplitPaneKey(event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
  if (isMacPlatform()) return event.altKey && !event.shiftKey && matchesModKey(event);
  return event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
}
