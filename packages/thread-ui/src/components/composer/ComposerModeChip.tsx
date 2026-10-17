import { X } from 'lucide-react';
import { translate, useI18n } from '../../i18n';

/** A mode the next prompts run in (plan mode), shown where the goal card sits,
    with its own way out. */
export function ComposerModeChip({ busy, onExit }: { busy: boolean; onExit: () => void }) {
  useI18n();
  return (
    <div className="thread-goal-compose-card composer-mode-chip relative z-20 mb-1.5 flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs shadow-sm" data-mode="plan">
      <span className="thread-goal-compose-label font-medium uppercase tracking-[0.16em]">{translate('chat.planModeOn')}</span>
      <button
        type="button"
        onClick={onExit}
        disabled={busy}
        aria-label={translate('chat.exitPlanMode')}
        title={translate('chat.exitPlanMode')}
        className="thread-goal-compose-cancel composer-mode-chip-exit ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border transition disabled:opacity-60"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
