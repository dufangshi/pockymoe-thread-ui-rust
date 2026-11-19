import { Pause, Target, X, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';

/** One mode the next prompts run in, shown where the goal card sits, with its
    own way out (docs/ui-principles.md §12: a current mode is always visible in
    the composer, not only in a menu). */
function ModeChip({ mode, icon, label, detail, busy, exitLabel, exitIcon, onExit, onOpen }: {
  mode: 'plan' | 'fast' | 'goal';
  icon?: ReactNode;
  label: string;
  detail?: string | undefined;
  busy: boolean;
  exitLabel: string;
  exitIcon?: ReactNode;
  onExit: () => void;
  onOpen?: (() => void) | undefined;
}) {
  const body = (
    <>
      {icon}
      <span className="thread-goal-compose-label shrink-0 font-medium">{label}</span>
      {detail ? <span className="composer-mode-chip-detail min-w-0 truncate">{detail}</span> : null}
    </>
  );
  return (
    <div
      className="thread-goal-compose-card composer-mode-chip relative z-20 flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs shadow-sm"
      data-mode={mode}
    >
      {onOpen ? (
        <button type="button" onClick={onOpen} title={detail} className="composer-mode-chip-open flex min-w-0 items-center gap-2 text-left">
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2" title={detail}>{body}</span>
      )}
      <button
        type="button"
        onClick={onExit}
        disabled={busy}
        aria-label={exitLabel}
        title={exitLabel}
        className="thread-goal-compose-cancel composer-mode-chip-exit ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60"
      >
        {exitIcon ?? <X aria-hidden="true" className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** The modes in force: an active goal, plan mode and fast mode, in one row. */
export function ComposerModeChips({ busy, plan, fast, goal }: {
  busy: boolean;
  plan?: { onExit: () => void } | null;
  fast?: { onExit: () => void } | null;
  goal?: { objective: string; onPause: () => void; onOpen?: () => void } | null;
}) {
  useI18n();
  if (!plan && !fast && !goal) return null;
  return (
    <div className="composer-mode-chips mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label={translate('chat.composerModes')}>
      {goal ? (
        <ModeChip
          mode="goal"
          icon={<Target aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
          label={translate('chat.goalActiveChip')}
          detail={goal.objective}
          busy={busy}
          exitLabel={translate('chat.pauseGoal')}
          exitIcon={<Pause aria-hidden="true" className="h-3.5 w-3.5" />}
          onExit={goal.onPause}
          onOpen={goal.onOpen}
        />
      ) : null}
      {plan ? (
        <ModeChip mode="plan" label={translate('chat.planModeOn')} busy={busy} exitLabel={translate('chat.exitPlanMode')} onExit={plan.onExit} />
      ) : null}
      {fast ? (
        <ModeChip
          mode="fast"
          icon={<Zap aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
          label={translate('chat.fastModeOn')}
          busy={busy}
          exitLabel={translate('chat.exitFastMode')}
          onExit={fast.onExit}
        />
      ) : null}
    </div>
  );
}

/** Plan mode only; kept for callers that show just that mode. */
export function ComposerModeChip({ busy, onExit }: { busy: boolean; onExit: () => void }) {
  return <ComposerModeChips busy={busy} plan={{ onExit }} />;
}
