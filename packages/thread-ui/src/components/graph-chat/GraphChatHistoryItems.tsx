import { translate, useI18n } from '../../i18n';
import {
  memo,
  useContext,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  BellRing,
  Hourglass,
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FilePenLine,
  FileText,
  Image as ImageIconLucide,
  Info,
  Loader2,
  PackageOpen,
  Search,
  Sparkles,
  Terminal,
  Webhook,
  Wrench,
  XCircle,
} from 'lucide-react';

import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { usePlugins } from '../../plugins/usePlugins';
import type { ThreadTimelineAdapter } from '../../adapters';
import { GraphWorkspaceImageLightbox } from '../ZoomableImage';
import {
  GraphChatLinkifiedPlainText,
  GraphChatMarkdownAwareBody,
} from './GraphChatMessageBody';
import { GraphChatHistoryGroupFrame } from './GraphChatHistoryGroupFrame';
import { Badge } from '../graph-ui/Badge';
import { WorkbenchContext } from '../WorkbenchContext';

interface ContextCompactionHistoryItem extends ThreadHistoryItemDto {
  kind: 'contextCompaction';
}

type GetImageAssetUrl = NonNullable<ThreadTimelineAdapter['getImageAssetUrl']>;

interface CommandHistoryItem extends ThreadHistoryItemDto {
  kind: 'commandExecution';
}

interface FileChangeHistoryItem extends ThreadHistoryItemDto {
  kind: 'fileChange';
}

interface SearchHistoryItem extends ThreadHistoryItemDto {
  kind: 'webSearch';
}

interface FileReadHistoryItem extends ThreadHistoryItemDto {
  kind: 'fileRead';
}

type ToolActivityHistoryItem = ThreadHistoryItemDto & {
  kind: 'toolCall' | 'agentToolCall' | 'skillToolCall';
};

function isRunningHistoryStatus(status?: string | null) {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'running' ||
    normalized === 'in_progress' ||
    normalized === 'in progress' ||
    normalized === 'pending'
  );
}

function FileChangeIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2.75h4l2 2v6.5a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 11.25v-7A1.5 1.5 0 0 1 5.5 2.75Z" />
      <path d="M9 2.75v2h2" />
      <path d="M6.2 8h3.6" />
      <path d="M6.2 10h1.7" />
    </svg>
  );
}

function FileReadIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2.75h4l2 2v6.5a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 4 11.25v-7A1.5 1.5 0 0 1 5.5 2.75Z" />
      <path d="M9 2.75v2h2" />
      <path d="M6.15 7.25h3.7" />
      <path d="M6.15 9.25h2.8" />
      <path d="m10.4 10.7 1.2 1.2" />
      <circle cx="9.25" cy="9.55" r="1.45" />
    </svg>
  );
}

function CommandBatchIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.75" y="3" width="8.5" height="3" rx="1.1" />
      <rect x="4.25" y="6.5" width="8.5" height="3" rx="1.1" />
      <rect x="5.75" y="10" width="7.5" height="3" rx="1.1" />
      <path d="m6.25 4.5 1 1-1 1" />
      <path d="M7.9 5.5h1.7" />
      <path d="m7.75 8 1 1-1 1" />
      <path d="M9.4 9h1.7" />
    </svg>
  );
}

function SearchBatchIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="2.3" />
      <path d="m8 8 1.6 1.6" />
      <circle cx="9.3" cy="8.8" r="2" />
      <path d="m10.75 10.25 1.65 1.65" />
      <circle cx="11.2" cy="4.75" r="1.8" />
      <path d="m12.45 6 1.1 1.1" />
    </svg>
  );
}

function projectRelativePathLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) {
    return '';
  }

  const suffixMatch = normalized.match(/(, \+\d+ more.*)$/);
  const suffix = suffixMatch?.[1] ?? '';
  const base = suffix ? normalized.slice(0, -suffix.length) : normalized;
  const slashNormalized = base.replace(/\\/g, '/');
  if (!slashNormalized.startsWith('/')) {
    return `${slashNormalized.replace(/^\.\//, '')}${suffix}`;
  }

  const markers = [
    '/apps/',
    '/packages/',
    '/src/',
    '/test/',
    '/tests/',
    '/docs/',
    '/config/',
    '/scripts/',
    '/e2e/',
    '/.agents/',
    '/.codex/',
  ];
  for (const marker of markers) {
    const markerIndex = slashNormalized.indexOf(marker);
    if (markerIndex >= 0) {
      return `${slashNormalized.slice(markerIndex + 1)}${suffix}`;
    }
  }

  return normalized;
}

function formatTrailingPathLabel(label: string, maxLength = 42) {
  const normalized = projectRelativePathLabel(label);
  if (!normalized) {
    return '';
  }

  const suffixMatch = normalized.match(/(, \+\d+ more.*)$/);
  const suffix = suffixMatch?.[1] ?? '';
  const base = suffix ? normalized.slice(0, -suffix.length) : normalized;
  if (base.length <= maxLength) {
    return `${base}${suffix}`;
  }

  const normalizedSeparators = base.replace(/\\/g, '/');
  const segments = normalizedSeparators.split('/').filter(Boolean);
  if (segments.length > 1) {
    const keptSegments: string[] = [];
    let currentLength = suffix.length + 4;

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const candidate = segments[index]!;
      const nextLength =
        currentLength + candidate.length + (keptSegments.length > 0 ? 1 : 0);
      if (keptSegments.length > 0 && nextLength > maxLength) {
        break;
      }
      keptSegments.unshift(candidate);
      currentLength = nextLength;
    }

    if (keptSegments.length > 0) {
      return `.../${keptSegments.join('/')}${suffix}`;
    }
  }

  return `...${base.slice(-(maxLength - suffix.length - 3))}${suffix}`;
}

function fileChangeSummarySegments(
  item: ThreadHistoryItemDto & { kind: 'fileChange' },
) {
  const segments: string[] = [];

  if (typeof item.changedFiles === 'number' && item.changedFiles > 0) {
    segments.push(
      `${item.changedFiles} ${item.changedFiles === 1 ? 'file' : 'files'}`,
    );
  }
  if (typeof item.addedLines === 'number' && item.addedLines > 0) {
    segments.push(`+${item.addedLines}`);
  }
  if (typeof item.removedLines === 'number' && item.removedLines > 0) {
    segments.push(`-${item.removedLines}`);
  }

  if (segments.length > 0) {
    return segments;
  }

  const fallback = item.previewText?.trim();
  if (!fallback) {
    return [];
  }

  return fallback
    .replace(/\bfiles changed\b/gi, 'files')
    .replace(/\bfile changed\b/gi, 'file')
    .split('·')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function RunningDots({
  tone = 'amber',
}: {
  tone?: 'amber' | 'emerald' | 'sky';
}) {
  const { locale: i18nLocale } = useI18n();
  const dotClassName =
    tone === 'emerald'
      ? 'bg-sky-200/90'
      : tone === 'sky'
        ? 'bg-sky-300/90'
        : 'bg-amber-200/90';

  return (
    <span className="ml-1.5 inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 animate-pulse rounded-full ${dotClassName}`}
          style={{ animationDelay: `${index * 180}ms` }}
        />
      ))}
    </span>
  );
}

function normalizeLines(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  while (lines.length > 1 && lines.at(-1)?.trim() === '') {
    lines.pop();
  }

  return lines;
}

function summarizeInlinePreviewText(text: string) {
  const lines = normalizeLines(text);

  if (lines.length === 1) {
    return {
      firstLine: lines[0] ?? '',
      showGap: false,
      isTruncated: false,
    };
  }

  return {
    firstLine: lines[0] ?? '',
    showGap: true,
    isTruncated: true,
  };
}

type GraphHistoryToolTone =
  | 'command'
  | 'tool'
  | 'agent'
  | 'skill'
  | 'search'
  | 'fileRead';

type GraphHistoryEventTone =
  | 'plan'
  | 'context'
  | 'generic'
  | 'image'
  | 'fileChange'
  | 'artifact'
  | 'hook';

function graphHistoryStatusConfig(status?: string | null) {
  const normalized = status?.trim().toLowerCase() ?? '';

  if (
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'success' ||
    normalized === 'succeeded'
  ) {
    return {
      className: 'is-completed',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: translate("chat.completed"),
    };
  }

  if (
    normalized === 'failed' ||
    normalized === 'failure' ||
    normalized === 'error' ||
    normalized === 'errored'
  ) {
    return {
      className: 'is-failed',
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: translate("chat.failed"),
    };
  }

  if (isRunningHistoryStatus(status)) {
    return {
      className: 'is-pending',
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: status?.trim() || translate("chat.running"),
    };
  }

  return {
    className: 'is-neutral',
    icon: null,
    label: status?.trim() || translate("chat.event"),
  };
}

function graphHistoryToneClassName(tone: GraphHistoryToolTone) {
  switch (tone) {
    case 'command':
      return 'is-command';
    case 'tool':
      return 'is-tool';
    case 'agent':
      return 'is-agent';
    case 'skill':
      return 'is-skill';
    case 'search':
      return 'is-search';
    case 'fileRead':
      return 'is-file-read';
  }
}

function graphHistoryEventToneClassName(tone: GraphHistoryEventTone) {
  switch (tone) {
    case 'plan':
      return 'is-plan';
    case 'context':
      return 'is-context';
    case 'generic':
      return 'is-generic';
    case 'image':
      return 'is-image';
    case 'fileChange':
      return 'is-file-change';
    case 'artifact':
      return 'is-artifact';
    case 'hook':
      return 'is-hook';
  }
}

function GraphChatHistoryEventFrame({
  actions,
  children,
  className,
  headerMeta,
  icon,
  item,
  timeMeta,
  title,
  tone,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerMeta?: ReactNode;
  icon: ReactNode;
  item: ThreadHistoryItemDto;
  timeMeta?: ReactNode;
  title: string;
  tone: GraphHistoryEventTone;
}) {
  const { locale: i18nLocale } = useI18n();
  const statusConfig = graphHistoryStatusConfig(item.status);
  const showStatus = Boolean(
    statusConfig.className === 'is-pending' || statusConfig.className === 'is-failed',
  );

  return (
    <div
      className={`thread-graph-event thread-graph-history-event ${graphHistoryEventToneClassName(
        tone,
      )} ${className ?? ''}`}
    >
      <div className="thread-graph-history-event-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="thread-graph-history-event-card">
        <div className="thread-graph-history-event-header">
          <div className="thread-graph-history-event-heading flex min-w-0 items-center gap-2">
            <span className="thread-graph-history-event-title min-w-0 truncate font-mono text-sm font-semibold">
              {title}
            </span>
            {item.status && showStatus ? (
              <Badge
                variant="outline"
                className={`thread-graph-tool-badge ${statusConfig.className} rounded-full px-2 py-0.5 text-xs font-normal`}
                title={statusConfig.label}
                aria-label={translate("chat.status", { value1: statusConfig.label })}
              >
                {statusConfig.icon}
                <span className="thread-graph-status-label">
                  {statusConfig.label}
                </span>
              </Badge>
            ) : null}
            {headerMeta}
          </div>
          {actions || timeMeta ? (
            <div className="thread-graph-history-event-actions">
              {actions}
              {timeMeta}
            </div>
          ) : null}
        </div>
        {children ? (
          <div className="thread-graph-history-event-body">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

function GraphChatHistoryToolFrame({
  actionLabel = translate("chat.openDetails"), className, icon, item, onOpen, preview, timeMeta, title, tone,
}: {
  actionLabel?: string;
  actionTitle: string;
  autoOpen?: boolean;
  className?: string;
  details?: ReactNode;
  icon: ReactNode;
  item: ThreadHistoryItemDto;
  onOpen: () => void;
  preview: ReturnType<typeof summarizeInlinePreviewText>;
  timeMeta?: ReactNode;
  title: string;
  tone: GraphHistoryToolTone;
}) {
  const { locale: i18nLocale } = useI18n();
  const status = graphHistoryStatusConfig(item.status);
  const [pathExpanded, setPathExpanded] = useState(false);
  const isRead = tone === 'fileRead';
  // Paths are clipped from the start (rtl); isolating them keeps the leading slash in place.
  return (
    <div className={`thread-graph-event thread-graph-history-tool ${graphHistoryToneClassName(tone)} ${className ?? ''}`}>
      <div className="thread-history-direct-row">
        <button type="button" aria-label={isRead ? translate("chat.showFullFilePath") : actionLabel}
          aria-expanded={isRead ? pathExpanded : undefined}
          onClick={isRead ? () => setPathExpanded(value => !value) : onOpen}
          className="thread-history-direct-action">
          <span className="thread-graph-history-tool-icon">{icon}</span>
          <span className="thread-graph-history-tool-label">{title}</span>
          <span title={preview.firstLine} className={`thread-history-direct-preview ${isRead ? 'is-path' : ''} ${pathExpanded ? 'is-expanded' : ''}`}>
            {isRead ? <bdi>{preview.firstLine}</bdi> : preview.firstLine}
          </span>
          <span className={`matter-step-status ${status.className}`} aria-label={status.label}>{status.icon}</span>
        </button>
        {timeMeta}
      </div>
    </div>
  );
}

export const GraphChatPlanHistoryItem = memo(function GraphChatPlanHistoryItem({
  item,
  scrollRootRef,
  onBeforeResize,
  timeMeta,
}: {
  item: ThreadHistoryItemDto & { kind: 'plan' };
  scrollRootRef: RefObject<HTMLDivElement | null>;
  onBeforeResize?: () => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  return (
    <GraphChatHistoryEventFrame
      className="thread-graph-event-plan"
      icon={<ClipboardList className="h-4 w-4" />}
      item={item}
      timeMeta={timeMeta}
      title={translate("chat.planned")}
      tone="plan"
    >
      <div className="thread-graph-history-event-prose">
        <GraphChatMarkdownAwareBody
          text={item.text}
          scrollRootRef={scrollRootRef}
          plainTextClassName="thread-graph-plain-text whitespace-pre-wrap break-words text-sm leading-6"
          markdownClassName="thread-graph-markdown text-sm"
          {...(onBeforeResize ? { onBeforeResize } : {})}
        />
      </div>
    </GraphChatHistoryEventFrame>
  );
});

export const GraphChatContextCompactionItem = memo(
  function GraphChatContextCompactionItem({
    item,
    timeMeta,
  }: {
    item: ContextCompactionHistoryItem;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const isRunning =
      isRunningHistoryStatus(item.status) || item.text === 'Compacting context';
    const primaryText = isRunning ? translate("chat.compactingContext") : translate("chat.contextCompacted");
    const secondaryText =
      item.detailText && item.detailText !== primaryText
        ? item.detailText
        : null;

    // One quiet line in the log, like the operations around it.
    return (
      <div className="tlog-notice thread-graph-event-context" data-kind="contextCompaction" data-status={isRunning ? 'running' : 'done'}>
        <span className="tlog-glyph" aria-hidden="true">≋</span>
        <span className="tlog-title">{primaryText}</span>
        {secondaryText ? <span className="tlog-notice-detail" title={secondaryText}>{secondaryText}</span> : null}
        {isRunning ? <RunningDots tone="emerald" /> : null}
        {graphHistoryStatusConfig(item.status).className === 'is-failed'
          ? <span className="tlog-tag is-failed thread-graph-tool-badge">{translate('chat.failed')}</span> : null}
        {timeMeta}
      </div>
    );
  },
);

function GraphChatNativeTaskNotification({
  item,
  timeMeta,
}: {
  item: ThreadHistoryItemDto;
  timeMeta?: ReactNode;
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  // A parent turn can be interrupted after the task has already completed.
  const status = (item.taskStatus ?? item.status ?? '').trim().toLowerCase();
  const failed = ['failed', 'failure', 'error', 'errored'].includes(status);
  const stopped = ['stopped', 'killed', 'cancelled', 'canceled', 'interrupted'].includes(status);
  const completed = ['completed', 'complete', 'success', 'succeeded'].includes(status);
  const waiting = item.origin === 'nativeBackgroundWait' && status === 'waiting';
  const label = translate(
    waiting ? 'chat.waitingForWake'
      : item.origin === 'nativeTaskNotification' && !failed && !stopped ? 'chat.backgroundAwakened'
      : item.origin === 'nativeBackgroundWait' && status === 'running' ? 'chat.backgroundResumed'
      : item.origin === 'nativeBackgroundWait' ? 'chat.backgroundWaitEnded'
      : failed ? 'chat.backgroundTaskFailed'
      : stopped ? 'chat.backgroundTaskStopped'
      : completed ? 'chat.backgroundTaskCompleted'
      : 'chat.backgroundTaskUpdated',
  );
  const notificationAt = typeof item.awakenedAt === 'string' ? item.awakenedAt : item.createdAt;
  const timestamp = notificationAt ? new Date(notificationAt) : null;
  const validTimestamp = timestamp && Number.isFinite(timestamp.getTime());

  return (
    <div className={`thread-graph-event thread-graph-task-notice${failed ? ' is-failed' : ''}`}>
      <div className="thread-graph-task-notice-row">
        <button
          type="button"
          className="thread-graph-task-notice-toggle"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
        >
          {waiting ? <Hourglass className="thread-graph-task-notice-icon" aria-hidden="true" />
            : item.origin === 'nativeTaskNotification' ? <BellRing className="thread-graph-task-notice-icon" aria-hidden="true" /> : null}
          <span className="thread-graph-task-notice-label">{label}</span>
          {item.text ? <span className="thread-graph-task-notice-preview">{item.text}</span> : null}
          <ChevronRight className={`thread-graph-task-notice-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
        </button>
        {timeMeta ? <span className="thread-graph-task-notice-time">{timeMeta}</span> : null}
      </div>
      {open ? (
        <div className="thread-graph-task-notice-detail">
          {item.text ? <div><GraphChatLinkifiedPlainText text={item.text} /></div> : null}
          {item.detailText ? <div><GraphChatLinkifiedPlainText text={item.detailText} /></div> : null}
          {waiting ? <div>{translate('chat.backgroundWaitingHint')}</div> : null}
          {validTimestamp ? (
            <time dateTime={notificationAt!}>
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp)}
            </time>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const GraphChatGenericHistoryItem = memo(
  function GraphChatGenericHistoryItem({
    item,
    timeMeta,
  }: {
    item: ThreadHistoryItemDto;
    timeMeta?: ReactNode;
  }) {
    const { locale: i18nLocale } = useI18n();
    if (item.origin === 'nativeTaskNotification' || item.origin === 'nativeBackgroundWait') {
      return <GraphChatNativeTaskNotification item={item} timeMeta={timeMeta} />;
    }
    return (
      <GraphChatHistoryEventFrame
        className="thread-graph-event-generic"
        icon={<Info className="h-4 w-4" />}
        item={item}
        timeMeta={timeMeta}
        title={translate("chat.noted")}
        tone="generic"
      >
        <div className="thread-graph-history-event-note">
          <GraphChatLinkifiedPlainText text={item.text} />
        </div>
      </GraphChatHistoryEventFrame>
    );
  },
);

export const GraphChatCommandItem = memo(function GraphChatCommandItem({
  autoOpen,
  item,
  onOpen,
  timeMeta,
}: {
  autoOpen?: boolean;
  item: ThreadHistoryItemDto & { kind: 'commandExecution' };
  onOpen: (
    item: ThreadHistoryItemDto & { kind: 'commandExecution' },
    title: string,
  ) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const summary = summarizeInlinePreviewText(item.previewText ?? item.text);

  return (
    <GraphChatHistoryToolFrame
      actionLabel="Open full command"
      actionTitle={translate("chat.commandOutput")}
      autoOpen={autoOpen}
      className="thread-graph-event-command"
      icon={<Terminal className="h-4 w-4" />}
      item={item}
      onOpen={() => onOpen(item, translate("chat.commandOutput"))}
      preview={summary}
      timeMeta={timeMeta}
      title={translate("chat.ran")}
      tone="command"
    />
  );
});

export const GraphChatToolCallItem = memo(function GraphChatToolCallItem({
  autoOpen,
  item,
  onOpen,
  timeMeta,
}: {
  autoOpen?: boolean;
  item: ThreadHistoryItemDto & { kind: 'toolCall' };
  onOpen: (
    item: ThreadHistoryItemDto & { kind: 'toolCall' },
    title: string,
  ) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const summary = summarizeInlinePreviewText(item.text);

  return (
    <GraphChatHistoryToolFrame
      actionLabel="Open full tool call"
      actionTitle={translate("chat.toolCallDetails")}
      autoOpen={autoOpen}
      className="thread-graph-event-tool"
      icon={<Wrench className="h-4 w-4" />}
      item={item}
      onOpen={() => onOpen(item, translate("chat.toolCallDetails"))}
      preview={summary}
      timeMeta={timeMeta}
      title={translate("chat.used")}
      tone="tool"
    />
  );
});

export const GraphChatAgentToolCallItem = memo(
  function GraphChatAgentToolCallItem({
    autoOpen,
    item,
    onOpen,
    timeMeta,
  }: {
    autoOpen?: boolean;
    item: ThreadHistoryItemDto & { kind: 'agentToolCall' };
    onOpen: (
      item: ThreadHistoryItemDto & { kind: 'agentToolCall' },
      title: string,
    ) => void;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const summary = summarizeInlinePreviewText(item.text);

    return (
      <GraphChatHistoryToolFrame
        actionLabel="Open agent details"
        actionTitle={translate("chat.agentDetails")}
        autoOpen={autoOpen}
        className="thread-graph-event-agent-tool"
        icon={<Bot className="h-4 w-4" />}
        item={item}
        onOpen={() => onOpen(item, translate("chat.agentDetails"))}
        preview={summary}
        timeMeta={timeMeta}
        title={translate("chat.delegated")}
        tone="agent"
      />
    );
  },
);

export const GraphChatSkillToolCallItem = memo(
  function GraphChatSkillToolCallItem({
    autoOpen,
    item,
    onOpen,
    timeMeta,
  }: {
    autoOpen?: boolean;
    item: ThreadHistoryItemDto & { kind: 'skillToolCall' };
    onOpen: (
      item: ThreadHistoryItemDto & { kind: 'skillToolCall' },
      title: string,
    ) => void;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const summary = summarizeInlinePreviewText(item.text);

    return (
      <GraphChatHistoryToolFrame
        actionLabel="Open skill details"
        actionTitle={translate("chat.skillDetails")}
        autoOpen={autoOpen}
        className="thread-graph-event-skill-tool"
        icon={<Sparkles className="h-4 w-4" />}
        item={item}
        onOpen={() => onOpen(item, translate("chat.skillDetails"))}
        preview={summary}
        timeMeta={timeMeta}
        title={translate("chat.loaded")}
        tone="skill"
      />
    );
  },
);

export const GraphChatWebSearchItem = memo(function GraphChatWebSearchItem({
  autoOpen,
  item,
  onOpen,
  timeMeta,
}: {
  autoOpen?: boolean;
  item: ThreadHistoryItemDto & { kind: 'webSearch' };
  onOpen: (title: string, text: string) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const previewText = item.previewText?.trim() || item.text || translate("chat.webSearch");
  const detailText = item.detailText?.trim() || item.text || translate("chat.webSearch");
  const summary = summarizeInlinePreviewText(previewText);

  return (
    <GraphChatHistoryToolFrame
      actionLabel="Open full web search"
      actionTitle={translate("chat.webSearchDetails")}
      autoOpen={autoOpen}
      className="thread-graph-event-search"
      icon={<Search className="h-4 w-4" />}
      item={item}
      onOpen={() => onOpen(translate("chat.webSearchDetails"), detailText)}
      preview={summary}
      timeMeta={timeMeta}
      title={translate("chat.searched")}
      tone="search"
    />
  );
});

export const GraphChatFileReadItem = memo(function GraphChatFileReadItem({
  autoOpen,
  item,
  onOpen,
  timeMeta,
}: {
  autoOpen?: boolean;
  item: ThreadHistoryItemDto & { kind: 'fileRead' };
  onOpen: (title: string, text: string) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const previewText = item.previewText?.trim() || item.text || translate("chat.fileRead");
  const detailText = item.detailText?.trim() || item.text || translate("chat.fileRead");
  const summary = summarizeInlinePreviewText(previewText);

  return (
    <GraphChatHistoryToolFrame
      actionLabel="Open full file read"
      actionTitle={translate("chat.fileReadDetails")}
      autoOpen={autoOpen}
      className="thread-graph-event-file-read"
      icon={<FileText className="h-4 w-4" />}
      item={item}
      onOpen={() => onOpen(translate("chat.fileReadDetails"), detailText)}
      preview={summary}
      timeMeta={timeMeta}
      title={translate("chat.read")}
      tone="fileRead"
    />
  );
});

export const GraphChatImageItem = memo(function GraphChatImageItem({
  threadId,
  item,
  onOpen,
  getImageAssetUrl,
  timeMeta,
}: {
  threadId: string | undefined;
  item: ThreadHistoryItemDto & { kind: 'image' };
  onOpen: (title: string, text: string) => void;
  getImageAssetUrl?: GetImageAssetUrl | undefined;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const assetPath = item.assetPath ?? item.detailText ?? null;
  const imageUrl =
    threadId && assetPath
      ? (getImageAssetUrl?.({ threadId, path: assetPath, variant: 'thumbnail' }) ?? null)
      : null;
  // The original is requested only when the lightbox opens.
  const fullImageUrl =
    lightboxOpen && threadId && assetPath
      ? (getImageAssetUrl?.({ threadId, path: assetPath }) ?? imageUrl)
      : null;

  return (
    <GraphChatHistoryEventFrame
      className="thread-graph-event-image"
      icon={<ImageIconLucide className="h-4 w-4" />}
      item={item}
      timeMeta={timeMeta}
      title={translate("chat.generated")}
      tone="image"
    >
      {imageUrl ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block w-full text-left"
          title={translate("files.openImagePreview")}
        >
          <img
            src={imageUrl}
            alt={item.text || translate("chat.imagePreview")}
            className="thread-graph-history-event-image"
            loading="lazy"
          />
        </button>
      ) : (
        <div className="thread-graph-history-event-summary">{item.text}</div>
      )}
      {fullImageUrl ? (
        <GraphWorkspaceImageLightbox
          src={fullImageUrl}
          alt={item.text || translate("chat.imagePreview")}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
      {assetPath ? (
        <button
          type="button"
          onClick={() => onOpen(translate("chat.imagePath"), assetPath)}
          className="thread-graph-history-event-path"
          title={assetPath}
        >
          {assetPath}
        </button>
      ) : null}
    </GraphChatHistoryEventFrame>
  );
});

export const GraphChatFileChangeItem = memo(function GraphChatFileChangeItem({
  item,
  onOpen,
  timeMeta,
}: {
  item: ThreadHistoryItemDto & { kind: 'fileChange' };
  onOpen: (title: string, text: string) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const pathSummary =
    item.previewText?.trim() && item.text.trim() !== item.previewText.trim()
      ? item.text.trim()
      : null;
  const detailText = item.detailText?.trim() || null;
  const displayedPath = formatTrailingPathLabel(
    pathSummary ?? item.previewText?.trim() ?? item.text,
    48,
  );
  const summarySegments = fileChangeSummarySegments(item);
  const canOpen = Boolean(detailText || item.hasDeferredDetail);
  const summaryContent = (
    <div className="thread-graph-event-line thread-graph-file-change-inline flex min-w-0 items-center gap-2">
      <span
        className="thread-graph-history-detail-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip text-sm"
        title={pathSummary ?? displayedPath}
      >
        {displayedPath}
      </span>
      {summarySegments.length > 0 && (
        <div className="inline-flex shrink-0 items-center justify-end gap-1.5 text-xs">
          {summarySegments.map((segment) => (
            <span
              key={segment}
              className={`thread-graph-history-delta-badge ${
                segment.startsWith('+')
                  ? 'is-add'
                  : segment.startsWith('-')
                    ? 'is-remove'
                    : 'is-neutral'
              }`}
            >
              {segment}
            </span>
          ))}
        </div>
      )}
    </div>
  );
  const inlineSummary = canOpen ? (
    <button
      type="button"
      aria-label={translate("chat.openFileChangeDetails")}
      onClick={() => onOpen(translate("chat.fileChangeDetails"), detailText ?? item.text)}
      className="thread-graph-file-change-inline-button min-w-0 flex-1 text-left"
      title={pathSummary ?? displayedPath}
    >
      {summaryContent}
    </button>
  ) : (
    summaryContent
  );

  return (
    <GraphChatHistoryEventFrame
      className="thread-graph-event-file-change"
      headerMeta={inlineSummary}
      icon={<FilePenLine className="h-4 w-4" />}
      item={item}
      timeMeta={timeMeta}
      title={translate("chat.changed")}
      tone="fileChange"
    />
  );
});

export const GraphChatArtifactHistoryItem = memo(
  function GraphChatArtifactHistoryItem({
    item,
    onSelect,
    timeMeta,
  }: {
    item: ThreadHistoryItemDto & { kind: 'artifact' };
    onSelect?: (
      item: ThreadHistoryItemDto & { kind: 'artifact' },
      artifact: NonNullable<ThreadHistoryItemDto['artifact']>,
    ) => void;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const plugins = usePlugins();
    const [expanded, setExpanded] = useState(false);
    const artifact = item.artifact;
    const rendered = artifact
      ? plugins.renderArtifact({
          artifact,
          expanded,
          onToggleExpanded: () => setExpanded((current) => !current),
        })
      : null;

    return (
      <GraphChatHistoryEventFrame
        actions={
          <span className="inline-flex items-center gap-2">
            {artifact && !plugins.hasRendererForArtifact(artifact) ? (
              <span className="thread-graph-history-event-secondary">
                {translate("chat.noRenderer")}</span>
            ) : null}
            {artifact && onSelect ? (
              <button
                type="button"
                aria-label={translate("chat.openArtifactInspectorFor", { value1: artifact.title })}
                onClick={() => onSelect(item, artifact)}
                className="thread-graph-history-event-action"
              >
                <PackageOpen className="h-3.5 w-3.5" />
                {translate("chat.inspect")}</button>
            ) : null}
          </span>
        }
        className="thread-graph-event-artifact"
        headerMeta={
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={translate("chat.artifact", { value1: expanded ? translate("chat.collapse") : translate("chat.expand"), value2: artifact?.title ?? item.text })}
            onClick={() => setExpanded((current) => !current)}
            className="thread-graph-artifact-inline-toggle flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="thread-graph-history-detail-text min-w-0 truncate text-sm">
              {artifact?.title ?? item.text}
            </span>
            <span className="thread-graph-history-event-secondary min-w-0 truncate">
              {artifact?.summaryText ?? item.previewText ?? artifact?.type ?? ''}
            </span>
            <span className="thread-graph-history-group-chevron inline-flex shrink-0" aria-hidden="true">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
        }
        icon={<PackageOpen className="h-4 w-4" />}
        item={item}
        timeMeta={timeMeta}
        title={translate("chat.created")}
        tone="artifact"
      >
        {expanded
          ? rendered ?? (
              <pre className="thread-graph-history-event-pre max-h-80 overflow-auto">
                {JSON.stringify(artifact?.payload ?? item, null, 2)}
              </pre>
            )
          : null}
      </GraphChatHistoryEventFrame>
    );
  },
);

export const GraphChatHookItem = memo(function GraphChatHookItem({
  item,
  timeMeta,
}: {
  item: ThreadHistoryItemDto & { kind: 'hook' };
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const outputText =
    item.hookOutputEntries
      ?.map((entry) => entry.text.trim())
      .filter(Boolean)
      .join('\n')
      .trim() ?? '';
  const hookLabel = item.hookEventLabel
    ? `${item.hookEventLabel} hook`
    : item.text;
  const fallbackText =
    item.hookStatusMessage?.trim() ||
    (item.previewText && item.previewText !== item.hookStatusMessage
      ? item.previewText.trim()
      : '') ||
    item.text.trim();
  const summaryText =
    outputText ||
    (fallbackText && fallbackText !== hookLabel ? fallbackText : hookLabel);
  const summary = summarizeInlinePreviewText(summaryText);
  const showGap = Boolean(outputText && summary.showGap);

  return (
    <GraphChatHistoryEventFrame
      className="thread-graph-event-hook"
      icon={<Webhook className="h-4 w-4" />}
      item={item}
      timeMeta={timeMeta}
      title={translate("chat.ranHook")}
      tone="hook"
    >
      <div className="thread-graph-history-event-line">
        <p className="thread-graph-history-detail-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip">
          {outputText ? (
            <>
              <span className="thread-graph-history-event-secondary mr-2 font-sans text-[11px] uppercase">
                {hookLabel}
              </span>
              <GraphChatLinkifiedPlainText text={summary.firstLine} />
            </>
          ) : (
            <GraphChatLinkifiedPlainText
              text={
                summary.firstLine && summary.firstLine !== hookLabel
                  ? `${hookLabel} · ${summary.firstLine}`
                  : hookLabel
              }
            />
          )}
        </p>
        {showGap ? (
          <span className="thread-graph-history-detail-meta shrink-0 text-[11px] font-medium tracking-[0.28em]">
            ...
          </span>
        ) : null}
      </div>
    </GraphChatHistoryEventFrame>
  );
});

export const GraphChatCommandGroupItem = memo(
  function GraphChatCommandGroupItem({
    items,
    expanded,
    onToggleExpanded,
    onOpen,
    timeMeta,
    renderItemTime,
  }: {
    items: CommandHistoryItem[];
    expanded: boolean;
    onToggleExpanded: () => void;
    onOpen: (item: CommandHistoryItem, title: string) => void;
    timeMeta?: ReactNode;
    renderItemTime?: (timestamp: string | null | undefined) => ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const workbench = useContext(WorkbenchContext);
    const runningCount = items.filter((item) =>
      isRunningHistoryStatus(item.status),
    ).length;
    const countLabel = translate('chat.commandCount', { count: items.length });

    return (
      <GraphChatHistoryGroupFrame
        className="thread-graph-history-group-command"
        expanded={expanded}
        expandedListClassName="border-amber-300/12"
        icon={<CommandBatchIcon />}
        onToggleExpanded={onToggleExpanded}
        runningIndicator={runningCount > 0 ? <RunningDots /> : null}
        summary={
          <>
            <span className="thread-graph-history-group-description">
              {countLabel}
            </span>
          </>
        }
        timeMeta={timeMeta}
        toggleAriaLabel={translate("chat.commandEntries", { value1: expanded ? translate("chat.collapse") : translate("chat.expand"), value2: items.length })}
      >
        {items.map((item, index) => {
          const summary = summarizeInlinePreviewText(item.previewText ?? item.text);
          const status = graphHistoryStatusConfig(item.status);
          if (workbench) return (
            <button key={item.id} type="button"
              aria-label={translate("chat.openGroupedCommand", { value1: index + 1 })}
              onClick={() => onOpen(item, `Command Output ${index + 1}`)}
              className="matter-command-step" title={summary.firstLine}>
              <span className="matter-step-number" aria-label={translate("chat.step", { value1: index + 1 })}>{String(index + 1).padStart(2, '0')}</span>
              <span className="matter-step-title">{summary.firstLine}</span>
              <span className={`matter-step-status ${status.className}`} role="img" aria-label={status.label} title={status.label}>
                {status.className === 'is-completed' ? <Check size={13} /> : status.icon}
              </span>
              {renderItemTime?.(item.createdAt)}
              <ChevronRight className="matter-step-chevron" size={12} />
            </button>
          );
          return (
            <button
              key={item.id}
              type="button"
              aria-label={translate("chat.openGroupedCommand", { value1: index + 1 })}
              onClick={() => onOpen(item, `Command Output ${index + 1}`)}
              className="thread-graph-history-detail-row block w-full rounded-md border px-3 py-2 text-left transition"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/18 bg-amber-300/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                  {translate("chat.step_dc416e")} {index + 1}
                </span>
                {item.status && (
                  <span className="thread-graph-history-detail-meta text-xs">
                    {item.status}
                  </span>
                )}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-sm leading-6">
                <p className="thread-graph-history-detail-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip">
                  {summary.firstLine}
                </p>
                {summary.showGap ? (
                  <span className="thread-graph-history-detail-meta shrink-0 text-[11px] font-medium tracking-[0.28em]">
                    ...
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </GraphChatHistoryGroupFrame>
    );
  },
);

export const GraphChatToolCallGroupItem = memo(
  function GraphChatToolCallGroupItem({
    items,
    expanded,
    onToggleExpanded,
    onOpen,
    timeMeta,
  }: {
    items: ToolActivityHistoryItem[];
    expanded: boolean;
    onToggleExpanded: () => void;
    onOpen: (item: ToolActivityHistoryItem, title: string) => void;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const runningCount = items.filter((item) =>
      isRunningHistoryStatus(item.status),
    ).length;
    const firstKind = items[0]?.kind ?? 'toolCall';
    const label =
      firstKind === 'agentToolCall'
        ? translate("chat.agentAction")
        : firstKind === 'skillToolCall'
          ? translate("chat.skillCall")
          : translate("chat.toolCall");
    const countLabel =
      items.length === 1 ? `1 ${label}` : `${items.length} ${label}s`;

    return (
      <GraphChatHistoryGroupFrame
        className="thread-graph-history-group-tool"
        expanded={expanded}
        expandedListClassName="border-teal-300/12"
        icon={
          firstKind === 'agentToolCall' ? (
            <Bot className="h-3.5 w-3.5" />
          ) : (
            <Wrench className="h-3.5 w-3.5" />
          )
        }
        onToggleExpanded={onToggleExpanded}
        runningIndicator={runningCount > 0 ? <RunningDots /> : null}
        summary={
          <>
            <span className="thread-graph-history-group-verb">
              {firstKind === 'agentToolCall'
                ? translate("chat.delegated")
                : firstKind === 'skillToolCall'
                  ? translate("chat.loaded")
                  : translate("chat.used")}
            </span>
            <span className="thread-graph-history-group-description">
              {countLabel}
            </span>
          </>
        }
        timeMeta={timeMeta}
        toggleAriaLabel={`${expanded ? translate("chat.collapse") : translate("chat.expand")} ${countLabel}`}
      >
        {items.map((item, index) => {
          const summary = summarizeInlinePreviewText(item.text);
          return (
            <button
              key={item.id}
              type="button"
              aria-label={translate("chat.open_6beab4", { value1: label, value2: index + 1 })}
              onClick={() => onOpen(item, `${label} ${index + 1}`)}
              className="thread-graph-history-detail-row block w-full rounded-md border px-3 py-2 text-left transition"
            >
              <div className="flex min-w-0 items-center gap-2 text-sm leading-6">
                <p className="thread-graph-history-detail-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip">
                  {summary.firstLine}
                </p>
                {item.status ? (
                  <span className="thread-graph-history-detail-meta shrink-0 text-xs">
                    {item.status}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </GraphChatHistoryGroupFrame>
    );
  },
);

export const GraphChatAgentActivityGroupItem = memo(
  function GraphChatAgentActivityGroupItem({
    itemCount,
    running = false,
    expanded,
    onToggleExpanded,
    timeMeta,
    children,
  }: {
    itemCount: number;
    running?: boolean;
    expanded: boolean;
    onToggleExpanded: () => void;
    timeMeta?: ReactNode;
    children: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const countLabel =
      translate('chat.activityStepCount', { count: itemCount });
    const accessibleCountLabel = translate('chat.operationCount', { count: itemCount });
    return (
      <GraphChatHistoryGroupFrame
        className={`thread-graph-history-group-activity ${running ? 'is-running-batch' : ''}`}
        expanded={expanded}
        expandedListClassName="border-slate-300/12"
        plain
        onToggleExpanded={onToggleExpanded}
        summary={
          <>
            <span className="thread-graph-history-group-description">
              {countLabel}
            </span>
          </>
        }
        timeMeta={timeMeta}
        toggleAriaLabel={`${expanded ? translate("chat.collapse") : translate("chat.expand")} ${accessibleCountLabel}`}
      >
        {children}
      </GraphChatHistoryGroupFrame>
    );
  },
);

export const GraphChatSearchGroupItem = memo(function GraphChatSearchGroupItem({
  items,
  expanded,
  onToggleExpanded,
  onOpen,
  timeMeta,
}: {
  items: SearchHistoryItem[];
  expanded: boolean;
  onToggleExpanded: () => void;
  // Receives the item so compact histories can load its deferred detail.
  onOpen: (item: SearchHistoryItem, title: string) => void;
  timeMeta?: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  const countLabel =
    items.length === 1 ? '1 search' : `${items.length} searches`;

  return (
    <GraphChatHistoryGroupFrame
      className="thread-graph-history-group-search"
      expanded={expanded}
      expandedListClassName="border-sky-300/12"
      icon={<SearchBatchIcon />}
      onToggleExpanded={onToggleExpanded}
      summary={
        <>
          <span className="thread-graph-history-group-verb">
            {translate("chat.searched")}</span>
          <span className="thread-graph-history-group-description">
            {countLabel}
          </span>
        </>
      }
      timeMeta={timeMeta}
      toggleAriaLabel={translate("chat.webSearchEntries", { value1: expanded ? translate("chat.collapse") : translate("chat.expand"), value2: items.length })}
    >
      {items.map((item, index) => {
        const previewText =
          item.previewText?.trim() || item.text || translate("chat.webSearch");
        const summary = summarizeInlinePreviewText(previewText);

        return (
          <button
            key={item.id}
            type="button"
            aria-label={translate("chat.openGroupedWebSearch", { value1: index + 1 })}
            onClick={() => onOpen(item, `Web Search ${index + 1}`)}
            className="thread-graph-history-detail-row block w-full rounded-md border px-3 py-2 text-left transition"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-300/18 bg-sky-300/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-100">
                {translate("chat.search")} {index + 1}
              </span>
              {item.status && (
                <span className="thread-graph-history-detail-meta text-xs">
                  {item.status}
                </span>
              )}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm leading-6">
              <p className="thread-graph-history-detail-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-clip">
                {summary.firstLine}
              </p>
              {summary.showGap ? (
                <span className="thread-graph-history-detail-meta shrink-0 text-[11px] font-medium tracking-[0.28em]">
                  ...
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </GraphChatHistoryGroupFrame>
  );
});

export const GraphChatFileReadGroupItem = memo(
  function GraphChatFileReadGroupItem({
    items,
    expanded,
    onToggleExpanded,
    onOpen,
    timeMeta,
  }: {
    items: FileReadHistoryItem[];
    expanded: boolean;
    onToggleExpanded: () => void;
    onOpen: (title: string, text: string) => void;
    timeMeta?: ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const countLabel = translate('chat.readFileCount', { count: items.length });

    return (
      <GraphChatHistoryGroupFrame
        className="thread-graph-history-group-file-read"
        expanded={expanded}
        expandedListClassName="border-cyan-300/12"
        icon={<FileReadIcon />}
        onToggleExpanded={onToggleExpanded}
        summary={
          <>
            <span className="thread-graph-history-group-description">
              {countLabel}
            </span>
          </>
        }
        timeMeta={timeMeta}
        toggleAriaLabel={translate("chat.fileReadEntries", { value1: expanded ? translate("chat.collapse") : translate("chat.expand"), value2: items.length })}
      >
        {items.map((item) => (
          <GraphChatFileReadItem key={item.id} item={item} onOpen={onOpen} />
        ))}
      </GraphChatHistoryGroupFrame>
    );
  },
);

export const GraphChatFileChangeGroupItem = memo(
  function GraphChatFileChangeGroupItem({
    items,
    expanded,
    onToggleExpanded,
    onOpen,
    timeMeta,
    renderItemTime,
  }: {
    items: FileChangeHistoryItem[];
    expanded: boolean;
    onToggleExpanded: () => void;
    onOpen: (item: FileChangeHistoryItem, title: string) => void;
    timeMeta?: ReactNode;
    renderItemTime?: (timestamp: string | null | undefined) => ReactNode;
  }) {
  const { locale: i18nLocale } = useI18n();
    const changedFiles = items.reduce(
      (sum, item) => sum + (item.changedFiles ?? 0),
      0,
    );
    const addedLines = items.reduce(
      (sum, item) => sum + (item.addedLines ?? 0),
      0,
    );
    const removedLines = items.reduce(
      (sum, item) => sum + (item.removedLines ?? 0),
      0,
    );
    const batchLabel = translate('chat.changedFileCount', { count: changedFiles || items.length });

    return (
      <GraphChatHistoryGroupFrame
        className="thread-graph-history-group-file-change"
        expanded={expanded}
        expandedListClassName="border-lime-300/12"
        icon={<FileChangeIcon />}
        onToggleExpanded={onToggleExpanded}
        summary={
          <>
            <span className="thread-graph-history-group-description">
              {batchLabel}
            </span>
          </>
        }
        timeMeta={timeMeta}
        toggleAriaLabel={translate("chat.fileChangeEntries", { value1: expanded ? translate("chat.collapse") : translate("chat.expand"), value2: items.length })}
        trailingSummary={
          <span className="inline-flex shrink-0 items-center gap-1.5">
            {addedLines > 0 ? (
              <span className="thread-graph-history-delta-badge is-add" aria-label={translate('chat.addedLineCount', { count: addedLines })}>
                <ArrowUp size={11} aria-hidden="true" />{addedLines}
              </span>
            ) : null}
            {removedLines > 0 ? (
              <span className="thread-graph-history-delta-badge is-remove" aria-label={translate('chat.removedLineCount', { count: removedLines })}>
                <ArrowDown size={11} aria-hidden="true" />{removedLines}
              </span>
            ) : null}
          </span>
        }
      >
        {items.map((item, index) => {
          const pathSummary =
            item.previewText?.trim() &&
            item.text.trim() !== item.previewText.trim()
              ? item.text.trim()
              : item.previewText?.trim() || item.text;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={translate("chat.openGroupedFileChange", { value1: index + 1 })}
              onClick={() => onOpen(item, `File Change ${index + 1}`)}
              className="matter-command-step w-full text-left"
            >
              <span className="matter-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="matter-step-file-summary">
                <span
                  className="matter-step-title"
                  title={pathSummary}
                >
                  {formatTrailingPathLabel(pathSummary, 34)}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  {(item.addedLines ?? 0) > 0 ? (
                    <span className="thread-graph-history-delta-badge is-add">
                      +{item.addedLines}
                    </span>
                  ) : null}
                  {(item.removedLines ?? 0) > 0 ? (
                    <span className="thread-graph-history-delta-badge is-remove">
                      -{item.removedLines}
                    </span>
                  ) : null}
                </span>
              </div>
              <span className={`matter-step-status ${graphHistoryStatusConfig(item.status).className}`}>{graphHistoryStatusConfig(item.status).icon}</span>
              {renderItemTime?.(item.createdAt)}
            </button>
          );
        })}
      </GraphChatHistoryGroupFrame>
    );
  },
);
