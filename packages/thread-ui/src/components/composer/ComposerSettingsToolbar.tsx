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
import { formatContextTokenKilocount, formatReasoningEffortLabel } from './composerUtils';
import { ContextProgressBar } from './composerPresentation';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import { Check, ChevronDown, Send, Target } from 'lucide-react';
import { useThemeFeature } from '../themeHooks';
import { ComposerReasoningSlider } from './ComposerReasoningSlider';

/** Send, but later: an up arrow with a small clock. */
function SendLaterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="composer-send-later h-[18px] w-[18px] fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19V5" />
      <path d="m4 10 5-5 5 5" />
      <circle cx="17.5" cy="16.5" r="4.5" />
      <path d="M17.5 14.5v2l1.3 1" />
    </svg>
  );
}

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
  promptEmpty = false,
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
  /** No text or attachment to send yet. */
  promptEmpty?: boolean;
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
  // Theme flags: the harness avatar and a chevron on the model chip, and a
  // paper plane for sending now. Every theme shows the same three intents.
  const modelAvatar = useThemeFeature('composer.modelAvatar');
  const intentIcons = useThemeFeature('composer.intentIcons');
  // A turn is running: sending now adds the prompt to run after it.
  const sendLater = queueing && activeView === 'chat' && !goalComposeMode;
  const sendIntentLabel = goalComposeMode
    ? translate('chat.setGoal')
    : sendLater
      ? translate('chat.sendAfterTurn')
      : translate('chat.sendPrompt');
  // Nothing to send yet: the button looks off but stays focusable and says why.
  const sendEmpty = promptEmpty && !goalBusy && !(activeView === 'chat' && disabled);
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
          {modelAvatar && agent ? (
            <span className="matter-thread-avatar composer-model-avatar" data-agent={agent} aria-hidden="true" />
          ) : null}
          <span className="composer-model-name">{selectedModelLabel}</span>
          {supportsEffort && (
            <span className="composer-model-effort">{effortLabel}</span>
          )}
          {modelAvatar ? <ChevronDown aria-hidden="true" className="composer-model-chevron" /> : null}
        </button>
        {model ? <ContextProgressBar contextUsage={contextUsage} /> : null}
        {openMenu === 'model' && (
          <ComposerMenuSurface
            align="end"
            className="composer-model-menu w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1.5 text-[var(--theme-fg)] shadow-xl"
          >
            <p className="composer-model-menu-heading px-2 py-1 text-xs text-[var(--theme-fg-muted)]">
              {translate('chat.model')}
            </p>
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
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed"
              >
                <span>{entry.displayName}</span>
                {entry.model === model && (
                  <Check size={14} className="shrink-0" />
                )}
              </button>
            ))}
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
            <div className="composer-context-summary" title={modelContextTitle}>
              <span>{translate('chat.context')}</span>
              <span className="composer-context-value">
                {contextUsage?.availability === 'available' && contextUsage.tokensInContextWindow != null && Number.isFinite(contextUsage.tokensInContextWindow)
                  ? formatContextTokenKilocount(Math.max(0, contextUsage.tokensInContextWindow)).toUpperCase() : '—'}
                <span className="composer-context-separator"> / </span>
                {contextUsage?.modelContextWindow != null && Number.isFinite(contextUsage.modelContextWindow) && contextUsage.modelContextWindow > 0
                  ? formatContextTokenKilocount(contextUsage.modelContextWindow).toUpperCase() : '—'}
              </span>
            </div>
          </ComposerMenuSurface>
        )}
      </div>

      {beforeSend}
      <InputGroupButton
        type="submit"
        variant="default"
        size="icon-xs"
        data-send-intent={goalComposeMode ? 'goal' : sendLater ? 'queue' : 'send'}
        data-empty={sendEmpty ? 'true' : undefined}
        aria-label={sendIntentLabel}
        aria-disabled={sendEmpty || undefined}
        title={sendEmpty ? translate('chat.typeToSend') : sendLater || goalComposeMode ? sendIntentLabel : sendButtonLabel}
        disabled={goalBusy || (activeView === 'chat' ? disabled : false)}
        className={`${sendButtonBaseClassName} h-9 w-9 rounded-full text-sm font-medium disabled:cursor-not-allowed sm:h-8 sm:w-8 ${sendButtonClassName}`}
      >
        {goalComposeMode ? (
          <Target aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.2} />
        ) : sendLater ? (
          <SendLaterIcon />
        ) : intentIcons ? (
          <Send aria-hidden="true" className="composer-send-plane h-[17px] w-[17px]" strokeWidth={2.2} />
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
