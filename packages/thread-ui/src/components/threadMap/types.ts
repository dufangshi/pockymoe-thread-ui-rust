import type { ReactNode } from 'react';
import type { ThreadMapDevice, ThreadMapThread } from './model';

/** Page mode exposes all/active; week is retained for legacy dialog callers. */
export type MapScope = 'active' | 'week' | 'all';
export interface MapAttention {
  key: string;
  kind: 'approval' | 'input' | 'failed' | 'unread';
  title: string;
  device: string;
  workspace: string;
  summary?: string;
  requestId?: string;
  since: string;
}
export interface MapDeviceMenuItem { id: string; label: string; onSelect: () => void; disabled?: boolean; disabledReason?: string; separator?: boolean; tone?: 'danger' }
export interface MapDeviceExtras {
  latencyMs?: number;
  runtimeVersion?: string;
  updateAvailable?: boolean;
  runningCount?: number;
  waitingCount?: number;
  todayCostUsd?: number;
  /** Host-formatted compact CPU / memory / GPU line, not a polling request. */
  metrics?: string;
  syncing?: boolean;
  menuItems?: readonly MapDeviceMenuItem[];
}
export interface ThreadMapProps {
  devices: ThreadMapDevice[];
  currentKey?: string | undefined;
  hours?: number;
  /** Dialog heading. Page mode uses its breadcrumb in the single chrome row. */
  heading?: ReactNode;
  actions?: ReactNode;
  onOpen: (thread: ThreadMapThread) => void;
  onNavigate?: ((href: string) => void) | undefined;
  onRetry?: ((deviceId: string) => void) | undefined;
  onDismiss?: (() => void) | undefined;
  presentation?: 'dialog' | 'page';
  scope?: MapScope;
  onScopeChange?: (scope: MapScope) => void;
  attention?: readonly MapAttention[];
  stableLayout?: boolean;
  filterText?: string;
  onFilterChange?: (text: string) => void;
  deviceExtras?: Readonly<Record<string, MapDeviceExtras>>;
  onQuickLook?: (key: string) => void;
  onRequestDecision?: (key: string, requestId: string, decision: 'approve' | 'deny') => void;
  /** A thread key, or `device:<id>` to reveal a device from the host's Devices page. */
  revealKey?: string | null;
  pulseKeys?: readonly string[];
}

/** The activity source already sorts within each group; retain that order. */
export function orderAttention(items: readonly MapAttention[]) {
  const rank = { approval: 0, input: 0, failed: 1, unread: 2 };
  return [...items].sort((a, b) => rank[a.kind] - rank[b.kind]);
}
