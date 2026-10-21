import { translate, useI18n } from '../../i18n';
import type { ThreadForkTurnOptionDto } from '@pockymoe/shared';

import { ErrorMark } from '../copy/ErrorMark';
import type { SlashPanelState } from './types';

interface ComposerForkPanelProps {
  busy: boolean;
  forkBusy: boolean;
  forkFromTurnAvailable: boolean;
  composerMenuItemClassName: string;
  onForkLatest: () => Promise<void> | void;
  onSelectForkTurnPanel: () => Promise<void> | void;
}

export function ComposerForkPanel({
  busy,
  forkBusy,
  forkFromTurnAvailable,
  composerMenuItemClassName,
  onForkLatest,
  onSelectForkTurnPanel,
}: ComposerForkPanelProps) {
  const { locale: i18nLocale } = useI18n();
  const forkLatest = (
    <button
      type="button"
      disabled={busy || forkBusy}
      onClick={() => void onForkLatest()}
      className={`${composerMenuItemClassName} block w-full rounded-xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{translate("chat.forkFromLatest")}</span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
          {forkBusy ? translate("chat.forking") : translate("chat.run")}
        </span>
      </div>
    </button>
  );
  return (
    <div className="p-2">
      {/* While a turn runs the fork rows stay, greyed; the mark says why. */}
      {busy ? (
        <div className="flex items-center gap-1">
          {forkLatest}
          <ErrorMark kind="unavailable" message={translate("chat.forkIsOnlyAvailableWhileTheThread")} />
        </div>
      ) : forkLatest}
      {forkFromTurnAvailable ? (
        <button
          type="button"
          disabled={busy || forkBusy}
          onClick={(event) => {
            event.stopPropagation();
            void onSelectForkTurnPanel();
          }}
          className={`${composerMenuItemClassName} mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{translate("chat.forkFromSelectedTurn")}</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
              {translate("chat.pick")}</span>
          </div>
        </button>
      ) : null}
    </div>
  );
}

interface ComposerForkTurnsPanelProps {
  forkTurnOptionsState: SlashPanelState<ThreadForkTurnOptionDto[]>;
  forkBusy: boolean;
  composerPanelButtonClassName: string;
  onForkTurn: (turnId: string) => Promise<void> | void;
  /** Load the turns again after a failed load. */
  onRetry?: () => Promise<void> | void;
}

export function ComposerForkTurnsPanel({
  forkTurnOptionsState,
  forkBusy,
  composerPanelButtonClassName,
  onForkTurn,
  onRetry,
}: ComposerForkTurnsPanelProps) {
  const { locale: i18nLocale } = useI18n();
  return (
    <div className="p-2">
      {forkTurnOptionsState.status === 'loading' &&
      !forkTurnOptionsState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.loadingTurns")}</p>
      ) : null}
      {/* A failed reload keeps the turns already listed; only an empty list says so. */}
      {forkTurnOptionsState.error && !forkTurnOptionsState.data?.length ? (
        <div className="flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          <span className="min-w-0">{translate("workbench.unableToLoadTurnsForForking")}</span>
          <ErrorMark message={forkTurnOptionsState.error} onRetry={onRetry ? () => void onRetry() : undefined} />
        </div>
      ) : null}
      {forkTurnOptionsState.data?.length ? (
        <div className="space-y-2">
          {forkTurnOptionsState.data.map((turn) => (
            <button
              key={turn.turnId}
              type="button"
              disabled={forkBusy}
              onClick={() => void onForkTurn(turn.turnId)}
              className={`${composerPanelButtonClassName} block w-full rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-stone-100">
                  {translate("chat.turn")} {turn.turnIndex}
                </span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                  {forkBusy ? translate("chat.forking") : turn.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {forkTurnOptionsState.status !== 'loading' &&
      !forkTurnOptionsState.error &&
      (forkTurnOptionsState.data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.noTurnsAvailableToForkYet")}</p>
      ) : null}
    </div>
  );
}
