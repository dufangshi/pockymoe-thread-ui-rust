import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import type { ThreadHistoryItemDetailDto, ThreadHistoryItemDto, ThreadTurnActivitySegmentDto, ThreadTurnChangedFileDto } from '@pockymoe/shared';

import { translate, useI18n } from '../../i18n';
import { DiffDetail } from '../DiffDetail';
import { GraphChatLinkifiedPlainText } from '../graph-chat/GraphChatMessageBody';
import {
  activityFromItems,
  activityParts,
  segmentCounts,
  segmentDuration,
  compactDuration,
  itemsDuration,
  logStatus,
  toolResultText,
  type ActivityPart,
} from './activity';

/* The transcript log: a run of agent operations folds into one summary line
   ("6 commands · edited 2 files +64 −3 · 38s"); opened, each operation is one
   row with a glyph, and a row opens its output, or its diff, in place. Details
   are loaded on demand and cached per item. */

type DetailLoader = (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;

export interface TranscriptLogActions {
  loadDetail?: DetailLoader | undefined;
  workspaceRoot?: string | undefined;
  openCommand: (item: ThreadHistoryItemDto & { kind: 'commandExecution' }, title: string) => void;
  openToolCall: (item: ThreadHistoryItemDto & { kind: 'toolCall' | 'agentToolCall' | 'skillToolCall' }, title: string) => void;
  openDeferred: (item: ThreadHistoryItemDto, title: string, fallbackText: string, loadingText: string, errorText: string) => void;
}

export const TranscriptLogContext = createContext<TranscriptLogActions | null>(null);

const LOG_KINDS = new Set<ThreadHistoryItemDto['kind']>([
  'commandExecution', 'fileChange', 'fileRead', 'webSearch', 'toolCall', 'agentToolCall', 'skillToolCall', 'reasoning',
]);

/** Items the log draws as rows; anything else keeps its own component. */
export function isLogItem(item: ThreadHistoryItemDto) {
  return LOG_KINDS.has(item.kind) && item.origin !== 'nativeTaskNotification' && item.origin !== 'nativeBackgroundWait';
}

const GLYPH: Partial<Record<ThreadHistoryItemDto['kind'], string>> = {
  commandExecution: '$',
  fileChange: '±',
  fileRead: '→',
  webSearch: '?',
  toolCall: '◇',
  skillToolCall: '✦',
  agentToolCall: '»',
  reasoning: '∴',
};

const DEFERRED_KINDS = new Set<ThreadHistoryItemDto['kind']>(['commandExecution', 'fileChange']);
const detailCache = new WeakMap<DetailLoader, Map<string, Promise<string>>>();
// Outputs can be large; keep the most recently opened ones.
const DETAIL_CACHE_SIZE = 120;

function useItemDetail(item: ThreadHistoryItemDto, enabled: boolean) {
  const actions = useContext(TranscriptLogContext);
  const loader = actions?.loadDetail;
  const inline = item.detailText?.trim() ? item.detailText : null;
  const loadable = Boolean(loader && !inline && (item.hasDeferredDetail || DEFERRED_KINDS.has(item.kind)));
  const key = `${item.id}:${item.status ?? ''}`;
  const live = logStatus(item.status) === 'running';
  const [state, setState] = useState<{ key: string; text?: string; error?: string } | null>(null);

  useEffect(() => {
    if (!enabled || !loadable || !loader) return;
    let active = true;
    let cache = detailCache.get(loader);
    if (!cache) {
      cache = new Map();
      detailCache.set(loader, cache);
    }
    let pending = live ? undefined : cache.get(key);
    if (!pending) {
      const request = Promise.resolve().then(() => loader(item.id)).then((detail) => detail.text);
      pending = request;
      if (!live) {
        cache.set(key, request);
        if (cache.size > DETAIL_CACHE_SIZE) cache.delete(cache.keys().next().value!);
        request.catch(() => cache!.delete(key));
      }
    }
    pending.then(
      (text) => { if (active) setState({ key, text }); },
      (error: unknown) => {
        if (active) setState({ key, error: error instanceof Error ? error.message : translate('chat.unableToLoadFullToolCallDetails') });
      },
    );
    return () => { active = false; };
  }, [enabled, loadable, loader, key, live, item.id]);

  if (inline) return { text: inline, loading: false, error: undefined };
  if (!loadable) return { text: null, loading: false, error: undefined };
  if (state?.key === key) return { text: state.text ?? null, loading: false, error: state.error };
  return { text: null, loading: enabled, error: undefined };
}

const PATH_MARKERS = ['/apps/', '/packages/', '/crates/', '/src/', '/tests/', '/docs/', '/scripts/', '/e2e/'];

/** Workspace-relative where possible, otherwise the last three path segments. */
export function displayPath(path: string, root?: string) {
  const value = path.trim().replace(/\\/g, '/');
  if (!value.startsWith('/')) return value.replace(/^\.\//, '');
  const base = root?.replace(/\\/g, '/').replace(/\/+$/, '');
  if (base && value.startsWith(`${base}/`)) return value.slice(base.length + 1);
  for (const marker of PATH_MARKERS) {
    const index = value.indexOf(marker);
    if (index >= 0) return value.slice(index + 1);
  }
  const segments = value.split('/').filter(Boolean);
  return segments.length > 3 ? `…/${segments.slice(-3).join('/')}` : value;
}

function firstLine(text: string) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  return { line: lines[0] ?? '', more: lines.length > 1 };
}

function rowTitle(item: ThreadHistoryItemDto, root?: string): { text: string; full: string; mono: boolean } {
  const full = item.text.trim();
  switch (item.kind) {
    case 'commandExecution': {
      const command = unwrapShellCommand(item.text);
      const { line, more } = firstLine(command);
      return { text: more ? `${line} …` : line, full: command.trim(), mono: true };
    }
    case 'fileChange': {
      const paths = item.text.split(/,\s+/).filter(Boolean);
      const unique = [...new Set(paths)];
      const shown = unique.slice(0, 2).map((path) => displayPath(path, root)).join(', ');
      return { text: unique.length > 2 ? `${shown} +${unique.length - 2}` : shown, full: unique.join('\n'), mono: true };
    }
    case 'fileRead':
      return { text: displayPath(item.previewText?.trim() || item.text, root), full, mono: true };
    case 'webSearch':
      return { text: (item.previewText?.trim() || item.text).replace(/^Web search:\s*/i, ''), full, mono: false };
    case 'reasoning':
      return { text: firstLine(item.text.replace(/\*\*/g, '')).line, full, mono: false };
    default:
      return { text: firstLine(item.text).line || item.kind, full, mono: item.kind !== 'agentToolCall' };
  }
}

const MAX_INLINE_CHARS = 16_000;
const MAX_DIFF_LINES = 120;

function clip(text: string) {
  if (text.length <= MAX_INLINE_CHARS) return text;
  return `${text.slice(0, MAX_INLINE_CHARS - 4_000)}\n…\n${text.slice(-4_000)}`;
}

/** One file's sections of a patch that may cover several files. */
export function diffForPath(text: string, path: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const starts = lines.flatMap((line, index) => line.startsWith('--- ') && lines[index + 1]?.startsWith('+++ ') ? [index] : []);
  if (starts.length < 2) return text;
  const kept = starts.flatMap((start, index) => {
    const target = lines[start + 1]!.slice(4).replace(/^b\//, '');
    return target === path || target.endsWith(`/${path}`) || path.endsWith(`/${target}`)
      ? lines.slice(start, starts[index + 1] ?? lines.length) : [];
  });
  return kept.length ? kept.join('\n') : text;
}

/** The first lines of a diff; DiffDetail's compact mode drops the file headers. */
function inlineDiff(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  while (lines.length && !lines.at(-1)!.trim()) lines.pop();
  return { text: lines.slice(0, MAX_DIFF_LINES).join('\n'), hidden: Math.max(0, lines.length - MAX_DIFF_LINES) };
}

/** Codex runs every command through `bash -lc "…"`; the log shows the command itself. */
export function unwrapShellCommand(command: string) {
  const match = /^(?:\/usr)?(?:\/bin\/)?(?:ba|z)?sh\s+-l?c\s+(['"])([\s\S]*)\1\s*$/.exec(command.trim());
  if (!match) return command;
  const body = match[2]!;
  return match[1] === "'" ? body.replace(/'\\''/g, "'") : body.replace(/\\(["\\$`])/g, '$1');
}

function statusTag(status: ReturnType<typeof logStatus>) {
  if (status === 'failed') return <span className="tlog-tag is-failed">{translate('chat.logFailedTag')}</span>;
  if (status === 'interrupted') return <span className="tlog-tag is-interrupted">{translate('chat.logInterrupted')}</span>;
  if (status === 'running') return <span className="tlog-spinner" role="img" aria-label={translate('chat.logRunning')} />;
  return null;
}

function openFull(actions: TranscriptLogActions | null, item: ThreadHistoryItemDto) {
  if (!actions) return;
  if (item.kind === 'commandExecution') {
    actions.openCommand(item as ThreadHistoryItemDto & { kind: 'commandExecution' }, translate('chat.commandOutput'));
  } else if (item.kind === 'toolCall' || item.kind === 'agentToolCall' || item.kind === 'skillToolCall') {
    actions.openToolCall(item as ThreadHistoryItemDto & { kind: 'toolCall' | 'agentToolCall' | 'skillToolCall' }, translate('chat.toolCallDetails'));
  } else if (item.kind === 'fileChange') {
    actions.openDeferred(item, translate('chat.fileChangeDetails'), item.detailText ?? item.text, translate('chat.loadingFileChanges'), translate('chat.unableToLoadFileChanges'));
  } else {
    actions.openDeferred(item, translate('chat.logActivity'), item.detailText?.trim() || item.text, translate('chat.logLoading'), translate('chat.unableToLoadFullToolCallDetails'));
  }
}

function RowDetail({ item, title, path }: { item: ThreadHistoryItemDto; title: { full: string; text: string }; path?: string }) {
  const actions = useContext(TranscriptLogContext);
  const isReasoning = item.kind === 'reasoning';
  const detail = useItemDetail(item, !isReasoning);
  const workspaceRoot = actions?.workspaceRoot;
  const formatPath = useCallback((path: string) => displayPath(path, workspaceRoot), [workspaceRoot]);
  const fullAction = !isReasoning && actions ? (
    <button type="button" className="tlog-open tlog-full" onClick={() => openFull(actions, item)}>{translate('chat.logOpenFull')}</button>
  ) : null;

  if (isReasoning) {
    return <div className="tlog-detail is-prose"><GraphChatLinkifiedPlainText text={item.text} /></div>;
  }
  if (detail.loading) return <div className="tlog-detail is-loading" role="status">{translate('chat.logLoading')}</div>;

  const text = detail.text ?? '';
  if (item.kind === 'fileChange' && /^@@ /m.test(text)) {
    const diff = inlineDiff(path ? diffForPath(text, path) : text);
    return (
      <div className="tlog-detail is-diff">
        <div className="tlog-diff"><DiffDetail text={diff.text} compact formatPath={formatPath} /></div>
        {diff.hidden || fullAction ? (
          <div className="tlog-detail-foot">
            {diff.hidden ? <span>{translate('chat.logDiffMore', { count: diff.hidden })}</span> : null}
            {fullAction}
          </div>
        ) : null}
      </div>
    );
  }

  const command = item.kind === 'commandExecution' && title.full !== title.text.replace(/ …$/, '') ? title.full : null;
  const output = detail.error ?? (text ? toolResultText(text) : '');
  return (
    <div className="tlog-detail">
      {command ? <pre className="tlog-command">{command}</pre> : null}
      {output ? <pre className={`tlog-output${detail.error ? ' is-error' : ''}`}>{clip(output)}</pre>
        : command ? null : <p className="tlog-empty">{translate('chat.logNoOutput')}</p>}
      <div className="tlog-detail-foot">
        {item.kind === 'commandExecution' ? <CopyText text={title.full} /> : null}
        {fullAction}
      </div>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="tlog-open tlog-copy" onClick={() => {
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }, () => undefined);
    }}>
      {copied ? translate('chat.copied') : translate('chat.logCopyCommand')}
    </button>
  );
}

export const LogRow = memo(function LogRow({ item, defaultOpen = false }: { item: ThreadHistoryItemDto; defaultOpen?: boolean }) {
  useI18n();
  const actions = useContext(TranscriptLogContext);
  const [open, setOpen] = useState(defaultOpen);
  const status = logStatus(item.status);
  const title = rowTitle(item, actions?.workspaceRoot);
  return (
    <div className="tlog-row" data-kind={item.kind} data-status={status} data-open={open || undefined}>
      <button type="button" className="tlog-row-head" aria-expanded={open} onClick={() => setOpen((value) => !value)} title={title.full}>
        <span className="tlog-glyph" aria-hidden="true">{GLYPH[item.kind] ?? '·'}</span>
        <span className={`tlog-title${title.mono ? ' is-mono' : ''}`}>{title.text}</span>
        {item.kind === 'fileChange' ? <DeltaBadges added={item.addedLines} removed={item.removedLines} /> : null}
        {statusTag(status)}
      </button>
      {open ? <RowDetail item={item} title={title} /> : null}
    </div>
  );
});

function DeltaBadges({ added, removed }: { added?: number | null | undefined; removed?: number | null | undefined }) {
  if (!added && !removed) return null;
  return (
    <span className="tlog-delta">
      {added ? <span className="is-add">+{added}</span> : null}
      {removed ? <span className="is-remove">−{removed}</span> : null}
    </span>
  );
}

/** Three or more reads in a row are one line; opened, it lists the files. */
function ReadBatch({ items }: { items: ThreadHistoryItemDto[] }) {
  const actions = useContext(TranscriptLogContext);
  const [open, setOpen] = useState(false);
  return (
    <div className="tlog-row" data-kind="fileRead" data-batch="true" data-open={open || undefined}>
      <button type="button" className="tlog-row-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="tlog-glyph" aria-hidden="true">→</span>
        <span className="tlog-title">{translate('chat.readFileCount', { count: items.length })}</span>
        <span className="tlog-batch-names">{items.map((item) => displayPath(item.previewText?.trim() || item.text, actions?.workspaceRoot).split('/').at(-1)).join('  ')}</span>
      </button>
      {open ? <div className="tlog-batch">{items.map((item) => <LogRow key={item.id} item={item} />)}</div> : null}
    </div>
  );
}

type RowBlock =
  | { kind: 'item'; item: ThreadHistoryItemDto }
  | { kind: 'reads'; items: ThreadHistoryItemDto[] };

function rowBlocks(items: ThreadHistoryItemDto[]): RowBlock[] {
  const blocks: RowBlock[] = [];
  let index = 0;
  while (index < items.length) {
    const item = items[index]!;
    if (item.kind === 'fileRead') {
      let end = index;
      while (end < items.length && items[end]!.kind === 'fileRead') end += 1;
      if (end - index >= 3) {
        blocks.push({ kind: 'reads', items: items.slice(index, end) });
        index = end;
        continue;
      }
    }
    blocks.push({ kind: 'item', item });
    index += 1;
  }
  return blocks;
}

function Parts({ parts }: { parts: ActivityPart[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={part.key} className={`tlog-part${part.tone ? ` is-${part.tone}` : ''}`}>
          {index > 0 && !part.tone?.match(/add|remove/) ? <span className="tlog-sep" aria-hidden="true">·</span> : index > 0 ? ' ' : null}
          {part.text}
        </span>
      ))}
    </>
  );
}

/** Follows a label such as "Worked for 51s", so it opens with a separator. */
export function ActivitySummary({ parts }: { parts: ActivityPart[] }) {
  if (!parts.length) return null;
  return <span className="tlog-summary"><span className="tlog-sep is-lead" aria-hidden="true">·</span><Parts parts={parts} /></span>;
}

const INITIAL_ROWS = 40;
const LIVE_ROWS = 8;
const OPEN_DIFFS = 3;
const OPEN_DIFF_LINES = 40;

/** Small edits show their diff as soon as the run opens; large ones wait for a click. */
export function opensDiff(item: ThreadHistoryItemDto) {
  if (item.kind !== 'fileChange') return false;
  const lines = (item.addedLines ?? 0) + (item.removedLines ?? 0);
  return lines > 0 && lines <= OPEN_DIFF_LINES;
}

/** One run of operations between two messages. */
export const LogRun = memo(function LogRun({
  items,
  expanded,
  onToggle,
  live = false,
}: {
  items: ThreadHistoryItemDto[];
  expanded: boolean;
  onToggle: () => void;
  live?: boolean;
}) {
  useI18n();
  const counts = useMemo(() => activityFromItems(items), [items]);
  const parts = activityParts(counts);
  const running = items.some((item) => logStatus(item.status) === 'running');
  const duration = itemsDuration(items);
  const blocks = useMemo(() => rowBlocks(items), [items]);
  const openDiffs = useMemo(() => new Set(items.filter(opensDiff).slice(0, OPEN_DIFFS).map((item) => item.id)), [items]);
  const [revealed, setRevealed] = useState(false);
  const limit = live ? LIVE_ROWS : INITIAL_ROWS;
  const hidden = revealed ? 0 : Math.max(0, blocks.length - limit);
  const shown = hidden ? (live ? blocks.slice(-limit) : blocks.slice(0, limit)) : blocks;
  const more = hidden ? (
    <button type="button" className="tlog-more" onClick={() => setRevealed(true)}>{translate('chat.logShowAll', { count: hidden })}</button>
  ) : null;

  return (
    <section className="tlog-run" data-open={expanded || undefined} data-running={running || undefined} data-failed={counts.failed > 0 || undefined}>
      <button type="button" className="tlog-run-head" aria-expanded={expanded} onClick={onToggle}>
        <ChevronRight className="tlog-chev" aria-hidden="true" />
        <span className="tlog-summary">
          {parts.length ? <Parts parts={parts} /> : translate('chat.operationCount', { count: items.length })}
          {duration && !running ? <span className="tlog-part is-time"><span className="tlog-sep" aria-hidden="true">·</span>{compactDuration(duration)}</span> : null}
        </span>
        {running ? <span className="tlog-spinner" role="img" aria-label={translate('chat.logRunning')} /> : null}
        <span className="tlog-rule" aria-hidden="true" />
      </button>
      {expanded ? (
        <div className="tlog-run-body">
          {live ? more : null}
          {shown.map((block) => block.kind === 'reads'
            ? <ReadBatch key={block.items[0]!.id} items={block.items} />
            : <LogRow key={block.item.id} item={block.item} defaultOpen={openDiffs.has(block.item.id)} />)}
          {live ? null : more}
        </div>
      ) : null}
    </section>
  );
});

const FILE_CHIPS = 4;
const FILE_CHIPS_NARROW = 2;

/** "± queue-store.ts +2 −1  server.ts +5": the files a folded turn changed. A name
    opens that file's latest diff right below; the rest of the work stays folded. */
export function ChangedFiles({ files, total }: { files: ThreadTurnChangedFileDto[]; total?: number }) {
  useI18n();
  const actions = useContext(TranscriptLogContext);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!files.length) return null;
  const shown = all ? files : files.slice(0, FILE_CHIPS);
  const hidden = Math.max(files.length, total ?? 0) - shown.length;
  const selected = files.find((file) => file.path === open);
  const item: ThreadHistoryItemDto | null = selected ? {
    id: selected.itemId, kind: 'fileChange', text: selected.path, status: 'completed', hasDeferredDetail: true,
    addedLines: selected.addedLines ?? null, removedLines: selected.removedLines ?? null,
  } : null;
  return (
    <div className="tlog-files">
      <div className="tlog-files-row" data-all={all || undefined}>
        <span className="tlog-glyph" aria-hidden="true">±</span>
        {shown.map((file) => {
          const path = displayPath(file.path, actions?.workspaceRoot);
          return (
            <button key={file.path} type="button" className="tlog-file" aria-expanded={open === file.path} title={path}
              onClick={() => setOpen((current) => current === file.path ? null : file.path)}>
              <span className="tlog-file-name">{path.split('/').at(-1)}</span>
              <DeltaBadges added={file.addedLines} removed={file.removedLines} />
            </button>
          );
        })}
        {/* Phones show two names; each width gets its own count of the rest. */}
        {[{ width: 'wide', count: hidden }, { width: 'narrow', count: all ? hidden : hidden + Math.max(0, shown.length - FILE_CHIPS_NARROW) }].map(({ width, count }) => count > 0 ? (
          !all && files.length > FILE_CHIPS_NARROW
            ? <button key={width} type="button" className={`tlog-files-more is-${width}`} onClick={() => setAll(true)}>+{count}</button>
            : <span key={width} className={`tlog-files-more is-${width}`}>+{count}</span>
        ) : null)}
      </div>
      {item ? <RowDetail key={item.text} item={item} title={{ full: item.text, text: item.text }} path={item.text} /> : null}
    </div>
  );
}

/** A run of a folded turn whose operations are not loaded yet: its summary line
    only. Opening it loads the turn and opens the matching run in place. */
export function RunPlaceholder({ segment, loading, onOpen }: {
  segment: ThreadTurnActivitySegmentDto;
  loading: boolean;
  onOpen: () => void;
}) {
  useI18n();
  const parts = activityParts(segmentCounts(segment));
  const duration = segmentDuration(segment);
  return (
    <section className="tlog-run" data-placeholder="true">
      <button type="button" className="tlog-run-head" aria-expanded={false} aria-busy={loading} disabled={loading} onClick={onOpen}>
        <ChevronRight className="tlog-chev" aria-hidden="true" />
        <span className="tlog-summary">
          {parts.length ? <Parts parts={parts} /> : translate('chat.logActivity')}
          {duration ? <span className="tlog-part is-time"><span className="tlog-sep" aria-hidden="true">·</span>{compactDuration(duration)}</span> : null}
        </span>
        {loading ? <span className="tlog-spinner" role="img" aria-label={translate('chat.logLoading')} /> : null}
        <span className="tlog-rule" aria-hidden="true" />
      </button>
    </section>
  );
}
