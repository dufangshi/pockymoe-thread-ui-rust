import type {
  ContextInspectionCategoryDto,
  ContextInspectionDetailDto,
  ContextInspectionGroupItemDto,
  ContextInspectionSnapshotDto,
  ThreadContextInspectionDto,
  ThreadContextUsageDto,
} from '@pockymoe/shared';
import { ChevronRight, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { getLocale, translate, useI18n } from '../../i18n';
import { ErrorMark } from '../copy/ErrorMark';
import { MiddleName } from '../copy/MiddleName';
import { PathChip } from '../copy/PathChip';
import { useModalFocus } from '../menu/useModalFocus';
import { shellThemeProps } from '../themeHooks';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import {
  arrangeContextCategories,
  contextAge,
  contextCategoryItems,
  contextPercent,
  contextTone,
  currentReading,
  formatContextPercent,
  formatContextShare,
  formatContextTokens,
  preferredSnapshot,
  readingFromSnapshot,
  readingFromUsage,
  segmentOf,
  totalMovedOn,
  type ContextReading,
  type ContextSegment,
} from './contextInspectionModel';

/** How the host reads a thread's context analysis, on the thread's own device. */
export interface ThreadContextInspector {
  load: (options: { detail: ContextInspectionDetailDto; refresh?: boolean }) => Promise<ThreadContextInspectionDto>;
  /** Opens the setting that turns the analysis on; absent where it cannot be reached. */
  openSettings?: (() => void) | undefined;
}

type LoadState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  response: ThreadContextInspectionDto | null;
  error: string | null;
};

const PHONE = '(max-width: 639px)';
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia?.(PHONE);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
const useIsPhone = () => useSyncExternalStore(subscribePhone, () => Boolean(window.matchMedia?.(PHONE).matches), () => false);

function ContextBar({ segments, reservedEnd = [], window, tick, mini = false, label }: {
  segments: ContextSegment[];
  /** Reserved at the far end of the window (the auto-compact buffer). */
  reservedEnd?: ContextSegment[];
  window: number;
  tick?: number | null;
  mini?: boolean;
  label?: string;
}) {
  const shown = segments.filter((segment) => segment.tokens > 0);
  const reserved = reservedEnd.filter((segment) => segment.tokens > 0);
  return (
    <span
      className={`thread-context-bar${mini ? ' is-mini' : ''}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {shown.map((segment) => (
        <span key={segment.id} className="thread-context-segment" data-slot={segment.slot}
          style={{ width: `${contextPercent(segment.tokens, window)}%` }}
          {...(mini ? {} : { title: `${segment.label} ${formatContextTokens(segment.tokens)}` })} />
      ))}
      {reserved.map((segment) => (
        <span key={segment.id} className="thread-context-segment is-reserved"
          style={{ width: `${contextPercent(segment.tokens, window)}%` }}
          {...(mini ? {} : { title: `${segment.label} ${formatContextTokens(segment.tokens)}` })} />
      ))}
      {tick != null ? <span className="thread-context-tick" style={{ left: `${contextPercent(tick, window)}%` }} /> : null}
    </span>
  );
}

const approximate = (estimated: boolean) => (estimated ? <span className="thread-context-approx" aria-label={translate('chat.contextEstimatedValue')}>≈</span> : null);

function ContextItemRow({ item, estimated }: { item: ContextInspectionGroupItemDto; estimated: boolean }) {
  const pathIsName = item.path === item.name;
  return (
    <li className="thread-context-item">
      <span className="thread-context-item-name">
        {pathIsName && item.path
          ? <PathChip path={item.path} />
          : <span title={item.name}><MiddleName name={item.name} /></span>}
        {!pathIsName && item.path ? <PathChip path={item.path} /> : null}
        {item.source ? <span className="thread-context-item-source">{item.source}</span> : null}
        {item.loaded === false ? <span className="thread-context-item-source">{translate('chat.contextItemNotLoaded')}</span> : null}
      </span>
      <span className="thread-context-tokens">{approximate(estimated)}{formatContextTokens(item.tokens)}</span>
    </li>
  );
}

function ContextRow({ id, label, tokens, share, swatch, estimated, items }: {
  id: string;
  label: string;
  tokens: number;
  /** The share of the window. Outside the window there is none. */
  share?: string | undefined;
  swatch: { slot?: number; kind: ContextInspectionCategoryDto['kind'] };
  estimated: boolean;
  items?: ContextInspectionGroupItemDto[] | undefined;
}) {
  useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const content = (
    <>
      {items?.length
        ? <ChevronRight aria-hidden="true" className="thread-context-chevron" data-open={open || undefined} />
        : <span aria-hidden="true" className="thread-context-chevron" />}
      <span aria-hidden="true" className="thread-context-swatch" data-kind={swatch.kind} data-slot={swatch.slot} />
      <span className="thread-context-row-label">
        <span className="thread-context-row-name">{label}</span>
        {items?.length ? <span className="thread-context-row-count">{items.length}</span> : null}
      </span>
      <span className="thread-context-tokens">{approximate(estimated)}{formatContextTokens(tokens)}</span>
      {share !== undefined ? <span className="thread-context-share">{share}</span> : null}
    </>
  );
  return (
    <li data-context-category={id}>
      {items?.length ? (
        <button type="button" className="thread-context-row is-expandable" aria-expanded={open} aria-controls={listId}
          onClick={() => setOpen((value) => !value)}>
          {content}
        </button>
      ) : <div className="thread-context-row">{content}</div>}
      {items?.length && open ? (
        <ul id={listId} className="thread-context-items">
          {items.map((item, index) => <ContextItemRow key={`${item.name}:${index}`} item={item} estimated={estimated} />)}
        </ul>
      ) : null}
    </li>
  );
}

function ContextBreakdown({ snapshot }: { snapshot: ContextInspectionSnapshotDto }) {
  useI18n();
  const { used, buffer, free, deferred } = arrangeContextCategories(snapshot);
  const { items, rest } = contextCategoryItems(snapshot);
  const window = snapshot.windowTokens;
  const row = (entry: ContextInspectionCategoryDto) => {
    const segment = segmentOf(entry);
    return (
      <ContextRow key={entry.id} id={entry.id} label={segment.label} tokens={segment.tokens}
        share={entry.kind === 'deferred' ? undefined : formatContextShare(segment.tokens, window)}
        swatch={{ slot: segment.slot, kind: entry.kind }}
        // The free space and the reserve are not counted, whatever the categories' precision.
        estimated={(entry.kind === 'used' || entry.kind === 'deferred') && (entry.precision ?? snapshot.precision) === 'estimated'}
        items={items.get(entry.id)} />
    );
  };
  return (
    <>
      <ul className="thread-context-rows">
        {used.map(row)}
        {buffer.map(row)}
        {free.map(row)}
      </ul>
      {used.some((entry) => entry.id === 'unattributed')
        ? <p className="thread-context-footnote">{translate('chat.contextUnattributedNote')}</p> : null}
      {deferred.length ? (
        <section className="thread-context-outside">
          <h4 className="thread-context-heading">{translate('chat.contextOutsideWindow')}</h4>
          <ul className="thread-context-rows">{deferred.map(row)}</ul>
        </section>
      ) : null}
      {rest.length ? (
        <section className="thread-context-outside">
          <h4 className="thread-context-heading">{translate('chat.contextOtherDetails')}</h4>
          <ul className="thread-context-rows">
            {rest.map((group) => (
              <ContextRow key={group.id} id={group.id} label={group.label} swatch={{ kind: 'deferred' }}
                tokens={group.items.reduce((sum, item) => sum + item.tokens, 0)}
                estimated={snapshot.precision === 'estimated'} items={group.items} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function sourceLabel(snapshot: ContextInspectionSnapshotDto | null) {
  if (snapshot?.source === 'claudeFull') return translate('chat.contextSourceClaudeFull');
  if (snapshot?.source === 'claudeSummary') return translate('chat.contextSourceClaudeSummary');
  if (snapshot?.source === 'codexTrace') return translate('chat.contextSourceCodexTrace');
  return translate('chat.contextSourceReported');
}

/** Why there are no categories to show. The total above stays either way. */
function ContextNote({ state, inspector, hasSnapshot, onRetry }: {
  state: LoadState;
  inspector: ThreadContextInspector | null | undefined;
  hasSnapshot: boolean;
  onRetry: () => void;
}) {
  useI18n();
  const { response, status, error } = state;
  if (status === 'failed') {
    return (
      <p className="thread-context-note" data-context-note="failed">
        <span>{translate(hasSnapshot ? 'chat.contextRefreshFailed' : 'chat.contextLoadFailed')}</span>
        <ErrorMark message={error ?? translate('chat.contextLoadFailed')} onRetry={onRetry} />
      </p>
    );
  }
  if (!inspector) return null;
  if (!response) {
    return status === 'loading' ? (
      <p className="thread-context-note" data-context-note="loading" role="status">
        <Loader2 aria-hidden="true" className="thread-context-spinner animate-spin" />
        <span>{translate('chat.contextLoading')}</span>
      </p>
    ) : null;
  }
  const reason = response.reason ? <ErrorMark kind="unavailable" announce={false} message={response.reason} /> : null;
  if (!response.enabled || response.availability === 'disabled') {
    return (
      <div className="thread-context-note" data-context-note="disabled">
        <span>{translate('chat.contextDisabledNote')}</span>
        {inspector.openSettings ? (
          <button type="button" className="thread-context-link" onClick={inspector.openSettings}>{translate('chat.contextOpenSettings')}</button>
        ) : null}
      </div>
    );
  }
  if (!response.supported) {
    return <p className="thread-context-note" data-context-note="unsupported"><span>{translate('chat.contextUnsupportedNote')}</span>{reason}</p>;
  }
  if (!hasSnapshot) {
    return <p className="thread-context-note" data-context-note="waiting"><span>{translate('chat.contextWaitingNote')}</span>{reason}</p>;
  }
  return response.availability === 'unavailable' && reason
    ? <p className="thread-context-note" data-context-note="unavailable"><span>{translate('chat.contextUnavailableNote')}</span>{reason}</p>
    : null;
}

function ContextPanelSurface({ phone, label, subtitle, trigger, onClose, footer, expandableItems, layoutKey, children }: {
  phone: boolean;
  label: string;
  subtitle?: string | null | undefined;
  trigger: HTMLElement | null;
  onClose: () => void;
  footer: ReactNode;
  /** How many listed items its rows can open. */
  expandableItems: number;
  /** Changes when what the panel shows does. */
  layoutKey: string;
  children: ReactNode;
}) {
  useI18n();
  const root = useRef<HTMLDivElement>(null);
  useModalFocus(root, true, onClose);
  // A window above its trigger grows upward, which would pull an opening row out
  // from under the pointer (docs/ui-principles.md §5). So it holds the room its
  // rows may need up front; past that they scroll inside. A panel with nothing to
  // open takes only what it shows.
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    node.style.height = 'auto';
    const natural = node.scrollHeight;
    if (natural > 0 && expandableItems > 0) node.style.height = `${natural + Math.min(expandableItems * (phone ? 36 : 22), phone ? 288 : 176)}px`;
  }, [expandableItems, layoutKey, phone]);
  const panel = (
    <div ref={root} className="thread-context-panel thread-context-palette" tabIndex={-1}>
      <header className="thread-context-header">
        <span className="thread-context-title-block">
          <h3 className="thread-context-title">{label}</h3>
          {subtitle ? <span className="thread-context-subtitle">{subtitle}</span> : null}
        </span>
        {phone ? (
          <button type="button" className="thread-context-close" aria-label={translate('chat.contextClose')} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="thread-context-body">{children}</div>
      {footer ? <footer className="thread-context-footer">{footer}</footer> : null}
    </div>
  );
  if (!phone) {
    return (
      <ComposerMenuSurface role="dialog" aria-label={label} align="end" anchorSelector=".composer-model-control" className="thread-context-surface">
        {panel}
      </ComposerMenuSurface>
    );
  }
  // Rendered at the page's root (docs/ui-principles.md §4). The hidden marker keeps
  // what the composer does while one of its menus is open: it stays unfolded and
  // this control keeps its place to return focus to.
  const theme = shellThemeProps(trigger);
  return (
    <>
      <span hidden data-composer-menu-surface="true" />
      {createPortal(
        <div className={`thread-ui-shell thread-context-sheet-layer ${theme.themeClass}`.trim()} data-composer-menu-surface="true"
          data-theme-effective={theme['data-theme-effective']} data-theme-mode={theme['data-theme-mode']}>
          <button type="button" className="thread-context-scrim" aria-label={translate('chat.contextClose')} onClick={onClose} />
          <section className="thread-context-surface is-sheet" role="dialog" aria-modal="true" aria-label={label}>
            {panel}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

export function ComposerContextControl({
  open,
  contextUsage,
  inspector,
  modelLabel,
  agent,
  onCompact,
  compactBusy = false,
  compactDisabled = false,
  onToggle,
  onClose,
}: {
  open: boolean;
  contextUsage: ThreadContextUsageDto | null | undefined;
  inspector?: ThreadContextInspector | null | undefined;
  modelLabel?: string | null | undefined;
  agent?: string | undefined;
  onCompact?: (() => Promise<void> | void) | undefined;
  compactBusy?: boolean | undefined;
  compactDisabled?: boolean | undefined;
  onToggle: () => void;
  onClose: () => void;
}) {
  useI18n();
  const phone = useIsPhone();
  const trigger = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<LoadState>({ status: 'idle', response: null, error: null });
  const [lastDetail, setLastDetail] = useState<{ detail: ContextInspectionDetailDto; refresh: boolean }>({ detail: 'summary', refresh: false });
  const [now, setNow] = useState(() => Date.now());
  const sequence = useRef(0);
  const [compacting, setCompacting] = useState(false);
  const compactInFlight = useRef(false);
  const [compactError, setCompactError] = useState<string | null>(null);
  const inspectionProvider = agent ?? contextUsage?.details?.provider;

  const load = useCallback((detail: ContextInspectionDetailDto, refresh: boolean) => {
    if (!inspector) return;
    const ticket = ++sequence.current;
    setLastDetail({ detail, refresh });
    setState((current) => ({ ...current, status: 'loading', error: null }));
    inspector.load({ detail, ...(refresh ? { refresh } : {}) }).then((response) => {
      if (ticket === sequence.current) setState({ status: 'ready', response, error: null });
    }).catch((cause: unknown) => {
      if (ticket !== sequence.current) return;
      setState((current) => ({ ...current, status: 'failed', error: cause instanceof Error ? cause.message : String(cause) }));
    });
  }, [inspector]);

  // Another thread or device: nothing read for the last one applies.
  useEffect(() => {
    sequence.current += 1;
    setState({ status: 'idle', response: null, error: null });
  }, [inspector]);

  // Opening Claude's detail panel requests its full reading; the cached summary
  // remains visible while it arrives. There is no separate counting action.
  useEffect(() => {
    if (!open) return;
    const full = inspectionProvider === 'claude';
    load(full ? 'full' : 'summary', full);
  }, [open, load, inspectionProvider]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [open, contextUsage?.updatedAt, state.response]);

  // A compaction finished: the categories on screen describe what it removed.
  const wasCompacting = useRef(compactBusy);
  useEffect(() => {
    if (open && wasCompacting.current && !compactBusy) load(inspectionProvider === 'claude' ? 'full' : 'summary', true);
    wasCompacting.current = compactBusy;
  }, [compactBusy, open, load, inspectionProvider]);

  const disabled = state.response ? !state.response.enabled || state.response.availability === 'disabled' : false;
  const snapshot = disabled ? null : preferredSnapshot(state.response?.snapshot, contextUsage?.details);
  const base = readingFromUsage(contextUsage);
  const analyzed = readingFromSnapshot(snapshot);
  const reading: ContextReading | null = currentReading(analyzed, base);
  const movedOn = totalMovedOn(analyzed, base);
  const arranged = snapshot && analyzed ? arrangeContextCategories(snapshot) : null;
  const usedSegments = arranged?.used.map(segmentOf) ?? [];

  const percentText = reading ? formatContextPercent(reading.used, reading.window) : '—';
  const tone = reading ? contextTone(reading.used, reading.window) : 'normal';
  const usage = reading
    ? translate('chat.contextMeterLabel', { percent: percentText, used: formatContextTokens(reading.used), total: formatContextTokens(reading.window) })
    : translate('chat.contextMeterEmpty');
  const miniTotal = usedSegments.reduce((sum, segment) => sum + segment.tokens, 0);

  const estimatedTotal = snapshot?.source === 'codexTrace' && !movedOn;
  const age = contextAge(reading?.updatedAt, now);
  const stale = Boolean(snapshot?.stale) || movedOn;
  const loading = state.status === 'loading';
  const retry = () => load(lastDetail.detail, lastDetail.refresh);
  const threshold = snapshot?.autoCompactEnabled !== false ? snapshot?.autoCompactThreshold : null;
  const compact = async () => {
    if (!onCompact || compactDisabled || compactBusy || compactInFlight.current) return;
    compactInFlight.current = true;
    setCompacting(true);
    setCompactError(null);
    try {
      await onCompact();
    } catch (cause) {
      setCompactError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      compactInFlight.current = false;
      setCompacting(false);
    }
  };
  const compactPending = compactBusy || compacting;
  const footer = (
    <>
      {compactError ? <ErrorMark message={compactError} onRetry={() => void compact()} /> : null}
      <button type="button" className="thread-context-action" disabled={!onCompact || compactPending || compactDisabled} aria-busy={compactPending || undefined}
        onClick={() => void compact()}>
        {compactPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {translate(compactPending ? 'chat.compactingContext' : 'chat.contextCompact')}
      </button>
    </>
  );

  return (
    <div className="composer-context-control thread-context-palette relative">
      <button
        ref={trigger}
        type="button"
        data-composer-menu-trigger="true"
        data-testid="composer-context-meter"
        data-tone={tone}
        data-empty={reading ? undefined : 'true'}
        aria-label={usage}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
        className="composer-context-meter"
      >
        <span className="thread-context-bar is-mini" aria-hidden="true">
          <span className="thread-context-segment" data-slot="-1" style={{ width: `${reading ? contextPercent(reading.used, reading.window) : 0}%` }} />
        </span>
      </button>
      {open ? (
        <ContextPanelSurface phone={phone} label={translate('chat.context')} subtitle={modelLabel || snapshot?.model} trigger={trigger.current} onClose={onClose} footer={footer}
          expandableItems={snapshot ? (snapshot.groups ?? []).reduce((sum, group) => sum + (group.items?.length ?? 0), 0) : 0}
          layoutKey={[state.status, state.response?.availability, snapshot?.source, snapshot?.categories.length].join('|')}>
          <div className="thread-context-summary" data-tone={tone}>
            <div className="thread-context-hero">
              <strong className="thread-context-percent">{reading ? formatContextPercent(reading.used, reading.window, true) : '—'}</strong>
              {reading ? (
                <span className="thread-context-amount">
                  {approximate(estimatedTotal)}{formatContextTokens(reading.used)}
                  <span className="thread-context-amount-window"> / {formatContextTokens(reading.window)}</span>
                </span>
              ) : <span className="thread-context-amount">{translate('chat.contextNoData')}</span>}
              {reading && !arranged ? (
                <span className="thread-context-remaining">{translate('chat.contextRemaining', { value1: formatContextTokens(Math.max(0, reading.window - reading.used)) })}</span>
              ) : null}
            </div>
            {reading ? (
              // Categories only at the total they were counted at: once it moved on,
              // the bar is the plain total and the rows below say how old they are.
              <ContextBar
                segments={arranged && !movedOn ? usedSegments : [{ id: 'used', label: '', slot: -1, tokens: reading.used }]}
                reservedEnd={arranged && !movedOn ? arranged.buffer.map(segmentOf) : []}
                window={reading.window}
                tick={threshold}
                label={translate('chat.contextBarLabel', {
                  percent: percentText,
                  parts: (arranged && !movedOn ? usedSegments : []).map((segment) => `${segment.label} ${formatContextTokens(segment.tokens)}`).join(translate('chat.listSeparator')),
                })}
              />
            ) : null}
            {arranged && !movedOn && usedSegments.length > 1 && analyzed && contextPercent(analyzed.used, analyzed.window) < 25 ? (
              <div className="thread-context-makeup">
                <span className="thread-context-makeup-label">{translate('chat.contextMakeup')}</span>
                <ContextBar segments={usedSegments} window={Math.max(1, miniTotal)} />
              </div>
            ) : null}
            {reading ? (
              <p className="thread-context-meta" data-stale={stale || undefined}>
                <span title={reading.updatedAt ? new Date(reading.updatedAt).toLocaleString(getLocale()) : undefined}>
                  {[sourceLabel(movedOn ? null : snapshot), age].filter(Boolean).join(' · ')}
                </span>
                {stale ? (
                  <span className="thread-context-stale">
                    {movedOn ? translate('chat.contextCategoriesOlder', { value1: contextAge(snapshot?.updatedAt, now) ?? '' }) : translate('chat.contextStale')}
                  </span>
                ) : null}
              </p>
            ) : null}
            {snapshot?.autoCompactEnabled === false
              ? <p className="thread-context-meta">{translate('chat.contextAutoCompactOff')}</p>
              : threshold != null
                ? <p className="thread-context-meta">{translate('chat.contextAutoCompactAt', { value1: formatContextTokens(threshold) })}</p>
                : null}
          </div>
          <ContextNote state={state} inspector={inspector} hasSnapshot={Boolean(arranged)} onRetry={retry} />
          {arranged ? <ContextBreakdown snapshot={snapshot!} /> : null}
          {!arranged && loading && !state.response ? (
            <div className="thread-context-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>
          ) : null}
        </ContextPanelSurface>
      ) : null}
    </div>
  );
}

