import { translate } from '../../i18n';
import { themeAgentName } from '../themeAgent';
import {
  formatCompactTokenCount,
  formatCompactUsd,
} from '../timeline/tokenFormatting';
import { formatShortDuration, promptLine } from './ThreadTile';
import { relativeCache } from './MapChrome';
import { isLive, isWaiting, type MapNode, type ThreadMapThread } from './model';
import { threadLeaves } from './readability';
import type { MapDeviceExtras } from './types';

export interface TipMetric {
  kind: 'threads' | 'turns' | 'total' | 'recent' | 'cost';
  value: string;
  label: string;
}
export interface MapTipData {
  kind: MapNode['kind'];
  title: string;
  status?: string;
  agent?: string;
  agentLabel?: string;
  subtitle: string;
  metrics: TipMetric[];
  hourly?: number[];
  prompt?: string;
  footer?: string;
  details?: string;
}
const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const duration = (ms: number) =>
  ms === 0
    ? translate('workbench.threadMapShortMinutes', { value: 0 })
    : formatShortDuration(ms);
const atOf = (thread: ThreadMapThread) => Date.parse(thread.lastActiveAt ?? '');

/** Build semantic fields from data, never by splitting the old prose tooltip. */
export function mapTipData(
  node: MapNode,
  hours = 24,
  extra?: MapDeviceExtras,
): MapTipData {
  const thread = node.thread;
  const entries = thread
    ? [thread]
    : threadLeaves([node]).map((item) => item.thread!);
  const windowHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
  const values = (field: 'turns' | 'totalMs' | 'activeMs') =>
    entries.map((t) => t[field]).filter(known);
  const turns = values('turns'),
    total = values('totalMs'),
    recent = values('activeMs');
  const prices = entries.flatMap((t) =>
    known(t.priceEstimate?.totalUsd) ? [t.priceEstimate!.totalUsd] : [],
  );
  const metrics: TipMetric[] = [];
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  if (!thread)
    metrics.push({
      kind: 'threads',
      value: formatCompactTokenCount(node.threads),
      label: translate('workbench.threadMapThreads', { count: node.threads }),
    });
  if (turns.length)
    metrics.push({
      kind: 'turns',
      value: formatCompactTokenCount(sum(turns)),
      label: translate('workbench.threadMapTurns', { count: sum(turns) }),
    });
  if (total.length)
    metrics.push({
      kind: 'total',
      value: duration(sum(total)),
      label: translate('workbench.threadMapTotalShort', {
        duration: duration(sum(total)),
      }),
    });
  if (recent.length)
    metrics.push({
      kind: 'recent',
      value: duration(sum(recent)),
      label: `${translate('workbench.threadMapStatRecent', { hours: windowHours })}: ${duration(sum(recent))}`,
    });
  if (prices.length) {
    const usd = formatCompactUsd(sum(prices)),
      partial = entries.some(
        (t) => t.pricePartial || !known(t.priceEstimate?.totalUsd),
      );
    metrics.push({
      kind: 'cost',
      value: `${partial ? '≥ ' : ''}${usd}`,
      label:
        translate('workbench.threadMapCost', { usd }) +
        (partial
          ? ` · ${translate('workbench.threadMapPricePartialShort')}`
          : ''),
    });
  }
  const charts = entries.flatMap((t) =>
    t.hourlyMs?.length ? [t.hourlyMs.slice(-24)] : [],
  );
  const hourly = charts.length
    ? Array.from({ length: 24 }, (_, i) =>
        charts.reduce((sum, bars) => {
          const value = bars[i - (24 - bars.length)];
          return sum + (known(value) ? value : 0);
        }, 0),
      )
    : undefined;
  let latest: string | undefined,
    latestAt = -Infinity;
  for (const entry of entries) {
    const at = atOf(entry);
    if (Number.isFinite(at) && at > latestAt) {
      latest = entry.lastActiveAt;
      latestAt = at;
    }
  }
  const waiting = entries.some(isWaiting),
    running = entries.some(isLive);
  const status = thread
    ? waiting
      ? 'waiting'
      : thread.running
        ? 'running'
        : running
          ? 'agents-running'
          : thread.failed
            ? 'failed'
            : thread.interrupted
              ? 'interrupted'
              : thread.unread
                ? 'unread'
                : 'idle'
    : waiting
      ? 'waiting'
      : running
        ? 'running'
        : undefined;
  return {
    kind: thread
      ? 'thread'
      : node.workspace
        ? 'workspace'
        : node.device
          ? 'device'
          : node.kind,
    title: node.label,
    ...(status ? { status } : {}),
    ...(thread?.agent
      ? {
          agent: thread.agent,
          agentLabel: thread.agentName?.trim() || themeAgentName(thread.agent),
        }
      : {}),
    subtitle: thread
      ? [
          thread.modelDisplayName?.trim() || thread.model?.trim(),
          node.workspace?.label ??
            (node.parent?.kind === 'workspace' ? node.parent.label : undefined),
        ]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(' · ')
      : node.kind === 'workspace'
        ? (node.device?.name?.trim() ?? '')
        : extra?.runtimeVersion
          ? `v${extra.runtimeVersion.replace(/^v/, '')}`
          : '',
    metrics,
    ...(!thread &&
    !node.workspace &&
    extra?.metrics?.trim() &&
    !extra.metrics.includes('—')
      ? { details: extra.metrics.trim() }
      : {}),
    ...(hourly ? { hourly } : {}),
    ...(thread?.lastPrompt?.trim()
      ? { prompt: promptLine(thread.lastPrompt) }
      : {}),
    ...(latest
      ? {
          footer: translate('workbench.threadMapActiveAgo', {
            ago: relativeCache(latest),
          }),
        }
      : {}),
  };
}
