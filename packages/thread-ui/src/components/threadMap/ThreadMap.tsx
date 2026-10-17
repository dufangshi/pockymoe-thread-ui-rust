import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, ChevronUp, Folder, List, Monitor, Network, RotateCw } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { buildThreadMap, heatLevel, indexMap, threadWeight, type MapNode, type ThreadMapDevice, type ThreadMapThread } from './model';
import { AgeGlyph, AgentChip, formatRunTime, threadDetails, ThreadTile } from './ThreadTile';
import { formatCompactUsd } from '../timeline/tokenFormatting';
import { squarify, type MapRect } from './squarify';

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
export function ThreadMap({ devices, currentKey, hours = 24, heading, actions, onOpen, onRetry, onDismiss }: {
  devices: ThreadMapDevice[];
  currentKey?: string | undefined;
  hours?: number;
  heading?: ReactNode;
  actions?: ReactNode;
  onOpen: (thread: ThreadMapThread) => void;
  onRetry?: ((deviceId: string) => void) | undefined;
  /** Closes the map; a downward drag on it asks for this. */
  onDismiss?: (() => void) | undefined;
}) {
  useI18n();
  const allLabel = translate('workbench.threadMapAll');
  const root = useMemo(() => buildThreadMap(devices, allLabel), [devices, allLabel]);
  const nodes = useMemo(() => indexMap(root), [root]);
  const [focusId, setFocusId] = useState<string | null>(null);
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
  const current = (focusId ? nodes.get(focusId) : undefined) ?? root;
  const canvas = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const crumbs = useRef<HTMLElement>(null);
  const zoomPlan = useRef<ZoomPlan | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tip, setTip] = useState<{ lines: string[]; x: number; y: number; above: boolean } | null>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Theme art for an agent replaces its monogram.
  useLayoutEffect(() => {
    for (const chip of canvas.current?.querySelectorAll<HTMLElement>('.thread-map-agent') ?? []) {
      const art = getComputedStyle(chip).getPropertyValue('--theme-agent-avatar').includes('url(');
      chip.toggleAttribute('data-art', art);
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
  gesture.current = { navigate, current, root, nodes, onDismiss };
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
    onOpen(thread);
  };
  const showTip = (lines: string[], target: HTMLElement) => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    const anchor = target.getBoundingClientRect();
    const width = Math.min(300, box.width - 16);
    const below = anchor.top - box.top < box.height / 2;
    setTip({
      lines,
      above: !below,
      x: Math.max(8, Math.min(box.width - width - 8, anchor.left - box.left)),
      y: below ? Math.min(box.height - 8, anchor.bottom - box.top + 6) : Math.max(8, anchor.top - box.top - 6),
    });
  };
  const hover = (lines: string[]) => ({
    onPointerEnter: (event: { pointerType: string; currentTarget: HTMLElement }) => { if (event.pointerType === 'mouse') showTip(lines, event.currentTarget); },
    onPointerLeave: () => setTip(null),
    onFocus: (event: { currentTarget: HTMLElement }) => showTip(lines, event.currentTarget),
    onBlur: () => setTip(null),
  });

  // A block shows what is inside it while each thread can be more than a speck
  // and each inner block about a label; smaller inner blocks fold up themselves.
  const fits = (node: MapNode, inner: MapRect, depth: number) => {
    if (depth > 2 || inner.width < 64 || inner.height < 40 || !node.children.length) return false;
    return node.children.length <= (inner.width * inner.height) / (node.children[0]!.kind === 'thread' ? 90 : 900);
  };

  // A thread opened up: its bar on top (tap to fold back, arrow to open it), its agent threads below.
  const group = (item: MapNode, box: MapRect, depth: number) => {
    const thread = item.thread!;
    const children: MapNode[] = thread.children!.map(child => ({
      id: `thread:${child.key}`, kind: 'thread', label: child.title, parent: item, children: [], thread: child,
      device: item.device, workspace: item.workspace, weight: threadWeight(child.turns), turns: child.turns ?? 0,
      activeMs: child.activeMs ?? 0, threads: 1, running: child.running ? 1 : 0,
      usd: child.priceEstimate?.totalUsd ?? 0, tokens: child.tokenUsage?.totalTokens ?? 0,
    } satisfies MapNode)).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
    const inner = { x: 3, y: HEADER, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - HEADER - 3) };
    return (
      <section key={item.id} className="thread-map-section thread-map-group" data-kind="group" data-depth={depth}
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
        {render(children, inner, depth + 1)}
      </section>
    );
  };

  let rendered = 0;
  const runningLeaves = (node: MapNode): MapNode[] => node.kind === 'thread'
    ? (node.running ? [node] : [])
    : node.children.flatMap(runningLeaves);
  // Every level answers: a thread opens from its tile wherever it shows, and a
  // device or workspace opens from its header row (or anywhere, when it is too
  // small to show what is inside).
  const render = (items: MapNode[], bounds: MapRect, depth: number): ReactNode[] =>
    squarify(items, item => item.weight, bounds).map(({ item, rect }) => {
      rendered++;
      const box = inset(rect, depth ? 1.5 : 2.5);
      if (item.kind === 'thread') {
        const thread = item.thread!;
        if (thread.children?.length && openGroups.has(thread.key)) return group(item, box, depth);
        return <ThreadTile key={item.id} node={item} box={box} hours={hours} current={thread.key === currentKey}
          onOpen={open(thread)} hover={hover(describe(item, hours))}
          onShowChildren={thread.children?.length ? () => toggleGroup(thread.key) : undefined} />;
      }
      const lines = describe(item, hours);
      const text = lines.join(' · ');
      const state = item.device?.state;
      const unlisted = item.kind === 'device' && state !== 'ready';
      const inner = { x: 3, y: HEADER, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - HEADER - 3) };
      const preview = !unlisted && rendered < 600 && fits(item, inner, depth);
      // A block too small for everything inside still shows the agents running
      // there (up to four), with the rest counted under them.
      const live = !preview && !unlisted && item.running > 0 && inner.width >= 44 && inner.height >= 34
        ? runningLeaves(item).slice(0, 4) : [];
      const liveInner = { ...inner, height: Math.max(0, inner.height - (item.threads > live.length ? 15 : 0)) };
      const named = box.width >= 72;
      const Icon = item.kind === 'device' ? Monitor : Folder;
      const zoomable = !unlisted;
      const head = <>
        {named && <Icon aria-hidden="true" />}
        <span className="thread-map-section-label">{item.label}</span>
        {unlisted
          ? named && <span className="thread-map-section-count">{state === 'error' ? <RotateCw aria-hidden="true" /> : translate(state === 'offline' ? 'workbench.threadMapOffline' : 'workbench.threadMapLoading')}</span>
          : named && <span className="thread-map-section-count">
            {item.running > 0 && <i className="thread-map-running-dot" aria-hidden="true" />}{item.threads}
            {item.usd > 0 && box.width >= 150 && <span className="thread-map-section-usd">{formatCompactUsd(item.usd)}</span>}
          </span>}
      </>;
      const zoom = (event: ReactMouseEvent<HTMLElement>) => navigate(item, event.currentTarget.closest('section'));
      return (
        <section key={item.id} data-map-id={item.id} className="thread-map-section" data-kind={item.kind} data-depth={depth} data-state={unlisted ? state : undefined}
          data-collapsed={(!preview && !live.length) || undefined} data-live={item.running > 0 || undefined}
          data-heat={preview || live.length ? undefined : heatLevel(item.activeMs)} data-running={!preview && !live.length && item.running ? true : undefined}
          data-zoomable={zoomable || undefined} aria-label={text} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
          {(preview || live.length > 0) && zoomable
            ? <button type="button" className="thread-map-section-head" aria-label={translate('workbench.threadMapExplore', { name: text })}
              onClick={zoom} {...hover(lines)}>{head}</button>
            : <div className="thread-map-section-head">{head}</div>}
          {preview && <div className="thread-map-preview">{render(item.children, inner, depth + 1)}</div>}
          {live.length > 0 && <div className="thread-map-preview">{render(live, liveInner, depth + 1)}</div>}
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
  return (
    <div className="thread-map">
      <div className="thread-map-bar">
        {heading}
        <span className="thread-map-summary">
          {translate('workbench.threadMapThreads', { count: root.threads })}
          {root.running > 0 && <> · <i className="thread-map-running-dot" aria-hidden="true" />{translate('workbench.threadMapRunningCount', { count: root.running })}</>}
          {root.usd > 0 && <> · {translate('workbench.threadMapCost', { usd: formatCompactUsd(root.usd) })}</>}
        </span>
        {actions}
      </div>
      <div className="thread-map-bar thread-map-path">
        <button type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapBack')} disabled={current === root} onClick={() => navigate(current.parent)}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <nav ref={crumbs} tabIndex={-1} className="thread-map-crumbs" aria-label={translate('workbench.threadMapPath')}>
          {chain.map((node, index) => (
            <span key={node.id} className="thread-map-crumb">
              {index > 0 && <ChevronRight aria-hidden="true" />}
              <button type="button" aria-current={node === current ? 'location' : undefined} onClick={() => navigate(node)} title={node.label}>{node.label}</button>
            </span>
          ))}
        </nav>
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
      </div>
      <div ref={canvas} className="thread-map-canvas" role="group" aria-label={current.label}>
        {children.length
          ? <div ref={stage} className="thread-map-stage">{size.width > 0 && render(children, bounds, 0)}</div>
          : <p className="thread-map-empty" role="status">{devices.some(device => device.state === 'loading') ? translate('workbench.threadMapLoading') : translate('workbench.threadMapEmpty')}</p>}
        {tip && <div className="thread-map-tip" role="tooltip" style={{ left: tip.x, top: tip.y }} data-above={tip.above || undefined}>
          {tip.lines.map((line, index) => index ? <span key={index}>{line}</span> : <b key={index}>{line}</b>)}
        </div>}
      </div>
      <div className="thread-map-legend">
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
      </div>
    </div>
  );
}
