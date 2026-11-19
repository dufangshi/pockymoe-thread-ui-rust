import { translate, useI18n } from '../../i18n';
import { formatDurationSeconds } from './durationFormatting';
import { Bot, Hourglass } from 'lucide-react';
import { useRef, useState } from 'react';
import { useVisibleClock } from '../../visibleClock';
import { Tooltip, TooltipContent, TooltipTrigger } from '../graph-ui/Tooltip';

import {
  isActiveTurnStatus,
  type TimelineTurn,
} from './timelineItems';
import { formatTurnRuntimeSummary, TurnUsageInline } from './TurnUsageInline';
import {
  formatLongTimestamp,
  turnStatusLabel,
} from '../threadPresentation';
import { TranscriptAgentByline } from '../graph-chat/TranscriptAgent';

/** Three still dots. Their colours come from the theme (styles/transcript-log.css),
    never inline: a theme pack may redraw them, and red is kept for failure. */
function RunningDots() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span key={index} className="h-1.5 w-1.5 rounded-full thread-live-progress-dot" />
      ))}
    </span>
  );
}

function ProgressIndicator({ age, at }: { age: number | null; at: string | null }) {
  const [open, setOpen] = useState(false);
  const openAtPointerDown = useRef(false);
  const validAge = age !== null && Number.isFinite(age);
  const freshness = !validAge ? 'unknown' : age <= 5 ? 'recent' : age <= 20 ? 'quiet' : 'stale';
  // A long command is normal work, not an error: a quiet turn turns its dots
  // hollow (shape, not colour) and says for how long nothing new arrived.
  const quietFor = freshness === 'stale' && validAge
    ? age < 60 ? translate('chat.quietSeconds', { count: age }) : translate('chat.quietMinutes', { count: Math.floor(age / 60) })
    : null;
  const ageLabel = validAge ? translate('chat.lastProgressAgo', { duration: formatDurationSeconds(age) }) : translate('chat.timeSinceTheLastTurnProgressUpdate');
  const timeLabel = at && Number.isFinite(Date.parse(at)) ? translate('chat.lastActivity', { value1: formatLongTimestamp(at) }) : null;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" className="thread-progress-indicator inline-flex min-h-6 min-w-6 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          data-progress-freshness={freshness} aria-label={[ageLabel, timeLabel].filter(Boolean).join(' · ')} aria-expanded={open}
          onPointerDown={() => { openAtPointerDown.current = open; }}
          onClick={event => {
            event.preventDefault(); event.stopPropagation();
            setOpen(current => !(event.detail !== 0 ? openAtPointerDown.current : current));
          }}>
          <RunningDots />
          {quietFor ? <span className="thread-progress-quiet">{quietFor}</span> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} collisionPadding={12}
        style={{ background: 'var(--theme-panel)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border)', zIndex: 100, maxWidth: 'calc(100vw - 24px)' }}>
        <div>{ageLabel}</div>
        {timeLabel && <div>{timeLabel}</div>}
      </TooltipContent>
    </Tooltip>
  );
}

export function normalizePlanStepStatus(status: string) {
  const normalized = status.trim().toLowerCase();

  if (
    normalized === 'completed' ||
    normalized === 'done' ||
    normalized === 'complete'
  ) {
    return 'completed' as const;
  }

  if (
    normalized === 'in_progress' ||
    normalized === 'in progress' ||
    normalized === 'inprogress' ||
    normalized === 'running' ||
    normalized === 'active'
  ) {
    return 'in_progress' as const;
  }

  if (
    normalized === 'pending' ||
    normalized === 'todo' ||
    normalized === 'not_started' ||
    normalized === 'not started' ||
    normalized === 'queued'
  ) {
    return 'pending' as const;
  }

  if (normalized === 'failed' || normalized === 'error') {
    return 'failed' as const;
  }

  return 'other' as const;
}

export function useSecondClock(enabled: boolean, element?: Element | null) {
  return useVisibleClock(enabled, 1000, element);
}

export function formatElapsedDuration(
  startedAt: string | null | undefined,
  now: number,
) {
  const startedAtMillis = Date.parse(startedAt ?? '');
  if (!Number.isFinite(startedAtMillis) || !Number.isFinite(now)) {
    return null;
  }
  return formatDurationSeconds(Math.max(0, Math.floor((now - startedAtMillis) / 1_000)));
}

function TurnStatusIndicator({
  status,
}: {
  status: TimelineTurn['status'];
}) {
  useI18n();
  const label = turnStatusLabel(status);

  if (status === 'completed') {
    return (
      <span
        aria-label={label}
        title={label}
        className="timeline-status-icon timeline-status-icon-success inline-flex h-4 w-4 items-center justify-center"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.75 8.25 2.5 2.5 6-6" />
        </svg>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        aria-label={label}
        title={label}
        className="timeline-status-icon timeline-status-icon-failed inline-flex h-4 w-4 items-center justify-center"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 5 6 6M11 5l-6 6" />
        </svg>
      </span>
    );
  }

  if (status === 'interrupted') {
    return (
      <span
        aria-label={label}
        title={label}
        className="timeline-status-icon timeline-status-icon-warning inline-flex h-4 w-4 items-center justify-center"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4.5v7M10 4.5v7" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex min-w-[1.25rem] items-center justify-center text-sky-200"
    >
      <RunningDots />
    </span>
  );
}

export function TurnStatusBar({
  turn,
  variant = 'header',
  notificationControl,
  lastActivityAt = null,
  backgroundAgentCount = 0,
  waitingForWake = false,
}: {
  turn: TimelineTurn;
  variant?: 'header' | 'footer';
  notificationControl?: import('react').ReactNode;
  lastActivityAt?: string | null;
  backgroundAgentCount?: number;
  waitingForWake?: boolean;
}) {
  useI18n();
  const label = turnStatusLabel(turn.status);
  const runtimeSummary = formatTurnRuntimeSummary(turn);
  const active = isActiveTurnStatus(turn.status);
  const [clockElement, setClockElement] = useState<HTMLDivElement | null>(null);
  const now = useSecondClock(active && variant === 'footer', clockElement);
  const elapsedLabel = formatElapsedDuration(turn.startedAt, active ? now : Date.parse(turn.completedAt ?? turn.startedAt ?? ''));
  const effectiveLastActivityAt = lastActivityAt ?? turn.startedAt;
  const progressAge = effectiveLastActivityAt ? Math.max(0, Math.floor((now - Date.parse(effectiveLastActivityAt)) / 1000)) : null;
  const toneClassName =
    turn.status === 'failed'
      ? 'border-rose-300/20 bg-rose-300/[0.06] text-rose-100'
      : active
        ? 'border-sky-300/22 bg-sky-300/[0.08] text-sky-100'
        : 'border-stone-700/90 bg-stone-900/70 text-stone-200';

  if (variant === 'footer') {
    return (
      <div ref={setClockElement} className="thread-graph-turn-footer flex w-full items-center justify-between gap-3 text-xs">
        <div className="thread-graph-turn-footer-runtime flex min-w-0 flex-wrap items-center gap-2">
          {active && turn.status !== 'recovering' ? <TranscriptAgentByline size="small" /> : null}
          {/* Waiting and background agents read as small static marks, not phrases. */}
          {active && turn.status !== 'recovering' && waitingForWake ? (
            <span className="thread-wait-mark" role="status" aria-label={translate('chat.waitingForWake')} title={translate('chat.waitingForWake')}>
              <Hourglass aria-hidden="true" />
            </span>
          ) : active && turn.status !== 'recovering' && backgroundAgentCount > 0 ? (
            <span className="thread-background-agent-status" role="status"
              aria-label={translate('chat.backgroundAgentsRunning', { count: backgroundAgentCount })}
              title={translate('chat.backgroundAgentsRunning', { count: backgroundAgentCount })}>
              <Bot aria-hidden="true" /><b>{backgroundAgentCount}</b>
            </span>
          ) : active && turn.status !== 'recovering'
            ? <ProgressIndicator age={progressAge} at={effectiveLastActivityAt} />
            : <TurnStatusIndicator status={turn.status} />}

          {active && turn.status !== 'recovering' ? notificationControl : null}
          <TurnUsageInline turn={turn} />
        </div>
        <div className="thread-graph-turn-footer-meta timeline-meta-text flex min-w-0 shrink items-center justify-end gap-1 whitespace-nowrap">
          {elapsedLabel ? (
            <span aria-label={translate("chat.runningFor", { value1: elapsedLabel })}>{elapsedLabel}</span>
          ) : null}
        </div>
      </div>
    );
  }

  const title = `${label} · ${runtimeSummary}`;

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] sm:text-[11px] ${toneClassName}`}
      title={title}
    >
      <TurnStatusIndicator status={turn.status} />
      <span className="timeline-meta-text min-w-0 truncate">
        {runtimeSummary}
      </span>
    </span>
  );
}
