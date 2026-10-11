import { translate, useI18n } from '../../i18n';
import type {
  ModelOptionDto,
  ReasoningEffortDto,
  SandboxModeDto,
  ThreadContextUsageDto,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';
import type { ReactNode } from 'react';

import { InputGroupButton } from '../graph-ui/InputGroup';
import type { SettingsMenu } from './types';
import { formatReasoningEffortLabel } from './composerUtils';
import { ContextProgressBar } from './composerPresentation';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import { Check, ChevronDown, ListPlus, Send, Target } from 'lucide-react';
import { useDocumentThemePreset } from '../themeHooks';
import { ComposerReasoningSlider } from './ComposerReasoningSlider';

export function ComposerSettingsToolbar({
  openMenu,
  model,
  agent,
  queueing = false,
  modelOptions,
  modelContextTitle,
  contextUsage,
  reasoningEffort,
  supportedEfforts,
  modelControlsDisabled,
  effortControlsDisabled,
  settingsBusy,
  goalComposeMode,
  goalBusy,
  activeView,
  disabled,
  sendButtonLabel,
  sendButtonClassName,
  sendButtonBaseClassName,
  beforeSend,
  onSetOpenMenu,
  onUpdateSettings,
}: {
  beforeSend?: ReactNode;
  openMenu: SettingsMenu;
  model: string | null | undefined;
  agent?: string | undefined;
  /** A turn is running, so sending adds the prompt to its queue. */
  queueing?: boolean;
  modelOptions: ModelOptionDto[];
  modelContextTitle: string;
  contextUsage: ThreadContextUsageDto | null | undefined;
  reasoningEffort: ReasoningEffortDto | null | undefined;
  supportedEfforts: ModelOptionDto['supportedReasoningEfforts'];
  sandboxMode: SandboxModeDto | null | undefined;
  sandboxModeAvailable: boolean;
  settingsBusy: boolean;
  goalComposeMode: boolean;
  goalBusy: boolean;
  activeView: 'chat' | 'shell';
  disabled: boolean;
  fastMode: boolean;
  sendButtonLabel: string;
  sendButtonClassName: string;
  modelControlsDisabled: boolean;
  effortControlsDisabled: boolean;
  effortControlTitle: string;
  inlineToggleClassName: string;
  menuItemClassName: string;
  sendButtonBaseClassName: string;
  onSetOpenMenu: (updater: (current: SettingsMenu) => SettingsMenu) => void;
  onUpdateSettings: (input: UpdateThreadSettingsInput) => void;
}) {
  useI18n();
  // Plum Pocket shows the harness mascot, a menu chevron and per-intent send icons.
  const plum = useDocumentThemePreset() === 'plum-pocket';
  const selectedModelLabel =
    modelOptions.find((entry) => entry.model === model)?.displayName ||
    model ||
    translate('chat.selectModel');
  const supportsEffort = supportedEfforts.length > 0;
  const effortLabel = formatReasoningEffortLabel(reasoningEffort);

  return (
    <>
      <div className="composer-model-control relative min-w-0">
        <button
          type="button"
          data-composer-menu-trigger="true"
          aria-label={
            supportsEffort
              ? translate('chat.modelAndEffort', {
                  value1: selectedModelLabel,
                  value2: effortLabel,
                })
              : selectedModelLabel
          }
          aria-haspopup="menu"
          aria-expanded={openMenu === 'model'}
          disabled={
            modelControlsDisabled || settingsBusy || modelOptions.length === 0
          }
          onClick={() =>
            onSetOpenMenu((current) => (current === 'model' ? null : 'model'))
          }
          data-testid="composer-model-label"
          title={`${selectedModelLabel}${supportsEffort ? ` · ${effortLabel}` : ''}\n${modelContextTitle}`}
          className="composer-model-label flex flex-col items-center justify-center whitespace-nowrap px-1 text-xs text-stone-400"
        >
          {plum && agent ? (
            <span className="matter-thread-avatar composer-model-avatar" data-agent={agent} aria-hidden="true" />
          ) : null}
          <span className="composer-model-name">{selectedModelLabel}</span>
          {supportsEffort && (
            <span className="composer-model-effort">{effortLabel}</span>
          )}
          {plum ? <ChevronDown aria-hidden="true" className="composer-model-chevron" /> : null}
        </button>
        {model ? <ContextProgressBar contextUsage={contextUsage} /> : null}
        {openMenu === 'model' && (
          <ComposerMenuSurface
            align="end"
            className="w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1.5 text-[var(--theme-fg)] shadow-xl"
          >
            <p className="px-3 py-2 text-xs text-[var(--theme-fg-muted)]">
              {translate('chat.model')}
            </p>
            <div className="max-h-[min(280px,35dvh)] overflow-y-auto">
              {modelOptions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={entry.model === model}
                  disabled={modelControlsDisabled || settingsBusy}
                  onClick={() =>
                    onUpdateSettings({
                      model: entry.model,
                      reasoningEffort: entry.defaultReasoningEffort ?? null,
                    })
                  }
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed"
                >
                  <span>{entry.displayName}</span>
                  {entry.model === model && (
                    <Check size={14} className="shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {supportedEfforts.length > 0 && (
              <ComposerReasoningSlider
                key={model}
                efforts={supportedEfforts}
                effort={reasoningEffort}
                defaultEffort={
                  modelOptions.find((entry) => entry.model === model)
                    ?.defaultReasoningEffort
                }
                disabled={effortControlsDisabled || settingsBusy}
                onCommit={(next) => onUpdateSettings({ reasoningEffort: next })}
              />
            )}
          </ComposerMenuSurface>
        )}
      </div>

      {beforeSend}
      <InputGroupButton
        type="submit"
        variant="default"
        size="icon-xs"
        aria-label={
          goalComposeMode
            ? translate('chat.setGoal')
            : translate('chat.sendPrompt')
        }
        title={sendButtonLabel}
        disabled={goalBusy || (activeView === 'chat' ? disabled : false)}
        className={`${sendButtonBaseClassName} h-9 w-9 rounded-full text-sm font-medium disabled:cursor-not-allowed sm:h-8 sm:w-8 ${sendButtonClassName}`}
      >
        {plum ? (
          goalComposeMode ? (
            <Target aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.2} />
          ) : queueing && activeView === 'chat' ? (
            <ListPlus aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.2} />
          ) : (
            <Send aria-hidden="true" className="composer-send-plane h-[17px] w-[17px]" strokeWidth={2.2} />
          )
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 13V3" />
            <path d="m4 7 4-4 4 4" />
          </svg>
        )}
      </InputGroupButton>
    </>
  );
}
