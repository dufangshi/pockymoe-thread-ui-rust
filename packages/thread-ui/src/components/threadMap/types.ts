import type { ReactNode } from 'react';
import type { ThreadMapDevice, ThreadMapThread } from './model';

/** Page mode exposes all/active; week is retained for legacy dialog callers. */
export type MapScope = 'active' | 'week' | 'all';

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
  /** Readable phone chrome/layout on the legacy non-page renderer. */
  phone?: boolean;
  scope?: MapScope;
  onScopeChange?: (scope: MapScope) => void;
  stableLayout?: boolean;
  filterText?: string;
  onFilterChange?: (text: string) => void;
  deviceExtras?: Readonly<Record<string, MapDeviceExtras>>;
  onQuickLook?: (key: string) => void;
  /** A thread key, or `device:<id>` to reveal a device from the host's Devices page. */
  revealKey?: string | null;
  pulseKeys?: readonly string[];
}
