import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Copy } from 'lucide-react';

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
import { Collapse } from './Collapse';
import { ActivityCount, countedPart } from './ActivityCount';

/* The transcript log: a run of agent operations folds into one summary line
   ("6 commands · edited 2 files +64 −3 · 38s"); opened, each operation is one
   row with a glyph, and a row opens its output, or its diff, in place. Details
   are loaded on demand and cached per item. */

type DetailLoader = (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;

export interface TranscriptLogActions {
  loadDetail?: DetailLoader | undefined;
  workspaceRoot?: string | undefined;
  /** The floating viewer for a whole output or diff. */
  openText: (title: string, text: string, kind?: string) => void;
  /** Keeps the control the reader used in place while what it toggles resizes. */
  anchor?: ((element?: Element | null) => void) | undefined;
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

/** A clipped output or diff; clicking it shows the whole text in the floating viewer. */
function Viewable({ className, label, onOpen, more, children }: {
  className: string;
  label: string;
  onOpen?: (() => void) | undefined;
  more?: string | null;
  children: ReactNode;
}) {
  if (!onOpen) return <div className={className}>{children}</div>;
  // Selecting text inside the block does not open the viewer.
  const open = () => { if (!window.getSelection()?.toString()) onOpen(); };
  return (
    <div className={`${className} tlog-viewable`} role="button" tabIndex={0} aria-label={label} title={label}
      onClick={open} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}>
      {children}
      {more ? <span className="tlog-more-lines">{more}</span> : null}
    </div>
  );
}

function RowDetail({ item, title, path }: { item: ThreadHistoryItemDto; title: { full: string; text: string }; path?: string }) {
  const actions = useContext(TranscriptLogContext);
  const isReasoning = item.kind === 'reasoning';
  const detail = useItemDetail(item, !isReasoning);
  const workspaceRoot = actions?.workspaceRoot;
  const formatPath = useCallback((path: string) => displayPath(path, workspaceRoot), [workspaceRoot]);

  if (isReasoning) {
    return <div className="tlog-detail is-prose"><GraphChatLinkifiedPlainText text={item.text} /></div>;
  }
  if (detail.loading) return <div className="tlog-detail is-loading" role="status">{translate('chat.logLoading')}</div>;

  const text = detail.text ?? '';
  const viewTitle = item.kind === 'fileChange' ? displayPath(path ?? title.full.split('\n')[0] ?? '', workspaceRoot) : title.text.replace(/ …$/, '');
  if (item.kind === 'fileChange' && /^@@ /m.test(text)) {
    const whole = path ? diffForPath(text, path) : text;
    const diff = inlineDiff(whole);
    return (
      <div className="tlog-detail is-diff">
        <Viewable className="tlog-diff" label={translate('chat.logOpenFull')} onOpen={actions ? () => actions.openText(viewTitle, whole, 'fileChange') : undefined}
          more={diff.hidden ? translate('chat.logDiffMore', { count: diff.hidden }) : null}>
          <DiffDetail text={diff.text} compact formatPath={formatPath} />
        </Viewable>
      </div>
    );
  }

  const command = item.kind === 'commandExecution' && title.full !== title.text.replace(/ …$/, '') ? title.full : null;
  const output = detail.error ?? (text ? toolResultText(text) : '');
  const clipped = clip(output);
  const whole = item.kind === 'commandExecution' ? `$ ${title.full}\n\n${output}` : text || output;
  return (
    <div className="tlog-detail">
      {command ? <pre className="tlog-command">{command}</pre> : null}
      {output ? (
        <Viewable className={`tlog-output${detail.error ? ' is-error' : ''}`} label={translate('chat.logOpenFull')}
          onOpen={actions && !detail.error ? () => actions.openText(viewTitle, whole) : undefined}>
          <pre>{clipped}</pre>
        </Viewable>
      ) : command ? null : <p className="tlog-empty">{translate('chat.logNoOutput')}</p>}
    </div>
  );
}

/** Copies a command; it appears beside its row on hover, and on phones once the row is open. */
function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="tlog-copy" aria-label={translate('chat.logCopyCommand')} title={copied ? translate('chat.copied') : translate('chat.logCopyCommand')}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }, () => undefined);
      }}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  );
}

export const LogRow = memo(function LogRow({ item, defaultOpen = false, path }: { item: ThreadHistoryItemDto; defaultOpen?: boolean; path?: string }) {
  useI18n();
  const actions = useContext(TranscriptLogContext);
  // An edit the turn is making shows open and folds once the turn moves on,
  // unless the reader has opened or closed it.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? defaultOpen;
  const status = logStatus(item.status);
  const title = rowTitle(item, actions?.workspaceRoot);
  return (
    <div className="tlog-row" data-kind={item.kind} data-status={status} data-open={open || undefined}>
      <div className="tlog-row-line">
        <button type="button" className="tlog-row-head" aria-expanded={open} onClick={(event) => { actions?.anchor?.(event.currentTarget); setChosen(!open); }} title={title.full}>
          <span className="tlog-glyph" aria-hidden="true">{GLYPH[item.kind] ?? '·'}</span>
          <span className={`tlog-title${title.mono ? ' is-mono' : ''}`}>{title.text}</span>
          {item.kind === 'fileChange' ? <DeltaBadges added={item.addedLines} removed={item.removedLines} /> : null}
          {statusTag(status)}
        </button>
        {item.kind === 'commandExecution' ? <CopyCommand text={title.full} /> : null}
      </div>
      <Collapse open={open}><RowDetail item={item} title={title} {...(path ? { path } : {})} /></Collapse>
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
      <div className="tlog-row-line">
        <button type="button" className="tlog-row-head" aria-expanded={open} onClick={(event) => { actions?.anchor?.(event.currentTarget); setOpen((value) => !value); }}>
          <span className="tlog-glyph" aria-hidden="true">→</span>
          <span className="tlog-title">{translate('chat.readFileCount', { count: items.length })}</span>
          <span className="tlog-batch-names">{items.map((item) => displayPath(item.previewText?.trim() || item.text, actions?.workspaceRoot).split('/').at(-1)).join('  ')}</span>
        </button>
      </div>
      <Collapse open={open}><div className="tlog-batch">{items.map((item) => <LogRow key={item.id} item={item} />)}</div></Collapse>
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

/** Edits read as words ("edited 2 files +64 −3"); counts as icons with numbers,
    side by side after one separator. */
export function Parts({ parts }: { parts: ActivityPart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        const previous = parts[index - 1];
        if (countedPart(part)) {
          return (
            <span key={part.key} className="tlog-part is-count">
              {previous && !countedPart(previous) ? <span className="tlog-sep" aria-hidden="true">·</span> : null}
              <ActivityCount part={part} />
            </span>
          );
        }
        return (
          <span key={part.key} className={`tlog-part${part.tone ? ` is-${part.tone}` : ''}`}>
            {index > 0 && !part.tone?.match(/add|remove/) ? <span className="tlog-sep" aria-hidden="true">·</span> : index > 0 ? ' ' : null}
            {part.text}
          </span>
        );
      })}
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
  const actions = useContext(TranscriptLogContext);
  const counts = useMemo(() => activityFromItems(items), [items]);
  const parts = activityParts(counts);
  const running = items.some((item) => logStatus(item.status) === 'running');
  const duration = itemsDuration(items);
  const blocks = useMemo(() => rowBlocks(items), [items]);
  // Only the run being worked on shows its edits; finished runs keep them folded.
  const openDiffs = useMemo(() => new Set(live ? items.filter(opensDiff).slice(0, OPEN_DIFFS).map((item) => item.id) : []), [items, live]);
  const [revealed, setRevealed] = useState(false);
  const limit = live ? LIVE_ROWS : INITIAL_ROWS;
  const hidden = revealed ? 0 : Math.max(0, blocks.length - limit);
  const shown = hidden ? (live ? blocks.slice(-limit) : blocks.slice(0, limit)) : blocks;
  const more = hidden ? (
    <button type="button" className="tlog-more" onClick={() => setRevealed(true)}>{translate('chat.logShowAll', { count: hidden })}</button>
  ) : null;

  return (
    <section className="tlog-run" data-open={expanded || undefined} data-running={running || undefined} data-failed={counts.failed > 0 || undefined}>
      <button type="button" className="tlog-run-head" aria-expanded={expanded} onClick={(event) => { actions?.anchor?.(event.currentTarget); onToggle(); }}>
        <ChevronRight className="tlog-chev" aria-hidden="true" />
        <span className="tlog-summary">
          {parts.length ? <Parts parts={parts} /> : translate('chat.operationCount', { count: items.length })}
          {duration && !running ? <span className="tlog-part is-time"><span className="tlog-sep" aria-hidden="true">·</span>{compactDuration(duration)}</span> : null}
        </span>
        {running ? <span className="tlog-spinner" role="img" aria-label={translate('chat.logRunning')} /> : null}
        <span className="tlog-rule" aria-hidden="true" />
      </button>
      <Collapse open={expanded}>
        <div className="tlog-run-body">
          {live ? more : null}
          {shown.map((block) => block.kind === 'reads'
            ? <ReadBatch key={block.items[0]!.id} items={block.items} />
            : <LogRow key={block.item.id} item={block.item} defaultOpen={openDiffs.has(block.item.id)} />)}
          {live ? null : more}
        </div>
      </Collapse>
    </section>
  );
});

/** The files a turn changed, opened from its work line without opening the work:
    one row each, the first few small edits showing their diff. */
export function ChangedFiles({ files, total }: { files: ThreadTurnChangedFileDto[]; total?: number }) {
  useI18n();
  if (!files.length) return null;
  const small = new Set(files.filter((file) => opensDiff({ id: file.itemId, kind: 'fileChange', text: file.path, addedLines: file.addedLines ?? null, removedLines: file.removedLines ?? null }))
    .slice(0, OPEN_DIFFS).map((file) => file.path));
  const more = Math.max(0, (total ?? 0) - files.length);
  return (
    <div className="tlog-files">
      {files.map((file) => (
        <LogRow key={file.path} path={file.path} defaultOpen={small.has(file.path)} item={{
          id: file.itemId, kind: 'fileChange', text: file.path, status: 'completed', hasDeferredDetail: true,
          addedLines: file.addedLines ?? null, removedLines: file.removedLines ?? null,
        }} />
      ))}
      {more ? <p className="tlog-files-more">{translate('chat.logMoreFiles', { count: more })}</p> : null}
    </div>
  );
}

/** A run of a folded turn whose operations are not loaded yet: its summary line
    only. Opening it loads the turn and opens the matching run in place. */
export function RunPlaceholder({ segment, loading, onOpen, open = false }: {
  segment: ThreadTurnActivitySegmentDto;
  loading: boolean;
  onOpen: () => void;
  /** Its work is shown under it (a folded turn's stretch opened in place). */
  open?: boolean;
}) {
  useI18n();
  const actions = useContext(TranscriptLogContext);
  const parts = activityParts(segmentCounts(segment));
  const duration = segmentDuration(segment);
  return (
    <section className="tlog-run" data-placeholder="true" data-open={open || undefined}>
      <button type="button" className="tlog-run-head" aria-expanded={open} aria-busy={loading} disabled={loading} onClick={(event) => { actions?.anchor?.(event.currentTarget); onOpen(); }}>
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
