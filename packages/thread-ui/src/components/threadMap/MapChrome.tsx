import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { getLocale, translate } from '../../i18n';
import { MapScrollList } from './MapScrollList';
import { StatusMark } from '../StatusMark';
import { useModalFocus } from '../menu/useModalFocus';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { formatCompactUsd } from '../timeline/tokenFormatting';
import type { ThreadMapDevice } from './model';
import { orderAttention, type MapAttention, type MapDeviceExtras, type ThreadMapProps } from './types';

// The host's DeviceStateMark lives in the admin app. This shared rendition uses
// its exact connection shapes (ui-principles §6), rather than a thread status.
export function DeviceStateMark({ offline = false }: { offline?: boolean }) {
  return <span className="thread-map-device-state" data-offline={offline || undefined} role="img"
    aria-label={translate(offline ? 'workbench.threadMapOffline' : 'workbench.threadMapOnline')} />;
}

export function relativeCache(at: string) {
  const ms = Date.parse(at) - Date.now();
  if (!Number.isFinite(ms)) return '';
  const unit = Math.abs(ms) >= 86_400_000 ? 'day' : Math.abs(ms) >= 3_600_000 ? 'hour' : 'minute';
  return new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' }).format(Math.round(ms / (unit === 'day' ? 86_400_000 : unit === 'hour' ? 3_600_000 : 60_000)), unit);
}

export function AttentionStrip({ items, onOpen, onRequestDecision, responsive = false }: {
  responsive?: boolean;
  items: readonly MapAttention[];
  onOpen: (key: string) => void;
  onRequestDecision: ThreadMapProps['onRequestDecision'];
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = orderAttention(items);
  if (responsive) return <ResponsiveAttention items={ordered} onOpen={onOpen} onRequestDecision={onRequestDecision} />;
  return <div className="thread-map-attention-wrap" data-visible={items.length > 0 || undefined}>
    <div className="thread-map-attention" role="region" aria-label={translate('workbench.threadMapAttention')}>
      {ordered.slice(0, expanded ? undefined : 6).map(item => <AttentionCard key={item.key} item={item} onOpen={onOpen} onRequestDecision={onRequestDecision} />)}
      {!expanded && ordered.length > 6 && <button type="button" className="thread-map-attention-more" onClick={() => setExpanded(true)}>
        {translate('workbench.threadMapMoreAttention', { count: ordered.length - 6 })}
      </button>}
    </div>
  </div>;
}

function AttentionCard({ item, onOpen, onRequestDecision }: { item: MapAttention; onOpen: (key: string) => void; onRequestDecision: ThreadMapProps['onRequestDecision'] }) {
  return <article className="thread-map-attention-card" data-kind={item.kind}>
    <button className="thread-map-attention-open" type="button" onClick={() => onOpen(item.key)} title={item.title}>
      <StatusMark status={item.kind === 'approval' || item.kind === 'input' ? 'waiting' : item.kind === 'failed' ? 'failed' : 'unread'} />
      <span><b>{item.title}</b><small>{item.device} · {item.workspace}</small><small>{item.summary ?? translate(item.kind === 'input' || item.kind === 'approval' ? 'workbench.waitingForYou' : item.kind === 'failed' ? 'workbench.failed' : 'workbench.completedUnread')}</small></span>
    </button>
    {item.kind === 'approval' && item.requestId && onRequestDecision && <div className="thread-map-decisions">
      <button type="button" onClick={() => onRequestDecision(item.key, item.requestId!, 'approve')}>{translate('workbench.threadMapApprove')}</button>
      <button type="button" onClick={() => onRequestDecision(item.key, item.requestId!, 'deny')}>{translate('workbench.threadMapDeny')}</button>
    </div>}
  </article>;
}

function ResponsiveAttention({ items, onOpen, onRequestDecision }: { items: readonly MapAttention[]; onOpen: (key: string) => void; onRequestDecision: ThreadMapProps['onRequestDecision'] }) {
  const strip = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const shown = Math.min(capacity, items.length), hidden = items.slice(shown);
  useEffect(() => { if (!hidden.length) setAnchor(null); }, [hidden.length]);
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const width = Math.max(0, el.clientWidth - 32);
      const all = Math.floor((width + 8) / 208);
      setCapacity(Math.min(6, items.length <= all ? all : Math.max(0, Math.floor((width - 80) / 208))));
    };
    measure(); const resize = new ResizeObserver(measure); resize.observe(el);
    return () => resize.disconnect();
  }, [items.length]);
  const close = (restore = false) => { setAnchor(null); if (restore) trigger.current?.focus(); };
  useMenuKeyboard(menu, Boolean(anchor), close);
  useEffect(() => {
    if (!anchor) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setAnchor(null); };
    const moved = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      setAnchor(null);
    };
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', moved); window.addEventListener('scroll', moved, true);
    window.visualViewport?.addEventListener('resize', moved); window.visualViewport?.addEventListener('scroll', moved);
    return () => {
      document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', moved); window.removeEventListener('scroll', moved, true);
      window.visualViewport?.removeEventListener('resize', moved); window.visualViewport?.removeEventListener('scroll', moved);
    };
  }, [anchor]);
  return <div className="thread-map-attention-wrap" data-visible={items.length > 0 || undefined}>
    <div ref={strip} className="thread-map-attention" data-responsive role="region" aria-label={translate('workbench.threadMapAttention')}>
      {items.slice(0, shown).map(item => <AttentionCard key={item.key} item={item} onOpen={onOpen} onRequestDecision={onRequestDecision} />)}
      {hidden.length > 0 && <button ref={trigger} type="button" className="thread-map-attention-more" aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={() => {
        if (anchor) { close(); return; }
        const box = trigger.current!.getBoundingClientRect();
        setAnchor({ left: Math.max(8, Math.min(box.left, window.innerWidth - 344)), top: Math.min(box.bottom + 5, window.innerHeight - 180) });
      }}>{translate('workbench.threadMapMoreAttention', { count: hidden.length })}</button>}
    </div>
    {anchor && hidden.length > 0 && createPortal(<div ref={menu} role="menu" aria-label={translate('workbench.threadMapAttention')}
      data-theme-effective={document.documentElement.dataset.themeEffective} className="thread-graph-dialog thread-map-attention-menu" style={{ position: 'fixed', ...anchor, height: Math.min(420, hidden.length * 72 + 10, window.innerHeight - anchor.top - 12) }}>
      <MapScrollList label={translate('workbench.threadMapAttention')}>
        {hidden.map(item => <button key={item.key} type="button" role="menuitem" onClick={() => { close(true); onOpen(item.key); }}>
          <StatusMark status={item.kind === 'approval' || item.kind === 'input' ? 'waiting' : item.kind === 'failed' ? 'failed' : 'unread'} />
          <span><b>{item.title}</b><small>{item.device} · {item.workspace}</small><small>{item.summary}</small></span>
        </button>)}
      </MapScrollList>
    </div>, document.body)}
  </div>;
}

export function DeviceMenu({ device, items }: { device: ThreadMapDevice; items: NonNullable<MapDeviceExtras['menuItems']> }) {
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const close = (restore: boolean) => { setAnchor(null); if (restore) trigger.current?.focus(); };
  useMenuKeyboard(menu, Boolean(anchor), close);
  useEffect(() => {
    if (!anchor) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setAnchor(null);
    };
    const moved = () => setAnchor(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', moved);
    window.addEventListener('scroll', moved, true);
    window.visualViewport?.addEventListener('resize', moved);
    window.visualViewport?.addEventListener('scroll', moved);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', moved);
      window.removeEventListener('scroll', moved, true);
      window.visualViewport?.removeEventListener('resize', moved);
      window.visualViewport?.removeEventListener('scroll', moved);
    };
  }, [anchor]);
  return <><button ref={trigger} type="button" className="thread-map-device-menu-button" aria-haspopup="menu" aria-expanded={Boolean(anchor)}
    aria-label={translate('workbench.threadMapDeviceMenu', { name: device.name })} onClick={() => {
      if (anchor) { close(false); return; }
      const box = trigger.current!.getBoundingClientRect();
      setAnchor({ top: Math.max(8, Math.min(box.bottom + 4, window.innerHeight - items.length * 36 - 16)), left: Math.max(8, Math.min(box.right - 220, window.innerWidth - 228)) });
    }}><MoreVertical aria-hidden="true" /></button>
    {anchor && createPortal(<div ref={menu} data-theme-effective={document.documentElement.dataset.themeEffective} className="thread-graph-dialog thread-map-device-menu" role="menu"
      aria-label={device.name} style={{ position: 'fixed', ...anchor }}>
      {items.map(item => <button key={item.id} role="menuitem" type="button" disabled={item.disabled}
        onClick={() => { close(true); item.onSelect(); }}>{item.label}</button>)}
    </div>, document.body)}
  </>;
}

export function DeviceReadings({ extra }: { extra: MapDeviceExtras }) {
  return <span className="thread-map-device-readings">
    {extra.syncing && <i className="thread-map-sync" role="img" aria-label={translate('workbench.threadMapSyncing')} />}
    {extra.latencyMs != null && <span>{Math.round(extra.latencyMs)} ms</span>}
    {extra.runtimeVersion && <span>v{extra.runtimeVersion.replace(/^v/, '')}</span>}
    {extra.updateAvailable && <span className="thread-map-update">{translate('workbench.threadMapUpdate')}</span>}
    {extra.runningCount != null && extra.runningCount > 0 && <span>{translate('workbench.threadMapRunningCount', { count: extra.runningCount })}</span>}
    {extra.waitingCount != null && extra.waitingCount > 0 && <span className="thread-map-waiting-count" aria-label={translate('workbench.threadMapWaitingCount', { count: extra.waitingCount })}><StatusMark status="waiting" />{extra.waitingCount}</span>}
    {extra.todayCostUsd != null && <span>{translate('workbench.threadMapTodayCost', { usd: formatCompactUsd(extra.todayCostUsd) })}</span>}
  </span>;
}

/** Narrow page maps retain the legend in an anchored, keyboard-accessible window. */
export function MapLegend({ compact, children }: { compact: boolean; children: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const close = () => setAnchor(null);
  useModalFocus(dialog, Boolean(anchor), close);
  useEffect(() => {
    if (!anchor) return;
    const outside = (event: PointerEvent) => {
      if (!dialog.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [anchor]);
  if (!compact) return <div className="thread-map-legend">{children}</div>;
  return <div className="thread-map-legend-footer"><button type="button" ref={trigger} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={() => {
    if (anchor) { close(); return; }
    const box = trigger.current!.getBoundingClientRect();
    setAnchor({ left: Math.max(8, Math.min(box.left, window.innerWidth - 368)), bottom: window.innerHeight - box.top + 6 });
  }}>{translate('workbench.threadMapLegend')}</button>
    {anchor && createPortal(<div ref={dialog} role="dialog" aria-label={translate('workbench.threadMapLegend')} tabIndex={-1}
      data-theme-effective={document.documentElement.dataset.themeEffective} className="thread-graph-dialog thread-map thread-map-legend-popover" style={{ position: 'fixed', ...anchor }}>
      <div className="thread-map-legend">{children}</div>
      <button type="button" onClick={close}>{translate('workbench.close')}</button>
    </div>, document.body)}
  </div>;
}
