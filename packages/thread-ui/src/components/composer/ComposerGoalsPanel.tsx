import { getLocale } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import type {
  ThreadGoalDto,
  ThreadGoalStatusDto,
  UpdateThreadGoalInput,
} from '@pockymoe/shared';

import { ErrorMark } from '../copy/ErrorMark';
import type { SlashPanelState } from './types';

function goalKey(goal: ThreadGoalDto) {
  return goal.localGoalId ?? `${goal.createdAt}:${goal.objective}`;
}

function mergeGoals(
  current: ThreadGoalDto | null | undefined,
  history: ThreadGoalDto[],
) {
  const goals = current ? [current, ...history] : history;
  const seen = new Set<string>();
  return goals.filter((goal) => {
    const key = goalKey(goal);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function elapsedLabel(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusLabel(status: ThreadGoalStatusDto) {
  switch (status) {
    case 'budgetLimited':
      return translate("chat.budgetLimited");
    case 'complete':
      return translate("chat.complete");
    case 'terminated':
      return translate("chat.terminated");
    case 'paused':
      return translate("chat.paused");
    default:
      return translate("chat.active");
  }
}

export function ComposerGoalsPanel({
  goalState,
  goalHistory,
  busy,
  onBack,
  onUpdateGoal,
  onRetry,
}: {
  goalState: SlashPanelState<ThreadGoalDto | null | undefined>;
  goalHistory: ThreadGoalDto[];
  busy: boolean;
  onBack: () => void;
  onUpdateGoal?: (input: UpdateThreadGoalInput) => Promise<void> | void;
  /** Load the goals again after a failed load. */
  onRetry?: (() => Promise<void> | void) | undefined;
}) {
  useI18n();
  const goals = mergeGoals(goalState.data, goalHistory);
  const currentGoalKey = goalState.data ? goalKey(goalState.data) : null;
  return (
    <div className="min-w-0">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-9 rounded-lg px-2 text-xs font-medium text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)]"
        >
          {translate("chat.back")}</button>
        <span className="flex items-center gap-1">
          <span className="text-xs font-semibold text-[var(--theme-fg)]">{translate("chat.goals")}</span>
          {/* A failed change (or reload) of listed goals: a mark after the heading. */}
          {goalState.error && goals.length > 0 ? <ErrorMark message={goalState.error} /> : null}
        </span>
      </div>
      {goalState.status === 'loading' && goals.length === 0 ? (
        <div className="space-y-2 p-3" role="status" aria-label={translate("chat.loadingGoals")}>
          <div className="h-12 animate-pulse rounded-lg bg-[var(--theme-muted)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-lg bg-[var(--theme-muted)] motion-reduce:animate-none" />
        </div>
      ) : goalState.error && goals.length === 0 ? (
        <p className="flex items-center justify-center gap-1 px-4 py-5 text-center text-sm text-[var(--theme-fg-muted)]">
          <span>{translate("workbench.unableToLoadGoal")}</span>
          <ErrorMark message={goalState.error} onRetry={onRetry ? () => void onRetry() : undefined} />
        </p>
      ) : goals.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-[var(--theme-fg-muted)]">
          {translate("chat.noGoalsInThisThreadYet")}</p>
      ) : (
        <div className="max-h-72 divide-y divide-[var(--theme-border)] overflow-y-auto">
          {goals.map((goal) => {
            const actionable =
              goalKey(goal) === currentGoalKey &&
              ['active', 'paused', 'budgetLimited'].includes(goal.status);
            return (
              <div key={goalKey(goal)} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-[var(--theme-fg)]">
                    {goal.objective}
                  </p>
                  <span className="shrink-0 rounded-full border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-fg-muted)]">
                    {statusLabel(goal.status)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--theme-fg-muted)]">
                  {elapsedLabel(goal.timeUsedSeconds)} · {goal.tokensUsed.toLocaleString(getLocale())} tokens
                </p>
                {actionable && onUpdateGoal ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy || goal.status === 'active'}
                      onClick={() => void onUpdateGoal({ status: 'active' })}
                      className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {translate("chat.continue")}</button>
                    <button
                      type="button"
                      disabled={busy || goal.status === 'paused'}
                      onClick={() => void onUpdateGoal({ status: 'paused' })}
                      className="min-h-9 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {translate("chat.pause")}</button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onUpdateGoal({ status: 'terminated' })}
                      className="min-h-9 rounded-lg px-3 text-xs font-medium text-[var(--status-danger-fg)] transition hover:bg-[var(--status-danger-bg)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {translate("chat.terminate")}</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
