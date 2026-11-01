import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, ChevronUp, Folder, List, Monitor, Network, RotateCw, Layers, Activity, DollarSign } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { buildThreadMap, heatLevel, indexMap, threadWeight, type MapNode, type ThreadMapThread } from './model';
import { AgeGlyph, AgentChip, formatRunTime, threadDetails, ThreadTile } from './ThreadTile';
import { StatusMark } from '../StatusMark';
import { formatCompactUsd } from '../timeline/tokenFormatting';
import { type MapRect } from './squarify';

import { MapTooltip } from './MapTooltip';
import { DenseMap } from './DenseMap';
import { useMapMotion } from './useMapMotion';
import type { MapScope, ThreadMapProps } from './types';
import { MapLayoutCache, spatialNeighbor, StableMapOrder, type SpatialTarget } from './stableLayout';
import { AttentionStrip, DeviceMenu, DeviceReadings, DeviceStateMark, MapLegend, relativeCache } from './MapChrome';

/** Height of a device or workspace title bar. */
const HEADER = 26;
/** A block's lines for its tooltip and label: a thread's details, or a device's or workspace's totals. */
function describe(node: MapNode, hours: number) {
  if (node.thread) return threadDetails(node, hours);
  const state = node.device?.state;
  if (node.kind === 'device' && state && state !== 'ready') {
    return [node.label, translate(state === 'offline' ? 'workbench.threadMapOffline' : state === 'loading' ? 'workbench.threadMapLoading' : 'workbench.threadMapFailed')];
  }
  return [node.label, [
    translate('workbench.threadMapThreads', { count: node.threads }),
    node.running ? translate('workbench.threadMapRunningCount', { count: node.running }) : null,
    node.activeMs > 0 ? translate('workbench.threadMapRan', { hours, duration: formatRunTime(node.activeMs) }) : null,
    node.usd > 0 ? translate('workbench.threadMapCost', { usd: formatCompactUsd(node.usd) }) : null,
  ].filter(Boolean).join(' · ')];
}

function inset(rect: MapRect, gap: number): MapRect {
  const g = Math.min(gap, rect.width / 6, rect.height / 6);
  return { x: rect.x + g, y: rect.y + g, width: Math.max(0, rect.width - g * 2), height: Math.max(0, rect.height - g * 2) };
}

type ZoomPlan = { kind: 'in'; rect: MapRect } | { kind: 'out'; childId: string } | { kind: 'fade' };

/** The element of a block of the current level, by its map id. */
const byMapId = (scope: ParentNode | null | undefined, id: string) =>
  scope?.querySelector<HTMLElement>(`[data-map-id="${id.replace(/["\\]/g, '\\$&')}"]`) ?? null;

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Every thread on every device as a zoomable treemap: devices hold workspaces,
 * workspaces hold threads. A thread's area follows its turns and its color the
 * time it ran in the last `hours`; running threads breathe. Tapping a device or a
 * workspace fills the map with it (what is inside shows as a preview until
 * then), tapping a thread opens it. On touch, pinching in goes up a level,
 * spreading opens the block under the fingers and dragging down dismisses.
 */
export function ThreadMap({ devices, currentKey, hours = 24, heading, actions, onOpen, onNavigate, onRetry, onDismiss,
  presentation = 'dialog', scope: controlledScope, onScopeChange, attention, stableLayout = false,
  filterText, onFilterChange, deviceExtras, onQuickLook, onRequestDecision, revealKey, pulseKeys,
}: ThreadMapProps) {
  const { locale } = useI18n();
  const page = presentation === 'page';
  const enhanced = page || controlledScope !== undefined;
  const [localScope, setLocalScope] = useState<MapScope>('all');
  const scope = page && controlledScope === 'week' ? 'all' : controlledScope ?? localScope;
  const [localFilter, setLocalFilter] = useState('');
  const query = filterText ?? localFilter;
  const filter = useRef<HTMLInputElement>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<ReadonlySet<string>>(() => new Set());
  const [expandedDevices, setExpandedDevices] = useState<ReadonlySet<string>>(() => new Set());
  const [cachedDevices, setCachedDevices] = useState<ReadonlySet<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const pointerInside = useRef(false), focusInside = useRef(false);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const freeze = () => { clearTimeout(freezeTimer.current); setFrozen(true); };
  const thaw = () => {
    clearTimeout(freezeTimer.current);
    freezeTimer.current = setTimeout(() => { if (!pointerInside.current && !focusInside.current) setFrozen(false); }, 800);
  };
  useEffect(() => () => clearTimeout(freezeTimer.current), []);
  const orders = useRef(new StableMapOrder()), layouts = useRef(new MapLayoutCache());
  const priorScope = useRef(scope);
  const priorLayoutRevision = useRef(layoutRevision);
  const allLabel = translate('workbench.threadMapAll');
  const root = useMemo(() => {
    if (priorLayoutRevision.current !== layoutRevision) { orders.current.clear(); priorLayoutRevision.current = layoutRevision; }
    if (priorScope.current !== scope) { orders.current.clear(); priorScope.current = scope; }
    const list = enhanced ? devices.filter(d => (!page || d.workspaces.some(w => w.threads.length > 0)) && ( d.state !== 'offline' || cachedDevices.has(d.id) && (focusId === `device:${d.id}` || focusId?.startsWith(`workspace:${d.id}:`))))
      .map(d => d.state === 'offline' ? { ...d, state: 'ready' as const } : d) : devices;
    const tree = buildThreadMap(list, allLabel, enhanced ? { scope, expandedWorkspaces, expandedDevices, keepDeviceRoot: true, dense: page } : {});
    if (page) tree.children = tree.children.filter(node => node.threads > 0);
    return stableLayout ? orders.current.apply(tree, frozen) : tree;
  }, [devices, allLabel, enhanced, page, scope, expandedWorkspaces, expandedDevices, cachedDevices, stableLayout, frozen, layoutRevision, focusId]);
  const nodes = useMemo(() => indexMap(root), [root]);
  const latest = useRef({ onOpen, onQuickLook });
  latest.current = { onOpen, onQuickLook };
  const quickLook = useCallback((key: string) => latest.current.onQuickLook?.(key), []);
  const setScope = (next: MapScope) => {
    orders.current.clear(); setExpandedWorkspaces(new Set()); setExpandedDevices(new Set());
    setLocalScope(next); onScopeChange?.(next);
  };
  const setFilter = (text: string) => { setLocalFilter(text); onFilterChange?.(text); };
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const result = new Set<string>();
    for (const node of nodes.values()) if (node.thread && (!needle || [node.label, node.thread.lastPrompt, node.thread.model,
      node.workspace?.label, node.device?.name].filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(needle))) result.add(node.id);
    return result;
  }, [nodes, query, locale]);
  const hasMatch = (node: MapNode): boolean => matches.has(node.id) || node.children.some(hasMatch) || Boolean(node.thread?.children?.some(child => { const indexed = nodes.get(`thread:${child.key}`); return indexed && hasMatch(indexed); }));
  const openFirstMatch = () => { const first = [...nodes.values()].find(node => node.thread && matches.has(node.id)); if (first?.thread) latest.current.onOpen(first.thread); };
  const expand = (node: MapNode) => {
    setLayoutRevision(revision => revision + 1);
    if (node.compressed === 'threads') setExpandedWorkspaces(previous => new Set([...previous, node.parent!.id]));
    else setExpandedDevices(previous => new Set([...previous, node.parent!.id]));
  };
  // Threads opened up into the agent threads they started.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (key: string) => {
    setTip(null);
    setOpenGroups(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };
  const focused = (focusId ? nodes.get(focusId) : undefined) ?? root;
  const current = page && focused.thread?.children?.length ? { ...focused, children: focused.thread.children.flatMap(child => { const node = nodes.get(`thread:${child.key}`); return node ? [node] : []; }) } : focused;
  const canvas = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const crumbs = useRef<HTMLElement>(null);
  const zoomPlan = useRef<ZoomPlan | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tip, setTip] = useState<{ lines: string[]; target: HTMLElement } | null>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth, height = node.clientHeight;
      // A persistent page can be hidden by its host. Keep its mounted list and
      // scroll position until there is another positive size to lay out.
      if (!width || !height) return;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Read once per agent after structural/theme changes, never per tile on hover.
  useLayoutEffect(() => {
    const paint = () => {
      const chips = [...(canvas.current?.querySelectorAll<HTMLElement>('.thread-map-agent') ?? [])];
      const art = new Map<string, boolean>();
      for (const chip of chips) if (!art.has(chip.dataset.agent!)) art.set(chip.dataset.agent!, getComputedStyle(chip).getPropertyValue('--theme-agent-avatar').includes('url('));
      for (const chip of chips) chip.toggleAttribute('data-art', art.get(chip.dataset.agent!) ?? false);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-preset', 'data-theme-effective'] });
    return () => observer.disconnect();
  }, [root, focusId, openGroups, size.width, size.height]);

  useEffect(() => {
    if (stableLayout && focusInside.current && !canvas.current?.contains(document.activeElement)) { focusInside.current = false; thaw(); }
  }, [root, current.id, stableLayout]);

  const spatial = useRef<SpatialTarget[]>([]);
  const keyboard = (event: ReactKeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    const editing = target.matches('input, textarea, select, [contenteditable="true"]');
    if (editing) {
      if (target === filter.current && event.key === 'Enter') { event.preventDefault(); openFirstMatch(); }
      if (target === filter.current && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setFilter(''); canvas.current?.focus(); }
      return;
    }
    if (event.key === '/' && (enhanced || onFilterChange)) { event.preventDefault(); filter.current?.focus(); }
    else if (enhanced && ['1', '2', '3'].includes(event.key)) { event.preventDefault(); setScope((page ? ['all', 'active', 'all'] as const : ['active', 'week', 'all'] as const)[Number(event.key) - 1]!); }
    else if ((event.key === 'Escape' || event.key === 'Backspace') && current !== root) { event.preventDefault(); event.stopPropagation(); navigate(current.parent); }
    else if (event.key.startsWith('Arrow') && canvas.current?.contains(target)) {
      const from = target.closest<HTMLElement>('[data-map-id]')?.dataset.mapId ?? '';
      const next = spatialNeighbor(spatial.current, from, event.key);
      const block = next ? byMapId(stage.current, next) : null;
      const control = block?.matches('button') ? block : block?.querySelector<HTMLElement>('.thread-map-tile-link, .thread-map-zoom, button.thread-map-section-head, button.thread-map-overflow-open');
      if (control) { event.preventDefault(); control.focus({ preventScroll: !control.closest('.thread-map-list-scroll') }); }
    } else if (event.key === ' ' && onQuickLook) {
      const id = target.closest<HTMLElement>('[data-map-id]')?.dataset.mapId;
      const key = id?.startsWith('thread:') ? id.slice(7) : undefined;
      if (key) { event.preventDefault(); onQuickLook(key); }
    }
  };

  const outsideKey = useRef<(event: KeyboardEvent) => void>(() => {});
  outsideKey.current = event => {
    if (!page || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]') || canvas.current?.closest('.thread-map')?.contains(target)) return;
    if (!canvas.current?.getClientRects().length) return; // Persistent maps can be hidden by the host.
    if (event.key === '/') { event.preventDefault(); filter.current?.focus(); }
    else if (['1', '2', '3'].includes(event.key)) { event.preventDefault(); setScope((page ? ['all', 'active', 'all'] as const : ['active', 'week', 'all'] as const)[Number(event.key) - 1]!); }
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => outsideKey.current(event);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useMapMotion(stage, stableLayout, current.id, root, size, openGroups);
  const pendingReveal = useRef<string | null>(null);
  const pendingRevealTarget = useRef<string | null>(null);
  const pendingPulses = useRef(new Set<string>());
  const previousPulses = useRef(new Set<string>());
  useEffect(() => {
    const keys = new Set(pulseKeys ?? []);
    for (const key of keys) if (!previousPulses.current.has(key)) pendingPulses.current.add(key);
    previousPulses.current = keys;
  }, [pulseKeys]);
  const lastRevealed = useRef<string | null>(null);
  useEffect(() => {
    if (!revealKey) { lastRevealed.current = null; return; }
    if (lastRevealed.current === revealKey) return;
    if (revealKey.startsWith('device:')) {
      const device = devices.find(item => `device:${item.id}` === revealKey);
      if (!device) return;
      if (device.state === 'offline') setCachedDevices(previous => new Set([...previous, device.id]));
      setLayoutRevision(revision => revision + 1);
      setFocusId(revealKey);
      lastRevealed.current = revealKey; pendingReveal.current = revealKey; pendingRevealTarget.current = revealKey;
      pendingPulses.current.add(revealKey);
      return;
    }
    const find = (thread: ThreadMapThread): ThreadMapThread[] | null => {
      if (thread.key === revealKey) return [thread];
      for (const child of thread.children ?? []) { const path = find(child); if (path) return [thread, ...path]; }
      return null;
    };
    for (const device of devices) for (const workspace of device.workspaces) for (const thread of workspace.threads) {
      const path = find(thread);
      if (!path) continue;
      setLayoutRevision(revision => revision + 1);
      setExpandedWorkspaces(previous => new Set([...previous, `workspace:${device.id}:${workspace.id}`]));
      if (device.state === 'offline') setCachedDevices(previous => new Set([...previous, device.id]));
      setOpenGroups(previous => new Set([...previous, ...path.slice(0, -1).map(item => item.key)]));
      setFocusId(`workspace:${device.id}:${workspace.id}`);
      lastRevealed.current = revealKey;
      pendingReveal.current = revealKey;
      pendingRevealTarget.current = `workspace:${device.id}:${workspace.id}`;
      pendingPulses.current.add(revealKey);
      return;
    }
  }, [revealKey, devices]);
  // Event pulses are consumed once; geometry/content refreshes never replay them.
  useEffect(() => {
    if (document.visibilityState === 'hidden' || canvas.current?.closest('[hidden], [inert]')) {
      for (const key of pendingPulses.current) if (key !== pendingReveal.current) pendingPulses.current.delete(key);
      return;
    }
    if (!canvas.current || !size.width) return;
    for (const key of pendingPulses.current) {
      if (pendingReveal.current === key && current.id !== pendingRevealTarget.current) continue;
      const element = key.startsWith('device:') ? current.id === key ? canvas.current : byMapId(stage.current, key) : byMapId(stage.current, `thread:${key}`);
      if (!element) { if (pendingReveal.current !== key) pendingPulses.current.delete(key); continue; }
      const waiting = element.hasAttribute('data-waiting');
      if (pendingReveal.current === key && element.closest('.thread-map-list-scroll')) element.scrollIntoView?.({ block: 'nearest' });
      element.setAttribute('data-pulse', waiting ? 'waiting' : 'done');
      const clear = () => element.removeAttribute('data-pulse');
      const timer = setTimeout(clear, 900);
      element.addEventListener('animationend', () => { clearTimeout(timer); clear(); }, { once: true });
      pendingPulses.current.delete(key);
      if (pendingReveal.current === key) pendingReveal.current = null;
    }
  });

  const chain: MapNode[] = [];
  for (let node: MapNode | undefined = current; node; node = node.parent) chain.unshift(node);
  // Moving between levels zooms: a block tapped grows from where it was to fill
  // the map; going up, the level left shrinks back into its place.
  const navigate = (node: MapNode | undefined, from?: Element | null, plan?: ZoomPlan) => {
    const target = node ?? root;
    if (target === current) return;
    const box = canvas.current?.getBoundingClientRect();
    // A child picked from the list grows from its block too.
    from ??= target.parent === current ? byMapId(stage.current, target.id) : null;
    if (plan) zoomPlan.current = plan;
    else if (from && box) {
      const rect = from.getBoundingClientRect();
      zoomPlan.current = { kind: 'in', rect: { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height } };
    } else {
      let child: MapNode | undefined = current;
      while (child && child.parent !== target) child = child.parent;
      zoomPlan.current = child ? { kind: 'out', childId: child.id } : { kind: 'fade' };
    }
    setFocusId(target === root ? null : target.id);
    setTip(null);
    crumbs.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    const plan = zoomPlan.current;
    zoomPlan.current = null;
    const element = stage.current, box = canvas.current;
    if (!plan || !element || !box || typeof element.animate !== 'function' || reducedMotion()) return;
    const { width, height } = box.getBoundingClientRect();
    if (!width || !height) return;
    let from = 'scale(1.06)';
    if (plan.kind === 'in') {
      const r = plan.rect;
      from = `translate(${r.x}px, ${r.y}px) scale(${r.width / width}, ${r.height / height})`;
    } else if (plan.kind === 'out') {
      const child = byMapId(element, plan.childId);
      if (child) {
        const c = child.getBoundingClientRect(), b = box.getBoundingClientRect();
        from = `scale(${width / c.width}, ${height / c.height}) translate(${b.left - c.left}px, ${b.top - c.top}px)`;
      }
    }
    element.animate([{ transform: from, opacity: plan.kind === 'fade' ? 0 : 0.55 }, { transform: 'none', opacity: 1 }],
      { duration: 280, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' });
  }, [current.id]);

  // Touch: two fingers pinch in for the level above or spread to open the block
  // under them; one finger dragging down takes the map away.
  const gesture = useRef({ navigate, current, root, nodes, onDismiss });
  gesture.current = { navigate, current, root, nodes, onDismiss: page ? undefined : onDismiss };
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let pinch: { d0: number; x: number; y: number; ratio: number } | null = null;
    let drag: { x: number; y: number; t: number; dy: number; active: boolean } | null = null;
    const sheet = () => node.closest<HTMLElement>('.thread-map-dialog');
    const spread = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const settleSheet = () => {
      const dialog = sheet();
      if (!dialog) return;
      dialog.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out';
      dialog.style.transform = '';
      dialog.style.opacity = '';
      window.setTimeout(() => { dialog.style.transition = ''; }, 200);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        if (drag?.active) settleSheet();
        drag = null;
        const box = node.getBoundingClientRect();
        pinch = {
          d0: spread(event.touches) || 1, ratio: 1,
          x: (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2 - box.left,
          y: (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2 - box.top,
        };
      } else if (event.touches.length === 1 && !pinch) {
        drag = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY, t: event.timeStamp, dy: 0, active: false };
      }
    };
    const move = (event: TouchEvent) => {
      if (pinch && event.touches.length >= 2) {
        event.preventDefault();
        pinch.ratio = Math.max(0.6, Math.min(1.6, spread(event.touches) / pinch.d0));
        if (stage.current) stage.current.style.transform = `translate(${pinch.x}px, ${pinch.y}px) scale(${pinch.ratio}) translate(${-pinch.x}px, ${-pinch.y}px)`;
        return;
      }
      if (!drag || event.touches.length !== 1) return;
      const dx = event.touches[0]!.clientX - drag.x, dy = event.touches[0]!.clientY - drag.y;
      if (!drag.active) {
        if (dy > 12 && dy > Math.abs(dx) * 1.3 && gesture.current.onDismiss) drag.active = true;
        else if (Math.abs(dx) > 12 || dy < -12) { drag = null; return; } else return;
      }
      event.preventDefault();
      drag.dy = Math.max(0, dy);
      const dialog = sheet();
      if (dialog) {
        dialog.style.transition = 'none';
        dialog.style.transform = `translateY(${drag.dy}px)`;
      }
    };
    const end = (event: TouchEvent) => {
      if (pinch) {
        if (event.touches.length >= 2) return;
        const { ratio, x, y } = pinch;
        pinch = null;
        drag = null;
        if (stage.current) stage.current.style.transform = '';
        const { navigate: go, current: at, root: top, nodes: all } = gesture.current;
        if (ratio < 0.8 && at !== top) { go(at.parent, null, { kind: 'fade' }); return; }
        if (ratio > 1.25) {
          const box = node.getBoundingClientRect();
          const target = document.elementFromPoint(box.left + x, box.top + y)?.closest<HTMLElement>('[data-zoomable]');
          const next = target?.dataset.mapId ? all.get(target.dataset.mapId) : undefined;
          if (next) { go(next, target); return; }
        }
        stage.current?.animate?.([{ transform: `translate(${x}px, ${y}px) scale(${ratio}) translate(${-x}px, ${-y}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
        return;
      }
      const finished = drag;
      drag = null;
      if (!finished?.active) return;
      const fast = finished.dy / Math.max(1, event.timeStamp - finished.t) > 0.6;
      const dialog = sheet();
      if (finished.dy > 110 || (fast && finished.dy > 40)) {
        if (dialog) {
          // Leave by the way the finger went, without the dialog's own exit animation.
          dialog.setAttribute('data-swiped', '');
          dialog.style.transition = 'transform 160ms ease-in, opacity 160ms ease-in';
          dialog.style.transform = 'translateY(100%)';
          dialog.style.opacity = '0';
        }
        window.setTimeout(() => gesture.current.onDismiss?.(), dialog ? 150 : 0);
      } else settleSheet();
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return () => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, []);
  const open = (thread: ThreadMapThread) => (event: ReactMouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    latest.current.onOpen(thread);
  };
  const showTip = (lines: string[], target: HTMLElement) => {
    const source = target.closest<HTMLElement>('.thread-map-tile, .thread-map-list-row, .thread-map-overflow-row, .thread-map-section, .thread-map-dense-header, .thread-map-overflow') ?? target;
    setTip({ lines, target: source });
  };
  const hover = (lines: string[] | (() => string[])) => ({
    onPointerEnter: (event: { pointerType: string; currentTarget: HTMLElement }) => { if (event.pointerType === 'mouse') showTip(typeof lines === 'function' ? lines() : lines, event.currentTarget); },
    onPointerLeave: () => setTip(null),
    onFocus: (event: { currentTarget: HTMLElement }) => showTip(typeof lines === 'function' ? lines() : lines, event.currentTarget),
    onBlur: () => setTip(null),
  });

  // A block shows what is inside it while each thread can be more than a speck
  // and each inner block about a label; smaller inner blocks fold up themselves.
  const fits = (node: MapNode, inner: MapRect, depth: number) => {
    if (depth > 2 || inner.width < 64 || inner.height < 40 || !node.children.length) return false;
    return node.children.length <= (inner.width * inner.height) / (node.children[0]!.kind === 'thread' ? 90 : 900);
  };

  // A thread opened up: its bar on top (tap to fold back, arrow to open it), its agent threads below.
  const group = (item: MapNode, box: MapRect, depth: number, offset: {x: number; y: number}) => {
    const thread = item.thread!;
    const children: MapNode[] = thread.children!.map(child => ({
      id: `thread:${child.key}`, kind: 'thread', label: child.title, parent: item, children: [], thread: child,
      device: item.device, workspace: item.workspace, weight: threadWeight(child.turns), turns: child.turns ?? 0,
      activeMs: child.activeMs ?? 0, threads: 1, running: child.running ? 1 : 0,
      usd: child.priceEstimate?.totalUsd ?? 0, tokens: child.tokenUsage?.totalTokens ?? 0,
    } satisfies MapNode)).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
    const inner = { x: 3, y: HEADER, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - HEADER - 3) };
    return (
      <section key={item.id} data-map-id={item.id} className="thread-map-section thread-map-group" data-kind="group" data-depth={depth}
        aria-label={thread.title} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
        <div className="thread-map-group-head">
          <button type="button" className="thread-map-section-head" aria-expanded="true"
            aria-label={translate('workbench.threadMapHideChildren', { title: thread.title })} onClick={() => toggleGroup(thread.key)}>
            <AgentChip agent={thread.agent} />
            <span className="thread-map-section-label">{thread.title}</span>
            {box.width >= 110 && <span className="thread-map-section-count"><Network aria-hidden="true" />{children.length}</span>}
            <ChevronUp aria-hidden="true" />
          </button>
          {box.width >= 80 && <a className="thread-map-group-open" href={thread.href} onClick={open(thread)}
            aria-label={translate('workbench.threadMapOpenThread', { title: thread.title })} title={translate('workbench.threadMapOpenThread', { title: thread.title })}>
            <ArrowUpRight aria-hidden="true" />
          </a>}
        </div>
        {render(children, inner, depth + 1, { x: offset.x + box.x, y: offset.y + box.y })}
      </section>
    );
  };

  let rendered = 0;
  if (!page) spatial.current = [];
  const runningLeaves = (node: MapNode): MapNode[] => node.kind === 'thread'
    ? (node.running ? [node] : [])
    : node.children.flatMap(runningLeaves);
  // Every level answers: a thread opens from its tile wherever it shows, and a
  // device or workspace opens from its header row (or anywhere, when it is too
  // small to show what is inside).
  const render = (items: MapNode[], bounds: MapRect, depth: number, offset = { x: 0, y: 0 }): ReactNode[] =>
    layouts.current.layout(items[0]?.parent?.id ?? current.id, items, bounds).map(({ item, rect }) => {
      rendered++;
      const box = inset(rect, depth ? 1.5 : 2.5);
      if (item.kind === 'compressed') {
        spatial.current.push({ id: item.id, rect: { ...box, x: box.x + offset.x, y: box.y + offset.y } });
        return <button type="button" key={item.id} data-map-id={item.id} className="thread-map-compressed" data-dimmed={Boolean(query.trim()) || undefined}
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }} onClick={() => expand(item)} aria-label={item.label} {...hover([item.label])}>{item.label}</button>;
      }
      if (item.kind === 'thread') {
        spatial.current.push({ id: item.id, rect: { ...box, x: box.x + offset.x, y: box.y + offset.y } });
        const thread = item.thread!;
        if (thread.children?.length && openGroups.has(thread.key)) return group(item, box, depth, offset);
        return <ThreadTile key={item.id} node={item} box={box} hours={hours} current={thread.key === currentKey}
          onOpen={open(thread)} hover={hover(() => describe(item, hours))} dimmed={Boolean(query.trim()) && !hasMatch(item)}
          onQuickLook={onQuickLook ? quickLook : undefined} onShowChildren={thread.children?.length ? () => toggleGroup(thread.key) : undefined} />;
      }
      const lines = describe(item, hours);
      const text = lines.join(' · ');
      const state = item.device?.state;
      const unlisted = item.kind === 'device' && state !== 'ready' && !(enhanced && item.children.length > 0);
      const extra = item.kind === 'device' ? deviceExtras?.[item.device!.id] : undefined;
      const header = extra ? 36 : HEADER;
      const inner = { x: 3, y: header, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - header - 3) };
      const preview = !unlisted && rendered < 1600 && fits(item, inner, depth);
      // A block too small for everything inside still shows the agents running
      // there (up to four), with the rest counted under them.
      const live = !preview && !unlisted && item.running > 0 && inner.width >= 44 && inner.height >= 34
        ? runningLeaves(item).slice(0, 4) : [];
      const liveInner = { ...inner, height: Math.max(0, inner.height - (item.threads > live.length ? 15 : 0)) };
      const named = box.width >= 72;
      const Icon = item.kind === 'device' ? Monitor : Folder;
      const zoomable = !unlisted;
      const head = <>
        {named && (extra ? <DeviceStateMark /> : <Icon aria-hidden="true" />)}
        <span className="thread-map-section-label">{item.label}</span>
        {extra && box.width >= 280 && <DeviceReadings extra={extra} />}
        {unlisted
          ? named && <span className="thread-map-section-count">{state === 'error' ? <RotateCw aria-hidden="true" /> : translate(state === 'offline' ? 'workbench.threadMapOffline' : 'workbench.threadMapLoading')}</span>
          : named && <span className="thread-map-section-count">
            {item.running > 0 && <i className="thread-map-running-dot" aria-hidden="true" />}{item.threads}
            {item.usd > 0 && box.width >= 150 && <span className="thread-map-section-usd">{formatCompactUsd(item.usd)}</span>}
          </span>}
      </>;
      if (!preview && !live.length && zoomable) spatial.current.push({ id: item.id, rect: { ...box, x: box.x + offset.x, y: box.y + offset.y } });
      const zoom = (event: ReactMouseEvent<HTMLElement>) => navigate(item, event.currentTarget.closest('section'));
      return (
        <section key={item.id} data-map-id={item.id} className="thread-map-section" data-kind={item.kind} data-depth={depth} data-state={unlisted ? state : undefined}
          data-dimmed={Boolean(query.trim()) && !hasMatch(item) || undefined} data-cached={cachedDevices.has(item.device?.id ?? '') || undefined}
          data-collapsed={(!preview && !live.length) || undefined} data-live={item.running > 0 || undefined}
          data-heat={preview || live.length ? undefined : heatLevel(item.activeMs)} data-running={!preview && !live.length && item.running ? true : undefined}
          data-zoomable={zoomable || undefined} aria-label={text} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
          <div className="thread-map-section-header" style={{ height: header }} title={extra?.metrics}>
          {(preview || live.length > 0) && zoomable
            ? <button type="button" className="thread-map-section-head" aria-label={translate('workbench.threadMapExplore', { name: text })}
              onClick={zoom} {...hover(lines)}>{head}</button>
            : <div className="thread-map-section-head">{head}</div>}
          {extra?.menuItems?.length ? <DeviceMenu device={item.device!} items={extra.menuItems} /> : null}
          {extra?.metrics && <span className="thread-map-metrics">{extra.metrics}</span>}
          </div>
          {preview && <div className="thread-map-preview">{render(item.children, inner, depth + 1, { x: offset.x + box.x, y: offset.y + box.y })}</div>}
          {live.length > 0 && <div className="thread-map-preview">{render(live, liveInner, depth + 1, { x: offset.x + box.x, y: offset.y + box.y })}</div>}
          {live.length > 0 && item.threads > live.length && (
            <span className="thread-map-section-summary" aria-hidden="true">{translate('workbench.threadMapMoreThreads', { count: item.threads - live.length })}</span>
          )}
          {!preview && !live.length && !unlisted && box.height >= HEADER + 18 && (
            <span className="thread-map-section-summary" aria-hidden="true">{translate('workbench.threadMapThreads', { count: item.threads })}</span>
          )}
          {!preview && !live.length && zoomable && <button type="button" className="thread-map-zoom" aria-label={translate('workbench.threadMapExplore', { name: text })}
            onClick={zoom} {...hover(lines)} />}
          {unlisted && state === 'error' && onRetry && <button type="button" className="thread-map-zoom"
            aria-label={`${translate('workbench.threadMapRetry')} · ${text}`} onClick={() => onRetry(item.device!.id)} {...hover(lines)} />}
        </section>
      );
    });

  const children = current.children;
  const bounds = { x: 0, y: 0, width: size.width, height: size.height };
  const breadcrumb = <>
        <button type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapBack')} disabled={current === root} onClick={() => navigate(current.parent)}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <nav ref={crumbs} tabIndex={-1} className="thread-map-crumbs" aria-label={translate('workbench.threadMapPath')}>
          {chain.map((node, index) => {
            const href = page && node.kind === 'thread' ? undefined : node.workspace ? node.workspace.href : node.device?.href;
            const label = translate(node.workspace ? 'workbench.threadMapOpenWorkspace' : 'workbench.threadMapOpenDevice', { name: node.label });
            return (
              <span key={node.id} className="thread-map-crumb">
                {index > 0 && <ChevronRight aria-hidden="true" />}
                <button type="button" aria-current={node === current ? 'location' : undefined} onClick={() => navigate(node)} title={node.label}>{node.label}</button>
                {href && <a className="thread-map-crumb-open" href={href} aria-label={label} title={label} onClick={event => {
                  if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  onNavigate(href);
                }}><ArrowUpRight data-icon="open" aria-hidden="true" /></a>}
              </span>
            );
          })}
        </nav>
  </>;
  return (
    <div className="thread-map" data-presentation={presentation} onKeyDown={keyboard}>
      {page && <div className="thread-map-bar thread-map-dense-toolbar">
        {breadcrumb}
        <span className="thread-map-dense-summary">
          <span title={translate('workbench.threadMapThreads',{count:root.threads})}><Layers aria-hidden="true"/>{root.threads}</span>
          {root.running>0&&<span title={translate('workbench.threadMapRunningCount',{count:root.running})}><Activity aria-hidden="true"/>{root.running}</span>}
          {root.usd>0&&<span title={translate('workbench.threadMapCost',{usd:formatCompactUsd(root.usd)})}><DollarSign aria-hidden="true"/>{formatCompactUsd(root.usd).replace(/^\$/, '')}</span>}
        </span>
        <label className="thread-map-filter"><input ref={filter} type="search" value={query} placeholder={translate('workbench.threadMapFilter')} aria-label={translate('workbench.threadMapFilter')} onChange={event=>setFilter(event.target.value)}/>{query.trim()?<span role="status">{translate('workbench.threadMapMatches',{count:matches.size})}</span>:<kbd>/</kbd>}</label>
        <div className="thread-map-scope" role="group" aria-label={translate('workbench.threadMapScope')}>
          {(['all','active'] as const).map((value,index)=><button key={value} type="button" aria-pressed={scope===value} aria-keyshortcuts={String(index+1)} aria-label={translate(value==='all'?'workbench.threadMapScopeAll':'workbench.threadMapScopeActive')} title={translate(value==='all'?'workbench.threadMapScopeAll':'workbench.threadMapScopeActive')} onClick={()=>setScope(value)}>{value==='all'?<Layers aria-hidden="true"/>:<Activity aria-hidden="true"/>}</button>)}
        </div>
        <button type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapRefreshLayout')} title={translate('workbench.threadMapRefreshLayout')} onClick={()=>setLayoutRevision(n=>n+1)}><RotateCw aria-hidden="true"/></button>
        {current.device && cachedDevices.has(current.device.id) && <span className="thread-map-cached-label">{translate('workbench.threadMapCached')}</span>}
        <MapLegend compact inline><span>{translate('workbench.threadMapLegendSize')}</span><span>{translate('workbench.threadMapLegendColor',{hours})}</span><span><StatusMark status="waiting"/>{translate('workbench.waitingForYou')}</span><span><StatusMark status="running"/>{translate('workbench.threadMapRunning')}</span></MapLegend>
        {actions}
      </div>}
      {!page && <div className="thread-map-bar">
        {heading}
        <span className="thread-map-summary">
          {translate('workbench.threadMapThreads', { count: root.threads })}
          {root.running > 0 && <> · <i className="thread-map-running-dot" aria-hidden="true" />{translate('workbench.threadMapRunningCount', { count: root.running })}</>}
          {root.usd > 0 && <> · {translate('workbench.threadMapCost', { usd: formatCompactUsd(root.usd) })}</>}
        </span>
        {(enhanced || onFilterChange) && <label className="thread-map-filter">
          <input ref={filter} type="search" value={query} placeholder={translate('workbench.threadMapFilter')} aria-label={translate('workbench.threadMapFilter')}
            onChange={event => setFilter(event.target.value)} />
          {query.trim() ? <span role="status">{translate('workbench.threadMapMatches', { count: matches.size })}</span> : <kbd>/</kbd>}
        </label>}
        {enhanced && <div className="thread-map-scope" role="group" aria-label={translate('workbench.threadMapScope')}>
          {(['active', 'week', 'all'] as const).map((value, index) => <button key={value} type="button" aria-pressed={scope === value} aria-keyshortcuts={String(index + 1)} onClick={() => setScope(value)}>
            {translate(value === 'active' ? 'workbench.threadMapScopeActive' : value === 'week' ? 'workbench.threadMapScopeWeek' : 'workbench.threadMapScopeAll')}
          </button>)}
        </div>}
        {actions}
      </div>}
      {attention && <AttentionStrip responsive={page} items={attention} onOpen={key => {
        const thread = nodes.get(`thread:${key}`)?.thread ?? devices.flatMap(device => device.workspaces.flatMap(workspace => workspace.threads)).find(thread => thread.key === key);
        if (thread) latest.current.onOpen(thread); else onQuickLook?.(key);
      }} onRequestDecision={onRequestDecision} />}
      {!page && <div className="thread-map-bar thread-map-path">
        {breadcrumb}
        {stableLayout && <button type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapRefreshLayout')}
          onClick={() => setLayoutRevision(revision => revision + 1)}><RotateCw data-icon="refresh" aria-hidden="true" /></button>}
        {children.length > 0 && <label className="thread-map-goto" title={translate('workbench.threadMapGoTo')}>
          <List aria-hidden="true" />
          <select aria-label={translate('workbench.threadMapGoTo')} value="" onChange={event => {
            const node = nodes.get(event.target.value);
            if (node?.thread) onOpen(node.thread);
            else if (node) navigate(node);
          }}>
            <option value="">{translate('workbench.threadMapGoTo')}</option>
            {children.map(node => <option key={node.id} value={node.id} disabled={node.kind === 'device' && node.device?.state !== 'ready'}>{describe(node, hours).join(' · ')}</option>)}
          </select>
        </label>}
        {current.device && cachedDevices.has(current.device.id) && <span className="thread-map-cached-label">{translate('workbench.threadMapCached')}
          {current.device.cachedAt && <> · {relativeCache(current.device.cachedAt)}</>}</span>}
      </div>}
      <div ref={canvas} className="thread-map-canvas" role="group" tabIndex={-1} aria-label={current.label}
        onPointerEnter={() => { pointerInside.current = true; if (stableLayout) freeze(); }}
        onPointerLeave={() => { pointerInside.current = false; if (stableLayout) thaw(); }}
        onFocusCapture={() => { focusInside.current = true; if (stableLayout) freeze(); }}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focusInside.current = false; if (stableLayout) thaw(); } }}>
        {children.length
          ? <div ref={stage} className="thread-map-stage">{page ? <DenseMap current={current} bounds={bounds} hours={hours} currentKey={currentKey} frozen={stableLayout && frozen}
            version={`${scope}:${layoutRevision}`} query={query} matches={hasMatch} extras={deviceExtras} cached={cachedDevices}
            navigate={navigate} expand={expand} onOpen={open} onQuickLook={onQuickLook ? quickLook : undefined} hover={hover}
            register={items => { spatial.current = items; }} onRetry={onRetry} /> : size.width > 0 && render(children, bounds, 0)}</div>
          : <p className="thread-map-empty" role="status">{current.device && cachedDevices.has(current.device.id) ? translate('workbench.threadMapNoCache') : devices.some(device => device.state === 'loading') ? translate('workbench.threadMapLoading') : translate('workbench.threadMapEmpty')}</p>}
        {tip && <MapTooltip anchor={tip.target} lines={tip.lines} onClose={() => setTip(null)} />}
      </div>
      {enhanced && devices.some(device => device.state === 'offline' || page && !device.workspaces.some(w=>w.threads.length)) && <div className="thread-map-offline-strip">
        {devices.filter(device => device.state === 'offline' || page && !device.workspaces.some(w=>w.threads.length)).map(device => <button type="button" key={device.id} onClick={() => {
          setCachedDevices(previous => new Set([...previous, device.id])); setFocusId(`device:${device.id}`);
        }} title={[device.name,device.state==='offline'?translate('workbench.threadMapOffline'):translate('workbench.threadMapEmpty'),device.cachedAt?relativeCache(device.cachedAt):''].filter(Boolean).join(' · ')}><DeviceStateMark offline={device.state==='offline'} /><b>{device.name}</b><span>{translate('workbench.threadMapOffline')}</span>
          {device.cachedAt && <span>{relativeCache(device.cachedAt)}</span>}
          <small>{translate(device.workspaces.length ? 'workbench.threadMapCached' : 'workbench.threadMapNoCache')}</small>
        </button>)}
      </div>}
      {!page && <MapLegend compact={false}>
        <span>{translate('workbench.threadMapLegendSize')}</span>
        <span className="thread-map-scale">
          {translate('workbench.threadMapLegendColor', { hours })}
          <small>{translate('workbench.threadMapLess')}</small>
          {[0, 1, 2, 3, 4].map(level => <i key={level} data-heat={level} aria-hidden="true" />)}
          <small>{translate('workbench.threadMapMore')}</small>
        </span>
        <span className="thread-map-scale thread-map-ages">
          {translate('workbench.threadMapLegendAge')}
          <small>{translate('workbench.threadMapNewer')}</small>
          {[0, 1, 2, 3, 4].map(tier => <AgeGlyph key={tier} tier={tier} />)}
          <small>{translate('workbench.threadMapOlder')}</small>
        </span>
        <span className="thread-map-legend-item"><span className="thread-map-legend-spark" aria-hidden="true"><i /><i /><i /><i /></span>{translate('workbench.threadMapLegendHourly')}</span>
        <span className="thread-map-legend-item"><i className="thread-map-running-dot" aria-hidden="true" />{translate('workbench.threadMapLegendRunning')}</span>
      </MapLegend>}
    </div>
  );
}
