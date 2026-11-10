import type { ThreadContextStepsDto } from '@pockymoe/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { getLocale, translate, useI18n } from '../../i18n';
import { formatContextTokens } from './contextInspectionModel';
import {
  CONTEXT_GROUPS,
  contextGroupLabel,
  contextStatistics,
  formatDuration,
  formatRatio,
  changeLimit,
  niceCeiling,
  trendDelta,
  trendPoints,
  type GroupTokens,
  type TrendPoint,
} from './contextStepsModel';

/** Two or three exclusive views of one thing, as a row of tabs. */
export function ContextSwitch<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]!;
    onChange(next.value);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };
  return (
    <div className="thread-context-switch" role="tablist" aria-label={label} onKeyDown={move}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" data-value={option.value}
          aria-selected={option.value === value} tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

const PLOT_HEIGHT = 120;
const TIME_HEIGHT = 22;
const LABEL_HEIGHT = 14;
const AXIS_WIDTH = 34;
/** Between touching marks, in the surface colour. */
const GAP = 1;

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatContextTokens(Math.abs(value))}`;

function pointTitle(point: TrendPoint, by: 'step' | 'turn') {
  const turn = point.turn ?? '?';
  return by === 'turn'
    ? translate('chat.contextTrendTurnTitle', { turn, steps: point.step })
    : translate('chat.contextTrendStepTitle', { turn, step: point.step });
}

/** How the thread's context grew, request by request or turn by turn. The values
    of the selected point are listed under the chart, so the chart is never the
    only place a number can be read. */
export function ContextTrend({ data }: { data: ThreadContextStepsDto }) {
  useI18n();
  const [by, setBy] = useState<'step' | 'turn'>('step');
  const [mode, setMode] = useState<'full' | 'delta'>('full');
  const [chosen, setChosen] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const points = useMemo(() => trendPoints(data.steps, by), [data.steps, by]);
  const selected = points.find((point) => point.key === chosen) ?? points.at(-1) ?? null;
  const selectedIndex = selected ? points.indexOf(selected) : -1;

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  // As wide as the room allows, never thinner than a finger can pick; a long
  // thread scrolls sideways and opens at its newest request.
  const slot = Math.max(8, Math.min(40, Math.floor(width / Math.max(1, points.length))));
  const plotWidth = Math.max(width, slot * points.length);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [points.length, by, plotWidth]);

  const deltas = useMemo(() => points.map((point, index) => trendDelta(point, points[index - 1])), [points]);
  const stacks: GroupTokens[] = mode === 'full' ? points.map((point) => point.groups) : deltas;
  const extents = stacks.map((groups) => {
    let up = 0;
    let down = 0;
    for (const tokens of Object.values(groups)) {
      if (tokens > 0) up += tokens; else down -= tokens;
    }
    return { up, down };
  });
  const maxUp = Math.max(0, ...extents.map((extent) => extent.up));
  const maxDown = Math.max(0, ...extents.map((extent) => extent.down));
  // Totals are drawn to their true scale. Changes follow the usual step, and a
  // drop never takes more room than growth does.
  const upLimit = mode === 'full' ? maxUp : changeLimit(extents.map((extent) => extent.up));
  const downLimit = mode === 'full' || upLimit <= 0 ? maxDown : Math.min(maxDown, upLimit);
  const top = niceCeiling(upLimit);
  const bottom = downLimit > 0 ? niceCeiling(downLimit) : 0;
  const cut = maxUp > top || maxDown > bottom;
  const scale = PLOT_HEIGHT / (top + bottom);
  const zero = top * scale;
  const maxTime = Math.max(1, ...points.map((point) => point.modelMs + point.toolMs));
  const barWidth = Math.max(4, slot - 2);

  const select = (index: number) => {
    const point = points[Math.max(0, Math.min(points.length - 1, index))];
    if (!point) return;
    setChosen(point.key);
    const node = viewport.current;
    const x = points.indexOf(point) * slot;
    if (node && (x < node.scrollLeft || x + slot > node.scrollLeft + node.clientWidth)) node.scrollLeft = x - node.clientWidth / 2;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (event.key === 'Home') { event.preventDefault(); select(0); }
    else if (event.key === 'End') { event.preventDefault(); select(points.length - 1); }
    else if (step) { event.preventDefault(); select(selectedIndex + step); }
  };

  // Where each turn starts, for the row of turn numbers under the bars.
  const turnSpans = useMemo(() => {
    const spans: { turn: number | null; start: number; length: number }[] = [];
    points.forEach((point, index) => {
      const last = spans.at(-1);
      if (by === 'step' && last && last.turn === point.turn) last.length += 1;
      else spans.push({ turn: point.turn, start: index, length: 1 });
    });
    return spans;
  }, [points, by]);

  if (!points.length) return <p className="thread-context-note">{translate('chat.contextTrendEmpty')}</p>;

  const previous = selectedIndex > 0 ? points[selectedIndex - 1] : undefined;
  const change = selected ? trendDelta(selected, previous) : {};
  const totalChange = selected && previous ? selected.total - previous.total : null;
  const unsplit = points.some((point) => !point.split);
  const time = selected ? new Date(selected.at) : null;

  return (
    <section className="thread-context-trend" aria-label={translate('chat.contextTabTrend')}>
      <div className="thread-context-trend-controls">
        <ContextSwitch label={translate('chat.contextTrendBy')} value={by} onChange={(value) => { setBy(value); setChosen(null); }}
          options={[{ value: 'step', label: translate('chat.contextTrendBySteps') }, { value: 'turn', label: translate('chat.contextTrendByTurns') }]} />
        <ContextSwitch label={translate('chat.contextTrendMode')} value={mode} onChange={setMode}
          options={[{ value: 'full', label: translate('chat.contextTrendFull') }, { value: 'delta', label: translate('chat.contextTrendDelta') }]} />
      </div>
      <div className="thread-context-chart">
        <div className="thread-context-chart-axis" aria-hidden="true" style={{ width: AXIS_WIDTH }}>
          <span style={{ top: 0 }}>{formatContextTokens(top)}</span>
          {top * scale >= 60 ? <span style={{ top: zero / 2 }}>{formatContextTokens(top / 2)}</span> : null}
          <span style={{ top: zero }}>0</span>
          {bottom > 0 ? <span style={{ top: PLOT_HEIGHT }}>−{formatContextTokens(bottom)}</span> : null}
          <span className="is-time" style={{ top: PLOT_HEIGHT + 6 + TIME_HEIGHT / 2 }}>{translate('chat.contextTrendTime')}</span>
        </div>
        <div ref={viewport} className="thread-context-chart-viewport" tabIndex={0} role="group"
          aria-label={translate('chat.contextTrendChartLabel', { count: points.length })} onKeyDown={onKeyDown}>
          <svg width={plotWidth} height={PLOT_HEIGHT + 6 + TIME_HEIGHT + LABEL_HEIGHT} role="presentation">
            <line className="thread-context-grid" x1={0} x2={plotWidth} y1={0.5} y2={0.5} />
            {top * scale >= 60 ? <line className="thread-context-grid" x1={0} x2={plotWidth} y1={Math.round(zero / 2) + 0.5} y2={Math.round(zero / 2) + 0.5} /> : null}
            <line className="thread-context-grid is-zero" x1={0} x2={plotWidth} y1={Math.round(zero) + 0.5} y2={Math.round(zero) + 0.5} />
            {bottom > 0 ? <line className="thread-context-grid" x1={0} x2={plotWidth} y1={PLOT_HEIGHT - 0.5} y2={PLOT_HEIGHT - 0.5} /> : null}
            {points.map((point, index) => {
              const x = index * slot + (slot - barWidth) / 2;
              const groups = stacks[index]!;
              const extent = extents[index]!;
              // A bar taller than the scale keeps its proportions and stops at the edge.
              const fitUp = extent.up > top ? top / extent.up : 1;
              const fitDown = extent.down > bottom && extent.down > 0 ? bottom / extent.down : 1;
              let up = zero;
              let down = zero;
              const rects = CONTEXT_GROUPS.flatMap((group) => {
                const tokens = groups[group.slot] ?? 0;
                const height = Math.abs(tokens) * scale * (tokens > 0 ? fitUp : fitDown);
                if (height < 0.5) return [];
                const gap = height >= 3 ? GAP : 0;
                const y = tokens > 0 ? (up -= height) : down;
                if (tokens < 0) down += height;
                return [<rect key={group.slot} className="thread-context-fill" data-slot={group.slot}
                  x={x} y={y + (tokens > 0 ? gap : 0)} width={barWidth} height={Math.max(0.5, height - gap)} />];
              });
              const breaks = [
                fitUp < 1 ? 5 : null,
                fitDown < 1 ? PLOT_HEIGHT - 5 : null,
              ].flatMap((y) => y == null ? [] : [
                <line key={y} className="thread-context-break" x1={x - 1} x2={x + barWidth + 1} y1={y + 2} y2={y - 2} />,
              ]);
              const model = (point.modelMs / maxTime) * TIME_HEIGHT;
              const tool = (point.toolMs / maxTime) * TIME_HEIGHT;
              const timeBase = PLOT_HEIGHT + 6 + TIME_HEIGHT;
              return (
                <g key={point.key} className="thread-context-column" data-selected={point === selected || undefined}
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') setChosen(point.key); }} onClick={() => setChosen(point.key)}>
                  <title>{`${pointTitle(point, by)} · ${formatContextTokens(point.total)}`}</title>
                  <rect className="thread-context-column-hit" x={index * slot} y={0} width={slot} height={timeBase} />
                  {rects}
                  {breaks}
                  {tool >= 0.5 ? <rect className="thread-context-time is-tool" x={x} y={timeBase - model - tool} width={barWidth} height={tool} /> : null}
                  {model >= 0.5 ? <rect className="thread-context-time is-model" x={x} y={timeBase - model} width={barWidth} height={model} /> : null}
                </g>
              );
            })}
            {turnSpans.map((span) => (
              <g key={`${span.turn}:${span.start}`} className="thread-context-turn-mark">
                {span.start > 0 ? <line x1={span.start * slot} x2={span.start * slot} y1={0} y2={PLOT_HEIGHT + 6 + TIME_HEIGHT + 3} /> : null}
                {span.length * slot >= 12 ? (
                  <text x={(span.start + span.length / 2) * slot} y={PLOT_HEIGHT + 6 + TIME_HEIGHT + LABEL_HEIGHT - 3} textAnchor="middle">{span.turn ?? ''}</text>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
      </div>
      {selected ? (
        <div className="thread-context-point" aria-live="polite">
          <p className="thread-context-point-head">
            <strong>{pointTitle(selected, by)}</strong>
            {time && !Number.isNaN(time.getTime()) ? <span>{time.toLocaleTimeString(getLocale())}</span> : null}
          </p>
          <dl className="thread-context-facts">
            <div><dt>{translate(selected.split ? 'chat.context' : 'chat.contextFactRead')}</dt>
              <dd>{formatContextTokens(selected.total)}{totalChange != null && totalChange !== 0 ? <span className="thread-context-change" data-sign={totalChange > 0 ? 'up' : 'down'}>{signed(totalChange)}</span> : null}</dd></div>
            <div><dt>{translate('chat.contextFactCacheHit')}</dt>
              <dd>{selected.inputTokens > 0 ? formatRatio(Math.min(1, selected.cachedInputTokens / selected.inputTokens)) : '—'}</dd></div>
            <div><dt>{translate('chat.contextFactOutput')}</dt><dd>{formatContextTokens(selected.outputTokens)}</dd></div>
            <div><dt>{translate('chat.contextFactModelTime')}</dt><dd>{formatDuration(selected.modelMs)}</dd></div>
            <div><dt>{translate('chat.contextFactToolTime')}</dt><dd>{formatDuration(selected.toolMs)}</dd></div>
          </dl>
          {selected.split ? (
            <ul className="thread-context-rows is-compact">
              {CONTEXT_GROUPS.filter((group) => (selected.groups[group.slot] ?? 0) > 0 || (change[group.slot] ?? 0) !== 0).map((group) => {
                const delta = previous ? change[group.slot] ?? 0 : 0;
                return (
                  <li key={group.slot} className="thread-context-row">
                    <span aria-hidden="true" className="thread-context-chevron" />
                    <span aria-hidden="true" className="thread-context-swatch" data-kind="used" data-slot={group.slot} />
                    <span className="thread-context-row-label"><span className="thread-context-row-name">{contextGroupLabel(group.slot)}</span></span>
                    {delta !== 0 ? <span className="thread-context-change" data-sign={delta > 0 ? 'up' : 'down'}>{signed(delta)}</span> : null}
                    <span className="thread-context-tokens">{formatContextTokens(selected.groups[group.slot] ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="thread-context-footnote">
        <span className="thread-context-key"><i className="thread-context-time-key is-model" />{translate('chat.contextFactModelTime')}</span>
        <span className="thread-context-key"><i className="thread-context-time-key is-tool" />{translate('chat.contextFactToolTime')}</span>
        {cut ? <span>{translate('chat.contextTrendCutNote')}</span> : null}
        {unsplit ? <span>{translate('chat.contextTrendUnsplitNote')}</span> : null}
      </p>
    </section>
  );
}

/** One whole split into its groups, widths by share. */
function GroupBar({ groups, total, label }: { groups: GroupTokens; total: number; label: string }) {
  return (
    <span className="thread-context-bar is-tall" role="img" aria-label={label}>
      {CONTEXT_GROUPS.filter((group) => (groups[group.slot] ?? 0) > 0).map((group) => (
        <span key={group.slot} className="thread-context-segment" data-slot={group.slot}
          style={{ width: `${((groups[group.slot] ?? 0) / Math.max(1, total)) * 100}%` }}
          title={`${contextGroupLabel(group.slot)} ${formatContextTokens(groups[group.slot] ?? 0)}`} />
      ))}
    </span>
  );
}

/** What the thread's requests read and cost so far: cache hits, the makeup of
    everything read, and where the time went. */
export function ContextStats({ data }: { data: ThreadContextStepsDto }) {
  useI18n();
  const stats = useMemo(() => contextStatistics(data), [data]);
  const time = stats.modelMs + stats.otherMs;
  return (
    <section className="thread-context-stats" aria-label={translate('chat.contextTabStats')}>
      <div className="thread-context-stat">
        <div className="thread-context-hero">
          <strong className="thread-context-percent">{stats.cacheHit == null ? '—' : formatRatio(stats.cacheHit)}</strong>
          <span className="thread-context-amount">{translate('chat.contextFactCacheHit')}</span>
        </div>
        {stats.cacheHit != null ? (
          <span className="thread-context-bar" role="img"
            aria-label={translate('chat.contextCacheBarLabel', { cached: formatContextTokens(stats.cachedInputTokens), total: formatContextTokens(stats.inputTokens) })}>
            <span className="thread-context-segment" data-slot="-1" style={{ width: `${stats.cacheHit * 100}%` }} />
          </span>
        ) : null}
        <dl className="thread-context-facts">
          <div><dt>{translate('chat.contextFactRead')}</dt><dd>{formatContextTokens(stats.inputTokens)}</dd></div>
          <div><dt>{translate('chat.contextFactCached')}</dt><dd>{formatContextTokens(stats.cachedInputTokens)}</dd></div>
          {stats.cacheWriteInputTokens > 0
            ? <div><dt>{translate('chat.contextFactCacheWrite')}</dt><dd>{formatContextTokens(stats.cacheWriteInputTokens)}</dd></div> : null}
          <div><dt>{translate('chat.contextFactOutput')}</dt><dd>{formatContextTokens(stats.outputTokens)}</dd></div>
          {stats.reasoningOutputTokens > 0
            ? <div><dt>{translate('chat.contextCategoryReasoning')}</dt><dd>{formatContextTokens(stats.reasoningOutputTokens)}</dd></div> : null}
        </dl>
      </div>
      {stats.cumulativeTotal > 0 ? (
        <div className="thread-context-stat">
          <h4 className="thread-context-heading">{translate('chat.contextCumulativeTitle')}</h4>
          <GroupBar groups={stats.cumulative} total={stats.cumulativeTotal}
            label={translate('chat.contextCumulativeLabel', { total: formatContextTokens(stats.cumulativeTotal) })} />
          <ul className="thread-context-rows is-compact">
            {CONTEXT_GROUPS.filter((group) => (stats.cumulative[group.slot] ?? 0) > 0).map((group) => (
              <li key={group.slot} className="thread-context-row">
                <span aria-hidden="true" className="thread-context-chevron" />
                <span aria-hidden="true" className="thread-context-swatch" data-kind="used" data-slot={group.slot} />
                <span className="thread-context-row-label"><span className="thread-context-row-name">{contextGroupLabel(group.slot)}</span></span>
                <span className="thread-context-tokens">{formatContextTokens(stats.cumulative[group.slot] ?? 0)}</span>
                <span className="thread-context-share">{formatRatio((stats.cumulative[group.slot] ?? 0) / stats.cumulativeTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="thread-context-footnote">{translate('chat.contextCumulativeNote', { steps: stats.cumulativeSteps, total: formatContextTokens(stats.cumulativeTotal) })}</p>
        </div>
      ) : (
        <p className="thread-context-note">{translate('chat.contextCumulativeEmpty')}</p>
      )}
      {time > 0 ? (
        <div className="thread-context-stat">
          <h4 className="thread-context-heading">{translate('chat.contextTimeTitle')}</h4>
          <span className="thread-context-bar is-tall is-time" role="img"
            aria-label={translate('chat.contextTimeBarLabel', { model: formatDuration(stats.modelMs), other: formatDuration(stats.otherMs) })}>
            <span className="thread-context-segment thread-context-time-key is-model" style={{ width: `${(stats.modelMs / time) * 100}%` }} />
            <span className="thread-context-segment thread-context-time-key is-tool" style={{ width: `${(stats.otherMs / time) * 100}%` }} />
          </span>
          <dl className="thread-context-facts">
            <div><dt><i className="thread-context-time-key is-model" />{translate('chat.contextFactModelTime')}</dt><dd>{formatDuration(stats.modelMs)}</dd></div>
            <div><dt><i className="thread-context-time-key is-tool" />{translate('chat.contextFactToolTime')}</dt><dd>{formatDuration(stats.otherMs)}</dd></div>
            {stats.outputTokensPerSecond != null
              ? <div><dt>{translate('chat.contextFactOutputSpeed')}</dt><dd>{Math.round(stats.outputTokensPerSecond)} tok/s</dd></div> : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

/** Keeps the steps current while their view is open: read on opening, and again
    shortly after the thread's context reading moves. */
export function useContextSteps(load: (() => Promise<ThreadContextStepsDto | null>) | undefined, active: boolean, version: string | null | undefined) {
  const idle = { data: null as ThreadContextStepsDto | null, error: null as string | null, loading: false, unsupported: false };
  const [state, setState] = useState(idle);
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current += 1;
    setState({ data: null, error: null, loading: false, unsupported: false });
  }, [load]);
  useEffect(() => {
    if (!active || !load) return;
    const ticket = ++sequence.current;
    setState((current) => ({ ...current, loading: true }));
    // A turn reports many readings in a row; one read covers them.
    const timer = window.setTimeout(() => {
      load().then((data) => {
        if (ticket === sequence.current) setState({ data, error: null, loading: false, unsupported: data == null });
      }).catch((cause: unknown) => {
        if (ticket === sequence.current) setState((current) => ({ ...current, error: cause instanceof Error ? cause.message : String(cause), loading: false }));
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [active, load, version]);
  return state;
}
