import type {
  ContextInspectionCategoryDto,
  ContextInspectionGroupItemDto,
  ContextInspectionSnapshotDto,
  ThreadContextUsageDto,
} from '@pockymoe/shared';

import { translate, type TranslationKey } from '../../i18n';

export interface ContextReading {
  used: number;
  window: number;
  updatedAt: string | null;
}

export interface ContextSegment {
  id: string;
  label: string;
  /** Palette slot (1-7); 0 is the neutral of unattributed and unknown categories. */
  slot: number;
  tokens: number;
}

/** A hue belongs to a category, whichever others are present, and the order is
    fixed so neighbours stay the validated adjacent pairs. */
const USED_CATEGORIES: Record<string, { slot: number; label: TranslationKey; rank: number }> = {
  system_prompt: { slot: 1, label: 'chat.contextCategorySystemPrompt', rank: 1 },
  system_tools: { slot: 2, label: 'chat.contextCategorySystemTools', rank: 2 },
  mcp_instructions: { slot: 3, label: 'chat.contextCategoryMcpInstructions', rank: 3 },
  mcp_tools: { slot: 3, label: 'chat.contextCategoryMcpTools', rank: 4 },
  memory_files: { slot: 4, label: 'chat.contextCategoryMemory', rank: 5 },
  skills: { slot: 5, label: 'chat.contextCategorySkills', rank: 6 },
  custom_agents: { slot: 6, label: 'chat.contextCategoryAgents', rank: 7 },
  messages: { slot: 7, label: 'chat.contextCategoryMessages', rank: 8 },
  unattributed: { slot: 0, label: 'chat.contextCategoryUnattributed', rank: 10 },
};
const OTHER_LABELS: Record<string, TranslationKey> = {
  free_space: 'chat.contextCategoryFree',
  autocompact_buffer: 'chat.contextCategoryBuffer',
  system_tools_deferred: 'chat.contextCategorySystemToolsDeferred',
  mcp_tools_deferred: 'chat.contextCategoryMcpToolsDeferred',
  custom_agents: 'chat.contextCategoryAgents',
  mcp_tools: 'chat.contextCategoryMcpTools',
  mcp_instructions: 'chat.contextCategoryMcpInstructions',
  memory_files: 'chat.contextCategoryMemory',
  skills: 'chat.contextCategorySkills',
  system_tools: 'chat.contextCategorySystemTools',
};

export function contextCategoryLabel(entry: { id: string; label?: string | null }) {
  const key = USED_CATEGORIES[entry.id]?.label ?? OTHER_LABELS[entry.id];
  return key ? translate(key) : entry.label || entry.id;
}

export function contextCategorySlot(id: string) {
  return USED_CATEGORIES[id]?.slot ?? 0;
}

const validCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function readingFromUsage(usage: ThreadContextUsageDto | null | undefined): ContextReading | null {
  if (usage?.availability !== 'available') return null;
  const { tokensInContextWindow: used, modelContextWindow: window } = usage;
  if (!validCount(used) || !validCount(window) || window <= 0) return null;
  return { used, window, updatedAt: usage.updatedAt };
}

export function readingFromSnapshot(snapshot: ContextInspectionSnapshotDto | null | undefined): ContextReading | null {
  if (!snapshot || !validCount(snapshot.usedTokens) || !validCount(snapshot.windowTokens) || snapshot.windowTokens <= 0) return null;
  return { used: snapshot.usedTokens, window: snapshot.windowTokens, updatedAt: snapshot.updatedAt };
}

const timeOf = (value: string | null | undefined) => {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
};

/** Which analysis to show: the newer one, except that Claude's summary does not
    replace a full count of the same context, whose categories are measured. */
export function preferredSnapshot(
  current: ContextInspectionSnapshotDto | null | undefined,
  next: ContextInspectionSnapshotDto | null | undefined,
) {
  if (!current || !next) return current ?? next ?? null;
  const [full, summary] = current.source === 'claudeFull' ? [current, next] : [next, current];
  if (full.source === 'claudeFull' && summary.source === 'claudeSummary' && full.usedTokens === summary.usedTokens) return full;
  return timeOf(next.updatedAt) >= timeOf(current.updatedAt) ? next : current;
}

/** The harness's plain total moved on from the analysis: a later reading that
    differs by more than a rounding step (a compaction, a new request). The
    categories then describe an earlier moment, and the panel says so. */
export function totalMovedOn(snapshot: ContextReading | null, base: ContextReading | null) {
  if (!snapshot || !base || timeOf(base.updatedAt) <= timeOf(snapshot.updatedAt)) return false;
  return Math.abs(base.used - snapshot.used) > base.window * 0.01;
}

export function currentReading(snapshot: ContextReading | null, base: ContextReading | null) {
  return totalMovedOn(snapshot, base) ? base : snapshot ?? base;
}

export function contextPercent(used: number, window: number) {
  return window > 0 ? Math.max(0, Math.min(100, (used / window) * 100)) : 0;
}

/** Whole percents; anything above nothing never reads as 0%. */
export function formatContextPercent(used: number, window: number, detailed = false) {
  const percent = contextPercent(used, window);
  if (detailed) return percent > 0 && percent < 0.1 ? '<0.1%' : `${Number(percent.toFixed(1))}%`;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

/** A category's share: one decimal while it is small. */
export function formatContextShare(tokens: number, window: number) {
  const percent = contextPercent(tokens, window);
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return percent < 10 ? `${Number(percent.toFixed(1))}%` : `${Math.round(percent)}%`;
}

export function formatContextTokens(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1000) return `${Number((value / 1000).toFixed(1))}k`;
  return String(Math.round(value));
}

export function contextTone(used: number, window: number) {
  const percent = contextPercent(used, window);
  return percent >= 80 ? 'danger' : percent >= 60 ? 'warning' : 'normal';
}

export function segmentOf(category: ContextInspectionCategoryDto): ContextSegment {
  return {
    id: category.id,
    label: contextCategoryLabel(category),
    slot: contextCategorySlot(category.id),
    tokens: Math.max(0, category.tokens),
  };
}

export function arrangeContextCategories(snapshot: ContextInspectionSnapshotDto) {
  const of = (kind: ContextInspectionCategoryDto['kind']) =>
    snapshot.categories.filter((entry) => entry.kind === kind && validCount(entry.tokens));
  const rank = (entry: ContextInspectionCategoryDto) => USED_CATEGORIES[entry.id]?.rank ?? 9;
  return {
    used: of('used').map((entry, index) => ({ entry, index }))
      .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index).map(({ entry }) => entry),
    buffer: of('buffer'),
    free: of('free'),
    deferred: of('deferred'),
  };
}

/** Which listed items sit behind which category. The tool groups hold loaded and
    deferred tools together; they split along the same line as the categories.
    Groups no category claims are returned as `rest`. */
export function contextCategoryItems(snapshot: ContextInspectionSnapshotDto) {
  const items = new Map<string, ContextInspectionGroupItemDto[]>();
  const rest: { id: string; label: string; items: ContextInspectionGroupItemDto[] }[] = [];
  const present = new Set(snapshot.categories.map((entry) => entry.id));
  const sorted = (list: ContextInspectionGroupItemDto[]) => [...list].sort((a, b) => b.tokens - a.tokens);
  for (const group of snapshot.groups ?? []) {
    if (!group.items?.length) continue;
    const deferredId = `${group.id}_deferred`;
    const deferred = present.has(deferredId) ? group.items.filter((item) => item.loaded === false) : [];
    const loaded = deferred.length ? group.items.filter((item) => item.loaded !== false) : group.items;
    if (deferred.length) items.set(deferredId, sorted(deferred));
    if (!loaded.length) continue;
    if (present.has(group.id)) items.set(group.id, sorted(loaded));
    else rest.push({ id: group.id, label: contextCategoryLabel(group), items: sorted(loaded) });
  }
  return { items, rest };
}

/** "just now", "12s ago", "3m ago", "2h ago", "4d ago". */
export function contextAge(value: string | null | undefined, now = Date.now()) {
  const time = timeOf(value);
  if (!time) return null;
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 5) return translate('chat.contextUpdatedNow');
  if (seconds < 60) return translate('chat.contextUpdatedSeconds', { value1: seconds });
  if (seconds < 3600) return translate('chat.contextUpdatedMinutes', { value1: Math.floor(seconds / 60) });
  if (seconds < 86400) return translate('chat.contextUpdatedHours', { value1: Math.floor(seconds / 3600) });
  return translate('chat.contextUpdatedDays', { value1: Math.floor(seconds / 86400) });
}
