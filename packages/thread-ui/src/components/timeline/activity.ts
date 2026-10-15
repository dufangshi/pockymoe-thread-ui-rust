import type { ThreadHistoryItemDto, ThreadTurnActivityDto, ThreadTurnActivitySegmentDto, ThreadTurnChangedFileDto } from '@pockymoe/shared';
import { translate } from '../../i18n';

export type ActivityCounts = Required<Omit<ThreadTurnActivityDto, 'files' | 'segments'>>;

const EMPTY: ActivityCounts = {
  commands: 0, fileChanges: 0, changedFiles: 0, addedLines: 0, removedLines: 0,
  reads: 0, searches: 0, tools: 0, agents: 0, reasoning: 0, failed: 0,
};

const KEY_BY_KIND: Partial<Record<ThreadHistoryItemDto['kind'], keyof ActivityCounts>> = {
  commandExecution: 'commands',
  fileChange: 'fileChanges',
  fileRead: 'reads',
  webSearch: 'searches',
  toolCall: 'tools',
  skillToolCall: 'tools',
  agentToolCall: 'agents',
  reasoning: 'reasoning',
};

export type LogStatus = 'done' | 'running' | 'failed' | 'interrupted';

/** Harnesses report free-form statuses; the log only distinguishes these four. */
export function logStatus(status: string | null | undefined): LogStatus {
  const value = (status ?? '').trim().toLowerCase();
  if (/fail|error|declin|denied|reject/.test(value)) return 'failed';
  if (/interrupt|cancel|abort|stopp/.test(value)) return 'interrupted';
  if (/running|progress|pending|started/.test(value)) return 'running';
  return 'done';
}

/** Same counts as the Supervisor's summary of a folded turn (runtime service.rs). */
export function activityFromItems(items: readonly ThreadHistoryItemDto[]): ActivityCounts {
  const counts = { ...EMPTY };
  for (const item of items) {
    const key = KEY_BY_KIND[item.kind];
    if (!key) continue;
    counts[key] += 1;
    if (logStatus(item.status) === 'failed') counts.failed += 1;
    if (item.kind === 'fileChange') {
      counts.changedFiles += item.changedFiles ?? 0;
      counts.addedLines += item.addedLines ?? 0;
      counts.removedLines += item.removedLines ?? 0;
    }
  }
  return counts;
}

/** A folded turn reports the Supervisor's counts. Items streamed since then can
    only add to them, so each count is the larger of the two. */
export function turnActivity(
  turn: { hasDeferredItems?: boolean | null; activity?: ThreadTurnActivityDto | null },
  items: readonly ThreadHistoryItemDto[],
): ActivityCounts | null {
  const loaded = activityFromItems(items);
  if (!turn.hasDeferredItems) return loaded;
  if (!turn.activity) return hasActivity(loaded) ? loaded : null;
  const { files: _files, segments: _segments, ...server } = turn.activity;
  const counts = { ...EMPTY, ...server };
  for (const key of Object.keys(counts) as Array<keyof ActivityCounts>) counts[key] = Math.max(counts[key], loaded[key]);
  return counts;
}

export function hasActivity(counts: ActivityCounts | null): counts is ActivityCounts {
  return Boolean(counts && (counts.commands || counts.fileChanges || counts.reads || counts.searches || counts.tools || counts.agents || counts.reasoning));
}

export interface ActivityPart {
  key: string;
  text: string;
  tone?: 'add' | 'remove' | 'failed';
}

/** The words of a work summary, most telling first: edits, commands, then lookups. */
export function activityParts(counts: ActivityCounts, { lines = true }: { lines?: boolean } = {}): ActivityPart[] {
  const parts: ActivityPart[] = [];
  if (counts.fileChanges) {
    parts.push({ key: 'edits', text: translate('chat.logEdits', { count: counts.changedFiles || counts.fileChanges }) });
    if (lines && counts.addedLines) parts.push({ key: 'added', text: `+${counts.addedLines}`, tone: 'add' });
    if (lines && counts.removedLines) parts.push({ key: 'removed', text: `−${counts.removedLines}`, tone: 'remove' });
  }
  if (counts.commands) parts.push({ key: 'commands', text: translate('chat.commandCount', { count: counts.commands }) });
  if (counts.reads) parts.push({ key: 'reads', text: translate('chat.readFileCount', { count: counts.reads }) });
  if (counts.searches) parts.push({ key: 'searches', text: translate('chat.logSearches', { count: counts.searches }) });
  if (counts.agents) parts.push({ key: 'agents', text: translate('chat.logAgents', { count: counts.agents }) });
  if (counts.tools) parts.push({ key: 'tools', text: translate('chat.logTools', { count: counts.tools }) });
  if (!parts.length && counts.reasoning) parts.push({ key: 'reasoning', text: translate('chat.logThoughts', { count: counts.reasoning }) });
  if (counts.failed) parts.push({ key: 'failed', text: translate('chat.logFailed', { count: counts.failed }), tone: 'failed' });
  return parts;
}

/** Compact elapsed time: 8s, 1m 12s, 2h 5m. */
export function compactDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Elapsed time covered by a run of items, when their timestamps allow it. */
export function itemsDuration(items: readonly ThreadHistoryItemDto[]): number | null {
  let start = Infinity;
  let end = -Infinity;
  for (const item of items) {
    const created = Date.parse(item.createdAt ?? '');
    const updated = Date.parse(item.updatedAt ?? '');
    if (Number.isFinite(created)) { start = Math.min(start, created); end = Math.max(end, created); }
    if (Number.isFinite(updated)) end = Math.max(end, updated);
  }
  return Number.isFinite(start) && end > start ? end - start : null;
}

/** Tool details are stored as "Tool: …\n\nInput:\n…\n\nOutput:\n…"; the log shows the result. */
export function toolResultText(detail: string): string {
  const match = /\n\n(?:Output|Result):\n([\s\S]*)$/.exec(detail);
  if (!match) return detail.trim();
  const body = match[1]!.trim();
  if (body.startsWith('"') && body.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed === 'string') return parsed.trimEnd();
    } catch { /* not a JSON string literal */ }
  }
  return body.replace(/^```\w*\n([\s\S]*?)\n```$/, '$1');
}

/** Files a turn changed: the Supervisor's list for a folded turn, else the loaded edits. */
export function turnChangedFiles(
  turn: { hasDeferredItems?: boolean | null; activity?: ThreadTurnActivityDto | null },
  items: readonly ThreadHistoryItemDto[],
): ThreadTurnChangedFileDto[] {
  if (turn.hasDeferredItems) return turn.activity?.files ?? [];
  const files: ThreadTurnChangedFileDto[] = [];
  for (const item of items) {
    if (item.kind !== 'fileChange' || logStatus(item.status) === 'failed') continue;
    item.text.split(/,\s+/).filter(Boolean).forEach((path, index) => {
      const added = index === 0 ? item.addedLines ?? 0 : 0;
      const removed = index === 0 ? item.removedLines ?? 0 : 0;
      const file = files.find((entry) => entry.path === path);
      if (file) {
        file.itemId = item.id;
        file.addedLines = (file.addedLines ?? 0) + added;
        file.removedLines = (file.removedLines ?? 0) + removed;
      } else files.push({ path, itemId: item.id, addedLines: added, removedLines: removed });
    });
  }
  return files;
}

/** Counts of one stretch of work, ready for `activityParts`. */
export function segmentCounts(segment: ThreadTurnActivitySegmentDto): ActivityCounts {
  const { before: _before, startedAt: _startedAt, endedAt: _endedAt, ...counts } = segment;
  return { ...EMPTY, ...counts };
}

/** A folded turn can be told as narration between runs without loading its
    operations when its summary carries the narration every stretch precedes. */
export function storySegments(turn: {
  hasDeferredItems?: boolean | null;
  activity?: ThreadTurnActivityDto | null;
  items: readonly ThreadHistoryItemDto[];
}): ThreadTurnActivitySegmentDto[] | null {
  const segments = turn.activity?.segments;
  if (!turn.hasDeferredItems || !segments?.length) return null;
  const ids = new Set(turn.items.map((item) => item.id));
  return segments.every((segment) => segment.before === null || ids.has(segment.before)) ? segments : null;
}

/** Elapsed time of one stretch of work, when the Supervisor reported it. */
export function segmentDuration(segment: ThreadTurnActivitySegmentDto): number | null {
  const start = Date.parse(segment.startedAt ?? '');
  const end = Date.parse(segment.endedAt ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : null;
}
