import { translate, useI18n } from '../../i18n';
import type {
  ModelOptionDto,
  ReasoningEffortDto,
  ThreadContextUsageDto,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';
import type { CSSProperties, ReactNode } from 'react';

import { InputGroupButton } from '../graph-ui/InputGroup';
import type { SettingsMenu } from './types';
import { formatReasoningEffortLabel, reasoningEffortColor } from './composerUtils';
import { ComposerContextControl, type ThreadContextInspector } from './ComposerContextControl';
import { ComposerModelPicker } from './modelPicker/ComposerModelPicker';
import type { ComposerModelPickerSource } from './modelPicker/modelPickerLogic';
import { ChevronDown, Loader2, Send, Target } from 'lucide-react';
import { useThemeFeature } from '../themeHooks';

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
  liveModelSwitch = false,
  modelOptions,
  contextUsage,
  contextInspector,
  onCompact,
  onOpenHarness,
  modelPicker,
  compactBusy = false,
  compactDisabled = false,
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
  sending = false,
  sendProgress = null,
  sendUnavailable = null,
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
  /** A model or effort chosen while a turn runs applies from its next model
      call; otherwise from the next turn. */
  liveModelSwitch?: boolean;
  modelOptions: ModelOptionDto[];
  contextUsage: ThreadContextUsageDto | null | undefined;
  contextInspector?: ThreadContextInspector | null | undefined;
  /** Present where this thread can be compacted. */
  onCompact?: (() => Promise<void> | void) | undefined;
  onOpenHarness?: (() => void) | undefined;
  /** Model facts and, for an owner, switching the thread to another agent. */
  modelPicker?: ComposerModelPickerSource | undefined;
  compactBusy?: boolean;
  compactDisabled?: boolean;
  reasoningEffort: ReasoningEffortDto | null | undefined;
  supportedEfforts: ModelOptionDto['supportedReasoningEfforts'];
  settingsBusy: boolean;
  goalComposeMode: boolean;
  goalBusy: boolean;
  activeView: 'chat' | 'shell';
  disabled: boolean;
  /** No text or attachment to send yet. */
  promptEmpty?: boolean;
  fastMode: boolean;
  sendButtonLabel: string;
  /** A prompt is on its way: the key turns into a spinner until it lands. */
  sending?: boolean;
  /** Files of this prompt still uploading, 0–1: the send key shows a ring that
      fills instead of a spinner, since this can take minutes (§6). */
  sendProgress?: number | null;
  /** Why sending cannot work now (a dropped connection): the key greys out,
      says why on hover and to screen readers, and the draft stays editable. */
  sendUnavailable?: string | null;
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
      <div className="composer-model-control relative min-w-0" data-with-context={model ? 'true' : undefined}>
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
            settingsBusy || (!onOpenHarness && (modelControlsDisabled || modelOptions.length === 0))
          }
          onClick={() =>
            onSetOpenMenu((current) => (current === 'model' ? null : 'model'))
          }
          data-testid="composer-model-label"
          title={`${selectedModelLabel}${supportsEffort ? ` · ${effortLabel}` : ''}`}
          className="composer-model-label flex flex-col items-center justify-center whitespace-nowrap px-1 text-xs text-stone-400"
        >
          {modelAvatar && agent ? (
            <span className="matter-thread-avatar composer-model-avatar" data-agent={agent} aria-hidden="true" />
          ) : null}
          <span className="composer-model-name">{selectedModelLabel}</span>
          {supportsEffort && (
            <span className="composer-model-effort" data-effort={reasoningEffort ?? undefined}
              style={{ '--effort-color': reasoningEffortColor(reasoningEffort) } as CSSProperties}>{effortLabel}</span>
          )}
          {modelAvatar ? <ChevronDown aria-hidden="true" className="composer-model-chevron" /> : null}
        </button>
        {model ? (
          <ComposerContextControl
            open={openMenu === 'context'}
            contextUsage={contextUsage}
            inspector={contextInspector}
            modelLabel={selectedModelLabel}
            agent={agent}
            onCompact={onCompact}
            compactBusy={compactBusy}
            compactDisabled={compactDisabled}
            onToggle={() => onSetOpenMenu((current) => (current === 'context' ? null : 'context'))}
            onClose={() => onSetOpenMenu(() => null)}
          />
        ) : null}
        {openMenu === 'model' && (
          <ComposerModelPicker
            model={model}
            modelOptions={modelOptions}
            reasoningEffort={reasoningEffort}
            supportedEfforts={supportedEfforts}
            running={queueing}
            liveModelSwitch={liveModelSwitch}
            modelDisabled={modelControlsDisabled || settingsBusy}
            effortDisabled={effortControlsDisabled || settingsBusy}
            source={modelPicker}
            onUpdateSettings={onUpdateSettings}
            onOpenHarness={onOpenHarness}
            onClose={() => onSetOpenMenu(() => null)}
          />
        )}
      </div>

      {beforeSend}
      <InputGroupButton
        type="submit"
        variant="default"
        size="icon-xs"
        data-send-intent={goalComposeMode ? 'goal' : sendLater ? 'queue' : 'send'}
        data-empty={sendEmpty ? 'true' : undefined}
        data-unavailable={sendUnavailable ? 'true' : undefined}
        aria-label={sendUnavailable ? translate('chat.sendUnavailableLabel', { value1: sendIntentLabel, value2: sendUnavailable }) : sendIntentLabel}
        aria-disabled={sendEmpty || Boolean(sendUnavailable) || undefined}
        aria-busy={sending || undefined}
        data-sending={sending ? 'true' : undefined}
        title={sendUnavailable ?? (sendEmpty ? translate('chat.typeToSend') : sendLater || goalComposeMode ? sendIntentLabel : sendButtonLabel)}
        disabled={goalBusy || (activeView === 'chat' ? disabled : false)}
        className={`${sendButtonBaseClassName} h-9 w-9 rounded-full text-sm font-medium disabled:cursor-not-allowed sm:h-8 sm:w-8 ${sendButtonClassName}`}
      >
        {sending && !goalComposeMode && sendProgress !== null ? (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="composer-send-progress h-[18px] w-[18px]">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.4" />
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              pathLength={100} strokeDasharray={`${Math.max(2, Math.round(sendProgress * 100))} 100`} transform="rotate(-90 10 10)" />
          </svg>
        ) : sending && !goalComposeMode ? (
          <Loader2 aria-hidden="true" className="composer-send-spinner h-[17px] w-[17px] request-spin" strokeWidth={2.4} />
        ) : goalComposeMode ? (
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
