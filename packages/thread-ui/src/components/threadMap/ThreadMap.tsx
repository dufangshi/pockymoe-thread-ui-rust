import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Folder, List, Monitor, RotateCw } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { themeAgentName } from '../themeAgent';
import { buildThreadMap, heatLevel, indexMap, type MapNode, type ThreadMapDevice, type ThreadMapThread } from './model';
import { squarify, type MapRect } from './squarify';

/** Height of a device or workspace title bar. */
const HEADER = 26;
/** Monograms for agents a theme gives no art. */
const MONOGRAMS: Record<string, string> = {
  claude: 'Cl', codex: 'Cx', copilot: 'Co', cursor: 'Cu', deepseek: 'DS', gemini: 'Ge', grok: 'Gk', kimi: 'Ki', opencode: 'OC', qwen: 'Qw',
};
const monogram = (agent: string) => MONOGRAMS[agent] ?? agent.replace(/[^a-z0-9]/gi, '').slice(0, 2).replace(/^./, c => c.toUpperCase());

export function formatRunTime(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return translate('workbench.threadMapUnderMinute');
  if (minutes < 60) return translate('workbench.threadMapMinutes', { count: minutes });
  return translate('workbench.threadMapHoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function describe(node: MapNode, hours: number) {
  const parts = [node.label];
  const thread = node.thread;
  if (thread) {
    if (thread.agent) parts.push(thread.agentName ?? themeAgentName(thread.agent));
    if (node.parent && node.parent.kind !== 'root') parts.push(node.parent.label);
    if (thread.turns !== null) parts.push(translate('workbench.threadMapTurns', { count: thread.turns }));
    if (thread.activeMs !== null) parts.push(thread.activeMs > 0
      ? translate('workbench.threadMapRan', { hours, duration: formatRunTime(thread.activeMs) })
      : translate('workbench.threadMapNotRun', { hours }));
    if (thread.agentThreads) parts.push(translate('workbench.threadMapAgentThreads', { count: thread.agentThreads }));
    if (thread.running) parts.push(translate('workbench.threadMapRunning'));
    return parts.join(' · ');
  }
  const state = node.device?.state;
  if (node.kind === 'device' && state && state !== 'ready') {
    parts.push(translate(state === 'offline' ? 'workbench.threadMapOffline' : state === 'loading' ? 'workbench.threadMapLoading' : 'workbench.threadMapFailed'));
    return parts.join(' · ');
  }
  parts.push(translate('workbench.threadMapThreads', { count: node.threads }));
  if (node.running) parts.push(translate('workbench.threadMapRunningCount', { count: node.running }));
  if (node.activeMs > 0) parts.push(translate('workbench.threadMapRan', { hours, duration: formatRunTime(node.activeMs) }));
  return parts.join(' · ');
}

function inset(rect: MapRect, gap: number): MapRect {
  const g = Math.min(gap, rect.width / 6, rect.height / 6);
  return { x: rect.x + g, y: rect.y + g, width: Math.max(0, rect.width - g * 2), height: Math.max(0, rect.height - g * 2) };
}

/**
 * Every thread on every device as a treemap: devices hold workspaces, workspaces
 * hold threads. A thread's area follows its turns and its color the time it ran
 * in the last `hours`; running threads breathe. Device and workspace bars drill
 * in, a thread opens it.
 */
export function ThreadMap({ devices, currentKey, hours = 24, heading, actions, onOpen, onRetry }: {
  devices: ThreadMapDevice[];
  currentKey?: string | undefined;
  hours?: number;
  heading?: ReactNode;
  actions?: ReactNode;
  onOpen: (thread: ThreadMapThread) => void;
  onRetry?: ((deviceId: string) => void) | undefined;
}) {
  useI18n();
  const allLabel = translate('workbench.threadMapAll');
  const root = useMemo(() => buildThreadMap(devices, allLabel), [devices, allLabel]);
  const nodes = useMemo(() => indexMap(root), [root]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const current = (focusId ? nodes.get(focusId) : undefined) ?? root;
  const canvas = useRef<HTMLDivElement>(null);
  const crumbs = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null);
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
  const navigate = (node: MapNode | undefined) => {
    setFocusId(node && node !== root ? node.id : null);
    setTip(null);
    crumbs.current?.focus({ preventScroll: true });
  };
  const open = (thread: ThreadMapThread) => (event: ReactMouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(thread);
  };
  const showTip = (text: string, target: HTMLElement) => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    const anchor = target.getBoundingClientRect();
    const width = Math.min(300, box.width - 16);
    const below = anchor.top - box.top < box.height / 2;
    setTip({
      text,
      above: !below,
      x: Math.max(8, Math.min(box.width - width - 8, anchor.left - box.left)),
      y: below ? Math.min(box.height - 8, anchor.bottom - box.top + 6) : Math.max(8, anchor.top - box.top - 6),
    });
  };
  const hover = (text: string) => ({
    onPointerEnter: (event: { pointerType: string; currentTarget: HTMLElement }) => { if (event.pointerType === 'mouse') showTip(text, event.currentTarget); },
    onPointerLeave: () => setTip(null),
    onFocus: (event: { currentTarget: HTMLElement }) => showTip(text, event.currentTarget),
    onBlur: () => setTip(null),
  });

  const agentChip = (thread: ThreadMapThread) => thread.agent
    ? <span className="thread-map-agent" data-agent={thread.agent} aria-hidden="true">{monogram(thread.agent)}</span>
    : null;

  const tile = (node: MapNode, box: MapRect) => {
    const thread = node.thread!;
    const text = describe(node, hours);
    const full = box.width >= 112 && box.height >= 50;
    const named = box.width >= 60 && box.height >= 28;
    const icon = box.width >= 22 && box.height >= 20;
    const meta = [
      thread.turns !== null ? translate('workbench.threadMapTurns', { count: thread.turns }) : null,
      thread.activeMs ? formatRunTime(thread.activeMs) : null,
    ].filter(Boolean).join(' · ');
    return (
      <a key={node.id} href={thread.href} className="thread-map-tile" data-heat={heatLevel(thread.activeMs)} data-size={full ? 'full' : named ? 'named' : icon ? 'icon' : 'dot'}
        data-running={thread.running || undefined} aria-current={thread.key === currentKey ? 'page' : undefined}
        aria-label={text} tabIndex={icon ? undefined : -1}
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        onClick={open(thread)} {...hover(text)}>
        {icon && <span className="thread-map-tile-head">
          {agentChip(thread)}
          {named && <span className="thread-map-tile-title">{thread.title}</span>}
        </span>}
        {full && meta && <span className="thread-map-tile-meta">{meta}{thread.agentThreads ? ` · +${thread.agentThreads}` : ''}</span>}
      </a>
    );
  };

  // A block shows what is inside it while each thread can be more than a speck
  // and each inner block about a label; smaller inner blocks fold up themselves.
  const fits = (node: MapNode, inner: MapRect, depth: number) => {
    if (depth > 2 || inner.width < 64 || inner.height < 40 || !node.children.length) return false;
    return node.children.length <= (inner.width * inner.height) / (node.children[0]!.kind === 'thread' ? 90 : 900);
  };

  let rendered = 0;
  const render = (items: MapNode[], bounds: MapRect, depth: number): ReactNode[] =>
    squarify(items, item => item.weight, bounds).map(({ item, rect }) => {
      rendered++;
      const box = inset(rect, depth ? 1.5 : 2.5);
      if (item.kind === 'thread') return tile(item, box);
      const text = describe(item, hours);
      const state = item.device?.state;
      const unlisted = item.kind === 'device' && state !== 'ready';
      const inner = { x: 3, y: HEADER, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - HEADER - 3) };
      const preview = !unlisted && rendered < 600 && fits(item, inner, depth);
      const named = box.width >= 72;
      const Icon = item.kind === 'device' ? Monitor : Folder;
      return (
        <section key={item.id} className="thread-map-section" data-kind={item.kind} data-depth={depth} data-state={unlisted ? state : undefined} data-collapsed={!preview || undefined}
          data-heat={preview ? undefined : heatLevel(item.activeMs)} data-running={!preview && item.running ? true : undefined}
          aria-label={text} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
          <button type="button" className="thread-map-section-head" disabled={unlisted && !(state === 'error' && onRetry)}
            aria-label={unlisted ? (state === 'error' ? translate('workbench.threadMapRetry') + ' · ' + text : text) : translate('workbench.threadMapExplore', { name: text })}
            onClick={() => (unlisted ? state === 'error' && onRetry?.(item.device!.id) : navigate(item))} {...hover(text)}>
            {named && <Icon aria-hidden="true" />}
            <span className="thread-map-section-label">{item.label}</span>
            {unlisted
              ? named && <span className="thread-map-section-count">{state === 'error' ? <RotateCw aria-hidden="true" /> : translate(state === 'offline' ? 'workbench.threadMapOffline' : 'workbench.threadMapLoading')}</span>
              : named && <span className="thread-map-section-count">{item.running > 0 && <i className="thread-map-running-dot" aria-hidden="true" />}{item.threads}</span>}
          </button>
          {preview && render(item.children, inner, depth + 1)}
          {!preview && !unlisted && box.height >= HEADER + 18 && (
            <span className="thread-map-section-summary" aria-hidden="true">{translate('workbench.threadMapThreads', { count: item.threads })}</span>
          )}
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
            {children.map(node => <option key={node.id} value={node.id} disabled={node.kind === 'device' && node.device?.state !== 'ready'}>{describe(node, hours)}</option>)}
          </select>
        </label>}
      </div>
      <div ref={canvas} className="thread-map-canvas" role="group" aria-label={current.label}>
        {children.length
          ? size.width > 0 && render(children, bounds, 0)
          : <p className="thread-map-empty" role="status">{devices.some(device => device.state === 'loading') ? translate('workbench.threadMapLoading') : translate('workbench.threadMapEmpty')}</p>}
        {tip && <div className="thread-map-tip" role="tooltip" style={{ left: tip.x, top: tip.y }} data-above={tip.above || undefined}>{tip.text}</div>}
      </div>
      <div className="thread-map-legend">
        <span>{translate('workbench.threadMapLegendSize')}</span>
        <span className="thread-map-scale">
          {translate('workbench.threadMapLegendColor', { hours })}
          <small>{translate('workbench.threadMapLess')}</small>
          {[0, 1, 2, 3, 4].map(level => <i key={level} data-heat={level} aria-hidden="true" />)}
          <small>{translate('workbench.threadMapMore')}</small>
        </span>
        <span className="thread-map-legend-running"><i className="thread-map-running-dot" aria-hidden="true" />{translate('workbench.threadMapLegendRunning')}</span>
      </div>
    </div>
  );
}
