import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { formatDate, getLocale, translate } from '../../i18n';
import { StatusMark } from '../StatusMark';
import { themeAgentName } from '../themeAgent';
import { Network } from 'lucide-react';
import { TokenMetricIcon } from '../timeline/TokenMetricIcon';
import { TokenUsageCost } from '../timeline/TokenUsageCost';
import { formatCompactTokenCount, formatCompactUsd } from '../timeline/tokenFormatting';
import { heatLevel, type MapNode, type ThreadMapThread } from './model';
import type { MapRect } from './squarify';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Monograms for agents a theme gives no art. */
const MONOGRAMS: Record<string, string> = {
  claude: 'Cl', codex: 'Cx', copilot: 'Co', cursor: 'Cu', deepseek: 'DS', gemini: 'Ge', grok: 'Gk', kimi: 'Ki', opencode: 'OC', qwen: 'Qw',
};
const monogram = (agent: string) => MONOGRAMS[agent] ?? agent.replace(/[^a-z0-9]/gi, '').slice(0, 2).replace(/^./, c => c.toUpperCase());

/** An agent's mark: the theme's art for it (filled in by the map), else a monogram. */
export function AgentChip({ agent }: { agent: string | undefined }) {
  return agent ? <span className="thread-map-agent" data-agent={agent} aria-hidden="true">{monogram(agent)}</span> : null;
}

/** A duration in words, for sentences: "4 h 12 min". */
export function formatRunTime(ms: number) {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 1) return translate('workbench.threadMapUnderMinute');
  if (minutes < 60) return translate('workbench.threadMapMinutes', { count: minutes });
  return translate('workbench.threadMapHoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/** A duration for a figure: "37 min", "4.2 h", "12 d". */
export function formatShortDuration(ms: number) {
  if (ms < MINUTE) return translate('workbench.threadMapShortUnderMinute');
  if (ms < HOUR) return translate('workbench.threadMapShortMinutes', { value: Math.round(ms / MINUTE) });
  const round = (value: number) => (value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
  if (ms < 100 * HOUR) return translate('workbench.threadMapShortHours', { value: round(ms / HOUR) });
  return translate('workbench.threadMapShortDays', { value: round(ms / DAY) });
}

/** How old a thread is, 0–4: today, this week, this month, this quarter, older. */
export function ageTier(createdAt: string | undefined, now = Date.now()) {
  const age = now - Date.parse(createdAt ?? '');
  if (!Number.isFinite(age)) return null;
  if (age < DAY) return 0;
  if (age < 7 * DAY) return 1;
  if (age < 30 * DAY) return 2;
  if (age < 90 * DAY) return 3;
  return 4;
}

/** A thread's age in one short word: "today", "5 d", "3 w", "2 mo", "1 y". */
export function formatAge(createdAt: string, now = Date.now()) {
  const days = Math.floor((now - Date.parse(createdAt)) / DAY);
  if (days < 1) return translate('workbench.threadMapAgeToday');
  if (days < 14) return translate('workbench.threadMapAgeDays', { count: days });
  if (days < 60) return translate('workbench.threadMapAgeWeeks', { count: Math.floor(days / 7) });
  if (days < 365) return translate('workbench.threadMapAgeMonths', { count: Math.floor(days / 30) });
  return translate('workbench.threadMapAgeYears', { count: Math.floor(days / 365) });
}

function ago(at: string, now = Date.now()) {
  const seconds = Math.round((Date.parse(at) - now) / 1000);
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400], ['hour', 3_600], ['minute', 60]];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(0, 'minute');
}

/** A prompt as a line of text: attachments become a word, whitespace one space. */
export function promptLine(prompt: string) {
  return prompt
    .replace(/\[PHOTO\s+[^\]]*\]/g, ` ${translate('workbench.threadMapPhoto')} `)
    .replace(/\[FILE\s+[^\]]*\]/g, ` ${translate('workbench.threadMapFile')} `)
    .replace(/\s+/g, ' ')
    .trim();
}

/** The lines a thread's tooltip and label read: title, who and where, figures, dates. */
export function threadDetails(node: MapNode, hours: number) {
  const thread = node.thread!;
  const who = [thread.agent ? thread.agentName ?? themeAgentName(thread.agent) : null, thread.model,
    node.parent && node.parent.kind !== 'root' ? node.parent.label : null,
    thread.from ? translate('workbench.threadMapFrom', { title: thread.from }) : null].filter(Boolean).join(' · ');
  const figures = [
    thread.turns !== null ? translate('workbench.threadMapTurns', { count: thread.turns }) : null,
    thread.totalMs ? translate('workbench.threadMapTotalRan', { duration: formatRunTime(thread.totalMs) }) : null,
    thread.activeMs !== null ? (thread.activeMs > 0
      ? translate('workbench.threadMapRan', { hours, duration: formatRunTime(thread.activeMs) })
      : translate('workbench.threadMapNotRun', { hours })) : null,
    thread.agentThreads ? translate('workbench.threadMapAgentThreads', { count: thread.agentThreads }) : null,
  ].filter(Boolean).join(' · ');
  const spend = [
    thread.tokenUsage ? translate('workbench.threadMapTokens', { count: formatCompactTokenCount(thread.tokenUsage.totalTokens) }) : null,
    thread.priceEstimate ? translate('workbench.threadMapCost', { usd: formatCompactUsd(thread.priceEstimate.totalUsd) })
      + (thread.pricePartial ? ` (${translate('workbench.threadMapPricePartialShort')})` : '') : null,
  ].filter(Boolean).join(' · ');
  const dates = [
    thread.createdAt ? translate('workbench.threadMapCreated', { date: formatDate(thread.createdAt, { dateStyle: 'medium' }) }) : null,
    thread.running ? translate('workbench.threadMapRunning')
      : thread.lastActiveAt ? translate('workbench.threadMapActiveAgo', { ago: ago(thread.lastActiveAt) }) : null,
    thread.failed ? translate('workbench.threadMapFailedTurn') : null,
  ].filter(Boolean).join(' · ');
  return [node.label, who, figures, spend, dates].filter(Boolean);
}

/** A pie that fills as the thread ages, colored from fresh to bronze. */
export function AgeGlyph({ tier }: { tier: number }) {
  const fraction = (tier + 1) / 5;
  const angle = fraction * 2 * Math.PI;
  const x = 8 + 5 * Math.sin(angle), y = 8 - 5 * Math.cos(angle);
  return (
    <svg className="thread-map-age-glyph" data-age={tier} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {fraction >= 1
        ? <circle cx="8" cy="8" r="5" fill="currentColor" />
        : <path d={`M8 8 L8 3 A5 5 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />}
    </svg>
  );
}

/** Running time per hour of the window, each bar out of a full hour. */
function Spark({ hourly }: { hourly: number[] }) {
  return (
    <span className="thread-map-spark" aria-hidden="true">
      {hourly.map((ms, hour) => <i key={hour} data-zero={ms <= 0 || undefined} style={{ '--h': Math.min(1, ms / HOUR).toFixed(3) } as CSSProperties} />)}
    </span>
  );
}

/** The type scale of a tile of this size, from a whole card down to a speck. */
export function tileTier(box: MapRect) {
  const { width: w, height: h } = box;
  if (w >= 180 && h >= 120) return 'card';
  if (w >= 130 && h >= 80) return 'large';
  if (w >= 90 && h >= 46) return 'medium';
  if (w >= 60 && h >= 28) return 'named';
  if (w >= 22 && h >= 20) return 'icon';
  return 'dot';
}

/** Line heights and gaps the parts of a tile take, for fitting them in. */
const FIT = { padding: 18, gap: 5, who: 14, grid: 32, column: 56, meta: 14, usage: 22, spark: 14, promptLine: 16 };

/** Tokens and API price, as on a turn: the price opens its breakdown. */
function Usage({ thread }: { thread: ThreadMapThread }) {
  if (!thread.tokenUsage && !thread.priceEstimate) return null;
  return (
    <span className="thread-map-usage">
      <TokenUsageCost usage={thread.tokenUsage} price={thread.priceEstimate}
        {...(thread.pricePartial ? { detailsNote: translate('workbench.threadMapPricePartial') } : {})} />
      {thread.tokenUsage ? <span className="thread-map-tokens" title={translate('chat.totalTokens', { value1: thread.tokenUsage.totalTokens.toLocaleString(getLocale()) })}>
        <TokenMetricIcon />{formatCompactTokenCount(thread.tokenUsage.totalTokens)}
      </span> : null}
    </span>
  );
}

/**
 * One thread on the map. Width and height each decide what fits: the agent and
 * model, the latest prompt, turns with total and recent run time, tokens and API
 * price, an hourly strip and the age; what does not fit is left out, down to a
 * colored speck. The tile is one link; the price and the agent-thread button sit
 * above it.
 */
export function ThreadTile({ node, box, hours, current, onOpen, hover, onShowChildren }: {
  node: MapNode;
  box: MapRect;
  hours: number;
  current: boolean;
  onOpen: (event: ReactMouseEvent) => void;
  hover: Record<string, unknown>;
  /** Opens the tile up into the agent threads the thread started. */
  onShowChildren?: (() => void) | undefined;
}) {
  const thread = node.thread!;
  const { width: w, height: h } = box;
  const tier = tileTier(box);
  const details = threadDetails(node, hours);
  const age = ageTier(thread.createdAt);
  const chip = <AgentChip agent={thread.agent} />;
  const titled = tier !== 'icon' && tier !== 'dot';
  const lineHeight = tier === 'card' ? 19 : tier === 'large' ? 17 : 16;
  const childCount = thread.children?.length ?? 0;
  const canShowChildren = Boolean(onShowChildren && childCount) && w >= 60 && h >= 40;
  // The title keeps room for a few characters: the age goes first, then the count beside the agent-thread icon;
  // a narrow tall tile has the button on a line of its own under the title.
  const headRoom = w - (tier === 'card' ? 22 : 14) - (thread.agent ? (tier === 'card' ? 25 : 22) : 0);
  const showChildren = canShowChildren && headRoom - 24 >= 44;
  const childrenRow = canShowChildren && !showChildren && h >= 80;
  const childrenWidth = !showChildren ? 0 : headRoom - 36 >= 44 ? 36 : 24;
  // From the top: title, who; from the bottom: strip, figures; the prompt takes what is left.
  const showAge = age !== null && w >= 110 && h >= 44 && headRoom - childrenWidth - 19 >= 52;
  const showAgeText = showAge && headRoom - childrenWidth - 52 >= 80;
  const showWho = w >= 100 && h >= 80;
  const known = thread.turns !== null;
  const priced = Boolean(thread.tokenUsage || thread.priceEstimate);
  // Figures side by side on a wide tile, stacked on a tall narrow one, else one line.
  const figures = known && w >= 176 && h >= 120 ? 'grid' : known && w >= 96 && h >= 170 ? 'column' : known && w >= 64 && h >= 46 ? 'line' : null;
  // Price and tokens: a fourth figure on a wide grid, else a row of their own where it fits.
  const usage = !priced ? null : figures === 'grid' && w >= 270 ? 'cell' : (figures === 'grid' || figures === 'column') && w >= 110 ? 'row' : null;
  const showSpark = Boolean(thread.hourlyMs?.some(ms => ms > 0)) && w >= 96 && h >= 100;
  const fixed = FIT.padding + (childrenRow ? 19 + FIT.gap : 0) + (showWho ? FIT.who + FIT.gap : 0) + (figures ? FIT[figures === 'line' ? 'meta' : figures] + FIT.gap : 0)
    + (usage === 'row' ? FIT.usage + FIT.gap : 0) + (showSpark ? FIT.spark + FIT.gap : 0);
  const titleLines = Math.max(1, Math.min(3, Math.floor((h - fixed) / lineHeight), h >= 56 ? 3 : 1));
  const promptRoom = h - fixed - Math.min(2, titleLines) * lineHeight - FIT.gap;
  const promptLines = w >= 100 && thread.lastPrompt ? Math.min(6, Math.floor(promptRoom / FIT.promptLine)) : 0;
  const prompt = promptLines >= 2 ? promptLine(thread.lastPrompt!) : '';
  // A Latin word wider than the title's line would be split mid-word; one line with an ellipsis reads better.
  const titleWidth = headRoom - (showAge ? (showAgeText ? 52 : 19) : 0) - childrenWidth;
  const longest = Math.max(0, ...thread.title.split(/\s+/).map(word => (/^[\x21-\x7e]+$/.test(word) ? word.length : 0)));
  const wraps = longest * lineHeight * 0.42 <= titleWidth;
  const lines = !wraps ? 1 : prompt ? Math.min(2, titleLines) : titleLines;
  // Room still left grows the hourly strip, up to three times its height.
  const left = h - fixed - lines * lineHeight - (prompt ? promptLines * FIT.promptLine + FIT.gap : 0);
  const sparkHeight = FIT.spark + Math.max(0, Math.min(28, Math.floor(left * 0.4)));
  // The chip already names the agent; a wide tile spells it out with the model,
  // and says which thread started an agent thread shown on its own.
  const who = w >= 160 ? [thread.agent ? thread.agentName ?? themeAgentName(thread.agent) : null, thread.model].filter(Boolean).join(' · ') : '';
  const from = w >= 160 && thread.from ? translate('workbench.threadMapFrom', { title: thread.from }) : '';
  const status = thread.running
    ? <span className="thread-map-tile-live"><i className="thread-map-running-dot" />{translate('workbench.threadMapRunning')}</span>
    : thread.lastActiveAt ? <span>{translate('workbench.threadMapActiveAgo', { ago: ago(thread.lastActiveAt) })}</span> : null;
  const short = [
    translate('workbench.threadMapTurns', { count: thread.turns ?? 0 }),
    thread.totalMs && w >= 110 ? translate('workbench.threadMapTotalShort', { duration: formatShortDuration(thread.totalMs) }) : null,
    thread.priceEstimate && w >= 170 ? formatCompactUsd(thread.priceEstimate.totalUsd) : null,
  ].filter(Boolean).join(' · ');
  const childrenButton = (count: boolean) => (
    <button type="button" className="thread-map-children" onClick={onShowChildren}
      aria-label={translate('workbench.threadMapShowChildren', { count: childCount, title: thread.title })}
      title={translate('workbench.threadMapShowChildren', { count: childCount, title: thread.title })}>
      <Network aria-hidden="true" />{count && <span>{childCount}</span>}
    </button>
  );
  return (
    <div className="thread-map-tile" data-map-id={node.id} data-size={tier} data-heat={heatLevel(thread.activeMs)}
      data-running={thread.running || node.running > 0 || undefined} data-failed={thread.failed || undefined} data-current={current || undefined}
      style={{ left: box.x, top: box.y, width: w, height: h, '--lines': lines, '--prompt-lines': promptLines, '--spark-h': `${sparkHeight}px` } as CSSProperties}>
      <a href={thread.href} className="thread-map-tile-link" aria-label={details.join(' · ')} aria-current={current ? 'page' : undefined}
        tabIndex={tier === 'dot' ? -1 : undefined} onClick={onOpen} {...hover} />
      {tier !== 'dot' && (
        <span className="thread-map-tile-head">
          {chip}
          {/* The navigation's marks for a failed or interrupted last turn; running has its heartbeat. */}
          {(thread.failed || thread.interrupted) && !thread.running ? <StatusMark status={thread.failed ? 'failed' : 'interrupted'} /> : null}
          {titled && <span className="thread-map-tile-title">{thread.title}</span>}
          {showChildren && childrenButton(childrenWidth > 24)}
          {showAge && (
            <span className="thread-map-age" title={thread.createdAt ? translate('workbench.threadMapCreated', { date: formatDate(thread.createdAt, { dateStyle: 'medium' }) }) : undefined}>
              <AgeGlyph tier={age} />
              {showAgeText && <span>{formatAge(thread.createdAt!)}</span>}
            </span>
          )}
        </span>
      )}
      {childrenRow && <span className="thread-map-tile-children-row">{childrenButton(true)}</span>}
      {showWho && (who || from || status || thread.failed) && (
        <span className="thread-map-tile-sub">
          {who && <span className="thread-map-tile-who">{who}</span>}
          {from && <span className="thread-map-tile-from">{from}</span>}
          {thread.failed && <span className="thread-map-tile-failed">{translate('workbench.threadMapFailedTurn')}</span>}
          {status}
        </span>
      )}
      {prompt && <span className="thread-map-tile-prompt">{prompt}</span>}
      {(figures === 'grid' || figures === 'column') && (
        <span className="thread-map-stats" data-layout={figures}>
          <span><b>{thread.turns}</b><small>{translate('workbench.threadMapStatTurns')}</small></span>
          <span><b>{thread.totalMs ? formatShortDuration(thread.totalMs) : '—'}</b><small>{translate('workbench.threadMapStatTotal')}</small></span>
          <span><b>{thread.activeMs ? formatShortDuration(thread.activeMs) : '—'}</b><small>{translate('workbench.threadMapStatRecent', { hours })}</small></span>
          {usage === 'cell' && <span className="thread-map-stat-usage"><Usage thread={thread} /><small>{translate('workbench.threadMapStatCost')}</small></span>}
        </span>
      )}
      {usage === 'row' && <Usage thread={thread} />}
      {figures === 'line' && <span className="thread-map-tile-meta">{short}</span>}
      {showSpark && <Spark hourly={thread.hourlyMs!} />}
    </div>
  );
}
