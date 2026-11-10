import type { ThreadContextStepDto, ThreadContextStepsDto } from '@pockymoe/shared';

import { translate, type TranslationKey } from '../../i18n';
import { contextCategorySlot } from './contextInspectionModel';

/** The palette's groups, in stacking order; 0 collects what has no group. */
export const CONTEXT_GROUPS: { slot: number; label: TranslationKey }[] = [
  { slot: 1, label: 'chat.contextGroupSystem' },
  { slot: 2, label: 'chat.contextGroupTools' },
  { slot: 3, label: 'chat.contextCategoryMemory' },
  { slot: 4, label: 'chat.contextCategorySkills' },
  { slot: 5, label: 'chat.contextCategoryUserMessages' },
  { slot: 6, label: 'chat.contextGroupModel' },
  { slot: 7, label: 'chat.contextCategoryToolResults' },
  { slot: 8, label: 'chat.contextCategoryInjected' },
  { slot: 0, label: 'chat.contextGroupOther' },
];
export const contextGroupLabel = (slot: number) =>
  translate(CONTEXT_GROUPS.find((group) => group.slot === slot)?.label ?? 'chat.contextGroupOther');

/** Tokens per palette slot. A step nothing described has one unsplit amount. */
export type GroupTokens = Record<number, number>;

export interface TrendPoint {
  /** `turn:step`, unique in the series. */
  key: string;
  turn: number | null;
  /** The step within its turn; for a turn point, how many steps it had. */
  step: number;
  at: string;
  /** False when no composition described the request: `groups` then holds the
      request's input under the neutral slot. */
  split: boolean;
  groups: GroupTokens;
  total: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  modelMs: number;
  toolMs: number;
}

const positive = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

export function groupTokens(step: ThreadContextStepDto): { groups: GroupTokens; split: boolean } {
  const entries = Object.entries(step.categories ?? {});
  if (!entries.length) return { groups: { 0: positive(step.inputTokens) }, split: false };
  const groups: GroupTokens = {};
  for (const [id, tokens] of entries) {
    const slot = contextCategorySlot(id);
    groups[slot] = (groups[slot] ?? 0) + positive(tokens);
  }
  return { groups, split: true };
}

const sum = (groups: GroupTokens) => Object.values(groups).reduce((total, tokens) => total + tokens, 0);

function pointOf(step: ThreadContextStepDto): TrendPoint {
  const { groups, split } = groupTokens(step);
  return {
    key: `${step.turn ?? step.turnId}:${step.step}`,
    turn: step.turn,
    step: step.step,
    at: step.at,
    split,
    groups,
    total: sum(groups),
    inputTokens: positive(step.inputTokens),
    cachedInputTokens: positive(step.cachedInputTokens),
    outputTokens: positive(step.outputTokens),
    modelMs: positive(step.modelMs),
    toolMs: positive(step.toolMs),
  };
}

/** One point per model request, or per turn: the context its last request saw,
    with the turn's requests added up for tokens and time. */
export function trendPoints(steps: ThreadContextStepDto[], by: 'step' | 'turn'): TrendPoint[] {
  const points = steps.map(pointOf);
  if (by === 'step') return points;
  const turns: TrendPoint[] = [];
  let current: string | null = null;
  steps.forEach((step, index) => {
    const point = points[index]!;
    if (step.turnId !== current) {
      current = step.turnId;
      turns.push({ ...point, key: `turn:${step.turn ?? step.turnId}`, step: 1 });
      return;
    }
    const turn = turns[turns.length - 1]!;
    turns[turns.length - 1] = {
      ...point,
      key: turn.key,
      step: turn.step + 1,
      inputTokens: turn.inputTokens + point.inputTokens,
      cachedInputTokens: turn.cachedInputTokens + point.cachedInputTokens,
      outputTokens: turn.outputTokens + point.outputTokens,
      modelMs: turn.modelMs + point.modelMs,
      toolMs: turn.toolMs + point.toolMs,
    };
  });
  return turns;
}

/** What each group changed by since the point before. Unsplit neighbours only
    compare totals: a category cannot be said to have grown from an unknown. */
export function trendDelta(point: TrendPoint, previous: TrendPoint | undefined): GroupTokens {
  if (!previous) return { ...point.groups };
  if (!point.split || !previous.split) return { 0: point.total - previous.total };
  const delta: GroupTokens = {};
  for (const slot of new Set([...Object.keys(point.groups), ...Object.keys(previous.groups)].map(Number))) {
    const change = (point.groups[slot] ?? 0) - (previous.groups[slot] ?? 0);
    if (change !== 0) delta[slot] = change;
  }
  return delta;
}

/** How far the change scale reaches. A first request or a compaction is many
    times an ordinary step and would flatten every other bar, so when the tallest
    value dwarfs the usual ones the scale follows the usual ones and the tall bar
    is cut (the chart marks the cut; the true figure is listed under it). */
export function changeLimit(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const max = sorted.at(-1);
  if (max == null) return 0;
  const usual = sorted[Math.floor((sorted.length - 1) * 0.9)]!;
  return max > usual * 4 ? usual * 2 : max;
}

/** A round number at or above `value`, for the axis's top. */
export function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitude >= value) return factor * magnitude;
  }
  return 10 * magnitude;
}

export interface ContextStatistics {
  /** Cached share of everything the thread's requests read; null with no input. */
  cacheHit: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  /** What the recorded requests read, added up per group. */
  cumulative: GroupTokens;
  cumulativeTotal: number;
  cumulativeSteps: number;
  recordedSteps: number;
  modelMs: number;
  /** Tools and waits: the turns' wall time not spent in the model. */
  otherMs: number;
  outputTokensPerSecond: number | null;
}

export function contextStatistics(data: ThreadContextStepsDto): ContextStatistics {
  const { totals, steps } = data;
  const cumulative: GroupTokens = {};
  let cumulativeSteps = 0;
  for (const step of steps) {
    const { groups, split } = groupTokens(step);
    if (!split) continue;
    cumulativeSteps += 1;
    for (const [slot, tokens] of Object.entries(groups)) cumulative[Number(slot)] = (cumulative[Number(slot)] ?? 0) + tokens;
  }
  const input = positive(totals.inputTokens);
  const modelMs = positive(totals.modelTimeMs);
  return {
    cacheHit: input > 0 ? Math.min(1, positive(totals.cachedInputTokens) / input) : null,
    inputTokens: input,
    cachedInputTokens: positive(totals.cachedInputTokens),
    cacheWriteInputTokens: positive(totals.cacheWriteInputTokens),
    outputTokens: positive(totals.outputTokens),
    reasoningOutputTokens: positive(totals.reasoningOutputTokens),
    cumulative,
    cumulativeTotal: sum(cumulative),
    cumulativeSteps,
    recordedSteps: steps.length,
    modelMs,
    otherMs: Math.max(0, positive(totals.wallTimeMs) - modelMs),
    outputTokensPerSecond: positive(totals.outputTimeMs) > 0
      ? (positive(totals.timedOutputTokens) * 1000) / positive(totals.outputTimeMs) : null,
  };
}

/** "850ms", "12.3s", "4m05s", "1h02m". */
export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
}

/** "63.0%"; a share that exists never reads as 0%. */
export function formatRatio(ratio: number) {
  const percent = ratio * 100;
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return `${percent.toFixed(1)}%`;
}
