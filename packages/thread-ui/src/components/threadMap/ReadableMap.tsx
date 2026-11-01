import { memo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight, Folder, Layers, Monitor } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { navigationStatusLabel, StatusMark } from '../StatusMark';
import { formatCompactUsd } from '../timeline/tokenFormatting';
import { AgentChip, ThreadTile } from './ThreadTile';
import { DeviceMenu, DeviceReadings, DeviceStateMark, relativeCache } from './MapChrome';
import { isLive, isWaiting, type MapNode, type ThreadMapThread } from './model';
import { ReadableSelection, type MapOverflow } from './readability';
import { MapScrollList } from './MapScrollList';
import type { MapRect } from './squarify';
import type { SpatialTarget } from './stableLayout';
import type { MapDeviceExtras } from './types';

export interface ReadableMapProps {
  current: MapNode;
  bounds: MapRect;
  hours: number;
  currentKey?: string;
  frozen: boolean;
  version: string;
  query: string;
  matches: (node: MapNode) => boolean;
  extras?: Readonly<Record<string, MapDeviceExtras>>;
  cached: ReadonlySet<string>;
  navigate: (node: MapNode, from?: Element | null) => void;
  expand: (node: MapNode) => void;
  onOpen: (thread: ThreadMapThread) => (event: MouseEvent) => void;
  onQuickLook?: (key: string) => void;
  hover: (lines: string[] | (() => string[])) => Record<string, unknown>;
  register: (items: SpatialTarget[]) => void;
  onRetry?: (id: string) => void;
}
const inset = (r: MapRect): MapRect => ({ x: r.x + 3, y: r.y + 3, width: Math.max(0, r.width - 6), height: Math.max(0, r.height - 6) });
const kindFor = (node: MapNode) => node.kind === 'workspace' || node.kind === 'thread' ? 'threads' : node.kind === 'device' ? 'workspaces' : 'devices';
const status = (node: MapNode) => isWaiting(node.thread!) ? 'waiting' : isLive(node.thread!) ? 'running' : node.thread!.failed ? 'failed' : node.thread!.interrupted ? 'interrupted' : node.thread!.unread ? 'unread' : 'idle';

function OverflowMarks({ overflow }: { overflow: MapOverflow }) {
  return <span className="thread-map-overflow-marks">
    {overflow.waiting > 0 && <span><StatusMark status="waiting" />{translate('workbench.threadMapWaitingCount', { count: overflow.waiting })}</span>}
    {overflow.running > 0 && <span><StatusMark status="running" />{translate('workbench.threadMapRunningCount', { count: overflow.running })}</span>}
    {overflow.failed > 0 && <span><StatusMark status="failed" />{overflow.failed}</span>}
    {overflow.unread > 0 && <span><StatusMark status="unread" />{overflow.unread}</span>}
  </span>;
}
function overflowLabel(overflow: MapOverflow) {
  return translate(overflow.kind === 'threads' ? 'workbench.threadMapRemainingThreads' : overflow.kind === 'workspaces' ? 'workbench.threadMapOtherWorkspaces' : 'workbench.threadMapOtherDevices', { count: overflow.count });
}

/** Dense workspace rows keep one line for the title and align metadata at the end. */
const ThreadRow = memo(function ThreadRow({ node, dimmed, current, onOpen, onQuickLook }: {
  node: MapNode; dimmed: boolean; current: boolean; onOpen: ReadableMapProps['onOpen']; onQuickLook: ReadableMapProps['onQuickLook'];
}) {
  useI18n();
  const thread = node.thread!;
  const at = thread.lastActiveAt ?? thread.createdAt;
  const metadata = [thread.model, thread.priceEstimate ? formatCompactUsd(thread.priceEstimate.totalUsd) : null,
    at ? relativeCache(at) : null].filter(Boolean).join(' · ');
  return <div className="thread-map-list-row" data-map-id={node.id} data-waiting={isWaiting(thread) || undefined}
    data-current={current || undefined} data-dimmed={dimmed || undefined}>
    <a className="thread-map-tile-link" href={thread.href} aria-label={[thread.title, navigationStatusLabel(status(node)), metadata].filter(Boolean).join(' · ')} aria-current={current ? 'page' : undefined} title={thread.title} onClick={onOpen(thread)} />
    <span className="thread-map-list-agent-slot"><AgentChip agent={thread.agent} /></span>
    <span className="thread-map-list-status-slot"><StatusMark status={status(node)} /></span>
    <b className="thread-map-list-title">{thread.title}</b>
    <span className="thread-map-list-row-meta" title={metadata}>{metadata}</span>
    {onQuickLook && <button type="button" className="thread-map-list-info" onClick={() => onQuickLook(thread.key)} aria-label={translate('workbench.threadMapQuickLook', { title: thread.title })}>ⓘ</button>}
  </div>;
}, (a, b) => a.node.thread === b.node.thread && a.dimmed === b.dimmed && a.current === b.current && a.onQuickLook === b.onQuickLook && a.onOpen === b.onOpen);

/** Page-only renderer. Each level budgets readable rectangles before mounting
 * children. Dialogs retain the original all-thread treemap renderer. */
export function ReadableMap(props: ReadableMapProps) {
  useI18n();
  const { current, bounds, hours, currentKey, frozen, version, query, matches, extras, cached, navigate, expand, onOpen, onQuickLook, hover } = props;
  const cache = useRef(new ReadableSelection());
  const previousVersion = useRef(version);
  if (previousVersion.current !== version) { cache.current.clear(); previousVersion.current = version; }
  const [listFor, setListFor] = useState<string | null>(null);
  const targets: SpatialTarget[] = [];
  const addTarget = (id: string, rect: MapRect, offset: { x: number; y: number }) => targets.push({ id, rect: { ...rect, x: rect.x + offset.x, y: rect.y + offset.y } });
  const currentRef = useRef(props); currentRef.current = props;
  const rowOpen = useRef<ReadableMapProps['onOpen']>(thread => event => currentRef.current.onOpen(thread)(event));
  const dim = (node: MapNode) => Boolean(query.trim()) && !matches(node);

  const list = (node: MapNode, rect: MapRect, offset: { x: number; y: number }) => {
    const items = cache.current.ordered(`${version}:${node.id}`, node.children.filter(child => child.kind !== 'compressed'));
    const older = node.children.filter(child => child.kind === 'compressed');
    const threads = items.every(child => child.kind === 'thread');
    return <section key={`list:${node.id}`} className="thread-map-readable-list" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} aria-label={translate('workbench.threadMapAllThreads')}>
      <div className="thread-map-list-heading"><Layers aria-hidden="true" /><b>{translate(threads ? 'workbench.threadMapAllThreads' : 'workbench.threadMapGoTo')}</b><span>{items.length}</span></div>
      <MapScrollList label={translate(threads ? 'workbench.threadMapAllThreads' : 'workbench.threadMapGoTo')}>
        {threads ? (() => {
          const groups = [
            { id: 'waiting', label: translate('workbench.waitingForYou'), items: [] as MapNode[] },
            { id: 'running', label: translate('workbench.running'), items: [] as MapNode[] },
            { id: 'unread', label: translate('workbench.threadMapListUnread'), items: [] as MapNode[] },
            { id: 'other', label: translate('workbench.threadMapListOther'), items: [] as MapNode[] },
          ];
          for (const item of items) {
            const rank = cache.current.rank(`${version}:${node.id}`, item);
            groups[rank < 2 ? rank : rank < 4 ? 2 : 3]!.items.push(item);
          }
          let y = rect.y + 34;
          return groups.filter(group => group.items.length > 0).map(group => {
            y += 24;
            return <div key={group.id} className="thread-map-list-status-group" data-list-group={group.id} role="group" aria-label={group.label}>
              <h3 className="thread-map-list-status-heading"><span>{group.label}</span><small>{group.items.length}</small></h3>
              {group.items.map(item => {
                addTarget(item.id, { x: rect.x + 8, y, width: rect.width - 16, height: 40 }, offset); y += 40;
                return <ThreadRow key={item.id} node={item} dimmed={dim(item)} current={item.thread!.key === currentKey} onOpen={rowOpen.current} onQuickLook={onQuickLook} />;
              })}
            </div>;
          });
        })() : items.map((item, index) => {
          addTarget(item.id, { x: rect.x + 10, y: rect.y + 34 + index * 68, width: rect.width - 20, height: 64 }, offset);
          return <button key={item.id} type="button" className="thread-map-list-group" data-map-id={item.id} onClick={() => navigate(item)}>
            {item.kind === 'device' ? <Monitor aria-hidden="true" /> : <Folder aria-hidden="true" />}<b>{item.label}</b><span>{translate('workbench.threadMapThreads', { count: item.threads })}</span><ChevronRight aria-hidden="true" />
          </button>;
        })}
        {older.map(item => <button key={item.id} type="button" className="thread-map-list-older" onClick={() => expand(item)}>{item.label}<ChevronRight aria-hidden="true" /></button>)}
      </MapScrollList>
    </section>;
  };

  const render = (parent: MapNode, area: MapRect, depth: number, offset: { x: number; y: number }): ReactNode[] => {
    const kind = kindFor(parent);
    const plan = cache.current.select(`${version}:${parent.id}`, parent.children, area, kind, frozen);
    // Once a workspace is focused, scrolling is more useful than another layer
    // of compression. Scope still applies; older items have one expansion row.
    if (parent.id === current.id && (listFor === current.id || kind === 'threads' && plan.overflow && plan.overflow.nodes.some(node => !parent.children.find(child => child.kind === 'compressed')?.hiddenNodes?.includes(node)))) {
      return [list(parent, area, offset)];
    }
    const result = plan.entries.map(({ node, rect }) => {
      const box = inset(rect);
      if (node.thread) {
        addTarget(node.id, box, offset);
        return <ThreadTile key={node.id} node={node} box={box} hours={hours} current={node.thread.key === currentKey} readable
          onOpen={onOpen(node.thread)} onQuickLook={onQuickLook} hover={hover(() => [node.label])} dimmed={dim(node)}
          onShowChildren={node.thread.children?.length ? () => navigate(node) : undefined} />;
      }
      const extra = node.device ? extras?.[node.device.id] : undefined;
      const isDevice = node.kind === 'device';
      const header = isDevice ? 36 : 28;
      const inner = { x: 3, y: header, width: Math.max(0, box.width - 6), height: Math.max(0, box.height - header - 3) };
      const unlisted = isDevice && node.device!.state !== 'ready' && !node.children.length;
      return <section key={node.id} className="thread-map-section thread-map-readable-section" data-map-id={node.id} data-kind={node.kind} data-depth={depth}
        data-cached={cached.has(node.device?.id ?? '') || undefined} data-live={node.running > 0 || undefined} data-dimmed={dim(node) || undefined}
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
        <div className="thread-map-section-header" style={{ height: header }} title={isDevice ? extra?.metrics : undefined}>
          <button type="button" className="thread-map-section-head" onClick={event => navigate(node, event.currentTarget.closest('section'))} {...hover([node.label])}>
            {isDevice ? <DeviceStateMark /> : <Folder aria-hidden="true" />}<span className="thread-map-section-label">{node.label}</span>
            {isDevice && extra && box.width > 320 && <DeviceReadings extra={extra} />}
            <span className="thread-map-section-count">{node.running > 0 && <i className="thread-map-running-dot" />}{node.threads}</span>
            {box.width > 220 && node.usd > 0 && <span className="thread-map-section-usd">{formatCompactUsd(node.usd)}</span>}
          </button>
          {isDevice && extra?.menuItems?.length ? <DeviceMenu device={node.device!} items={extra.menuItems} /> : null}
          {isDevice && extra?.metrics && <span className="thread-map-metrics">{extra.metrics}</span>}
        </div>
        {unlisted ? <button type="button" className="thread-map-unlisted" onClick={() => props.onRetry?.(node.device!.id)}>{translate(node.device!.state === 'loading' ? 'workbench.threadMapLoading' : 'workbench.threadMapRetry')}</button>
          : <div className="thread-map-preview">{render(node, inner, depth + 1, { x: offset.x + box.x, y: offset.y + box.y })}</div>}
      </section>;
    });
    if (plan.overflow) {
      const overflow = plan.overflow, box = inset(overflow.rect), label = overflowLabel(overflow);
      const id = `overflow:${parent.id}`;
      addTarget(id, box, offset);
      const zoom = () => {
        if (parent.id !== current.id) navigate(parent);
        else {
          for (const child of parent.children) if (child.kind === 'compressed') expand(child);
          setListFor(parent.id);
        }
      };
      const header = <>
        <span className="thread-map-overflow-title"><Layers aria-hidden="true" /><b>{label}</b><ArrowUpRight aria-hidden="true" /></span>
        {overflow.older > 0 && <small>{translate('workbench.threadMapEarlier', { count: overflow.older })}</small>}
        <OverflowMarks overflow={overflow} />
      </>;
      const roomy = box.width >= 160 && box.height >= 180;
      result.push(roomy ? <section key={id} data-map-id={id} className="thread-map-overflow thread-map-overflow-with-list"
        data-dimmed={Boolean(query.trim()) && !overflow.nodes.some(matches) || undefined}
        data-important={overflow.waiting + overflow.running + overflow.failed + overflow.unread > 0 || undefined}
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }} onClick={event => {
          if (!(event.target as Element).closest('button, a, .thread-map-scroll-track')) zoom();
        }}>
        <button type="button" className="thread-map-overflow-open" onClick={zoom} aria-label={label} {...hover([label])}>{header}</button>
        <MapScrollList label={label}>
          <div className="thread-map-overflow-items" onKeyDown={event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a, button')];
            const next = controls[controls.indexOf(document.activeElement as HTMLElement) + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) { event.preventDefault(); event.stopPropagation(); next.focus(); }
          }}>
            {cache.current.ordered(`${version}:${parent.id}`, overflow.nodes).map(item => item.thread
              ? <a key={item.id} className="thread-map-overflow-row" data-map-id={item.id} href={item.thread.href} onClick={onOpen(item.thread)} {...hover([item.label])}>
                <StatusMark status={status(item)} /><span>{item.label}</span>{item.usd > 0 && <small>{formatCompactUsd(item.usd)}</small>}
              </a>
              : <button key={item.id} type="button" className="thread-map-overflow-row" data-map-id={item.id} onClick={() => {
                for (const child of parent.children) if (child.kind === 'compressed' && child.hiddenNodes?.some(hidden => hidden.id === item.id)) expand(child);
                navigate(item);
              }} {...hover([item.label])}>
                {item.kind === 'device' ? <Monitor aria-hidden="true" /> : <Folder aria-hidden="true" />}<span>{item.label}</span><small>{item.threads}</small><ChevronRight aria-hidden="true" />
              </button>)}
          </div>
        </MapScrollList>
      </section> : <button key={id} data-map-id={id} type="button" className="thread-map-overflow"
        data-dimmed={Boolean(query.trim()) && !overflow.nodes.some(matches) || undefined}
        data-important={overflow.waiting + overflow.running + overflow.failed + overflow.unread > 0 || undefined}
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }} onClick={zoom} aria-label={label} {...hover([label, ...overflow.recent])}>
        {header}
        {box.height >= 110 && <span className="thread-map-overflow-preview">{overflow.recent.slice(0, Math.min(3, Math.floor((box.height - 70) / 17))).map((title, i) => <span key={i}>{title}</span>)}</span>}
      </button>);

    }
    return result;
  };
  const content = bounds.width > 0 && bounds.height > 0 ? render(current, bounds, 0, { x: 0, y: 0 }) : null;
  props.register(targets);
  return <>{content}</>;
}
