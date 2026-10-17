import { translate, useI18n } from '../../i18n';
import type {
  AgentHookDto,
  AgentHookEventNameDto,
  CreateThreadHookInput,
  ThreadContextUsageDto,
  ThreadGoalStatusDto,
  ThreadHooksDto,
  ThreadMcpServersDto,
  ThreadSkillsDto,
  UpdateThreadHookInput,
} from '@pockymoe/shared';

import { clampPercent } from './composerUtils';

export const HOOK_EVENT_OPTIONS: Array<{
  value: AgentHookEventNameDto;
  label: string;
  matcherHint: string;
}> = [
  { value: 'preToolUse', label: 'PreToolUse', matcherHint: 'Bash' },
  {
    value: 'permissionRequest',
    label: 'PermissionRequest',
    matcherHint: 'Bash',
  },
  { value: 'postToolUse', label: 'PostToolUse', matcherHint: 'Bash' },
  {
    value: 'sessionStart',
    label: 'SessionStart',
    matcherHint: 'startup|resume',
  },
  { value: 'userPromptSubmit', label: 'UserPromptSubmit', matcherHint: '' },
  { value: 'stop', get label() { return translate("chat.stop"); }, matcherHint: '' },
  { value: 'preCompact', label: 'PreCompact', matcherHint: '' },
  { value: 'postCompact', label: 'PostCompact', matcherHint: '' },
];

export function buildComposerControlState({
  goalComposeMode,
  goalBusy,
  threadConnected,
  busy,
  isShellView,
  disabledPlaceholder,
  settingsBusy,
  supportedEffortCount,
  fastMode,
  sendShortcut = 'ctrlEnter',
}: {
  goalComposeMode: boolean;
  goalBusy: boolean;
  threadConnected: boolean;
  busy: boolean;
  isShellView: boolean;
  disabledPlaceholder?: string | undefined;
  settingsBusy: boolean;
  supportedEffortCount: number;
  fastMode: boolean;
  sendShortcut?: 'ctrlEnter' | 'enter';
}) {
  const promptPlaceholder = goalComposeMode
    ? translate("chat.describeTheGoalTheBackendShouldContinue")
    : (disabledPlaceholder ??
      (isShellView
        ? translate("chat.sendShellInputToTheAttachedTerminal")
        : translate("chat.typeMessage")));
  // Keyboards only: how to send, from the current shortcut setting.
  const promptPlaceholderHint = goalComposeMode || disabledPlaceholder || isShellView
    ? ''
    : translate(sendShortcut === 'enter' ? "chat.enterToSend" : "chat.ctrlEnterToSend");
  const sendButtonLabel = goalComposeMode
    ? goalBusy
      ? translate("chat.setting")
      : translate("chat.setGoal")
    : !threadConnected && busy
      ? translate("chat.connecting")
      : !threadConnected
        ? translate("chat.send")
        : busy && !isShellView
          ? translate("chat.sending")
          : translate("chat.send");
  const sendButtonClassName = !threadConnected
    ? 'ui-action-danger'
    : goalComposeMode
      ? 'ui-action-info'
      : 'ui-action-primary';
  const modelControlsDisabled = settingsBusy;
  const effortControlsDisabled =
    modelControlsDisabled || supportedEffortCount === 0;
  const effortControlTitle = fastMode
    ? translate("chat.fastModeIsOnTurnItOff_a6fd43")
    : supportedEffortCount === 0
      ? translate("chat.theSelectedModelDoesNotExposeAdjustable")
      : translate("chat.selectReasoningEffort");

  return {
    promptPlaceholder,
    promptPlaceholderHint,
    interruptLabel: isShellView ? translate("chat.sendCtrlC") : translate("chat.stopCurrentTurn"),
    sendButtonLabel,
    sendButtonClassName,
    modelControlsDisabled,
    effortControlsDisabled,
    effortControlTitle,
  };
}

export function buildComposerClassNames({
  isShellView,
  edgeToEdgeMobile,
  isMobileShell,
  openMenu,
  isDragTargetActive,
  busy,
}: {
  isShellView: boolean;
  edgeToEdgeMobile: boolean;
  isMobileShell: boolean;
  openMenu: boolean;
  isDragTargetActive: boolean;
  busy: boolean;
}) {
  const composerLayerBaseClassName = isShellView
    ? 'thread-composer-layer thread-shell-composer-layer'
    : 'thread-graph-composer-layer';
  const composerFormBaseClassName = isShellView
    ? 'thread-composer-form'
    : 'thread-graph-composer-form';
  const composerFloatingFormClassName = isShellView
    ? 'thread-composer-form-floating'
    : 'thread-graph-composer-form-floating';
  const composerInputClassName = isShellView
    ? 'thread-composer-input'
    : 'thread-graph-composer-input';

  return {
    composerLayerClassName: openMenu
      ? `${composerLayerBaseClassName} relative z-[80] shrink-0`
      : `${composerLayerBaseClassName} relative z-20 shrink-0`,
    formClassName: isShellView
      ? edgeToEdgeMobile || isMobileShell
        ? `${composerFormBaseClassName} ${composerFloatingFormClassName} relative z-20 shrink-0 border-t border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-4 sm:py-3`
        : `${composerFormBaseClassName} relative z-20 shrink-0 border-t border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-4 sm:py-3`
      : `${composerFormBaseClassName} ${
          edgeToEdgeMobile ? composerFloatingFormClassName : ''
        } relative z-20 shrink-0 border-t px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-4 sm:py-3`,
    composerShellClassName: isShellView
      ? 'thread-composer-shell'
      : 'thread-graph-composer-shell',
    composerToolbarClassName: isShellView
      ? 'thread-composer-toolbar'
      : 'thread-graph-composer-toolbar',
    composerInputClassName,
    composerIconButtonClassName: isShellView
      ? 'thread-composer-icon-button'
      : 'thread-graph-composer-icon-button',
    composerMenuClassName: isShellView
      ? 'thread-composer-menu'
      : 'thread-graph-composer-menu',
    composerMenuItemClassName: isShellView
      ? 'thread-composer-menu-item'
      : 'thread-graph-composer-menu-item',
    composerInlineToggleClassName: isShellView
      ? 'thread-composer-inline-toggle'
      : 'thread-graph-composer-inline-toggle',
    composerPanelButtonClassName: isShellView
      ? 'thread-composer-panel-button'
      : 'thread-graph-composer-panel-button',
    composerChipButtonClassName: isShellView
      ? 'thread-composer-chip-button'
      : 'thread-graph-composer-chip-button',
    composerSendButtonClassName: isShellView
      ? 'thread-composer-send-button'
      : 'thread-graph-composer-send-button',
    composerPromptRegionClassName: isShellView
      ? 'thread-composer-prompt-region'
      : 'thread-graph-composer-prompt-region',
    promptInputClassName: `${composerInputClassName} min-h-[5.25rem] w-full px-4 pr-14 pt-3 outline-none transition sm:min-h-[5.75rem] ${
      isDragTargetActive
        ? 'is-drag-target border-sky-300/80 bg-sky-300/[0.08] shadow-[0_0_0_1px_rgba(125,211,252,0.2)]'
        : ''
    }`,
    graphChatInputGroupClassName: `thread-graph-composer-input-group relative border-0 bg-transparent shadow-none ring-0 ${
      busy ? 'bg-amber-50/40 dark:bg-amber-400/10' : 'bg-transparent'
    }`,
    graphChatInputClassName: `${composerInputClassName} min-h-[68px] max-h-32 w-full overflow-y-auto px-3 pt-3 text-[16px] leading-relaxed text-slate-800 outline-none transition sm:min-h-[92px] sm:max-h-40 sm:px-4 sm:pt-4 sm:text-[14px] dark:text-slate-100 ${
      isDragTargetActive
        ? 'is-drag-target bg-sky-300/[0.08] shadow-[0_0_0_1px_rgba(125,211,252,0.2)]'
        : ''
    }`,
  };
}

export function TerminalIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 5 2 2-2 2" />
      <path d="M7.75 9.5h4.25" />
    </svg>
  );
}

export function PlusIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </svg>
  );
}

export function SlashIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.75 2.5 5.25 13.5" />
      <path d="M4.25 5.25h2.25" />
      <path d="M9.5 10.75h2.25" />
    </svg>
  );
}

export function ChatIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5A1.75 1.75 0 0 1 4.75 2.75h6.5A1.75 1.75 0 0 1 13 4.5v4A1.75 1.75 0 0 1 11.25 10.25H8l-2.75 2v-2H4.75A1.75 1.75 0 0 1 3 8.5v-4Z" />
    </svg>
  );
}

export function WrenchScrewdriverIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5 fill-current"
    >
      <path
        fillRule="evenodd"
        d="M14.5 10C16.9853 10 19 7.98528 19 5.5C19 5.01783 18.9242 4.55338 18.7838 4.11791C18.6792 3.79367 18.2734 3.72683 18.0325 3.96772L15.3402 6.66002C15.2098 6.79041 15.0168 6.84163 14.8466 6.77074C14.1172 6.46695 13.5334 5.88351 13.2292 5.15431C13.1582 4.98403 13.2094 4.79088 13.3398 4.66042L16.0327 1.9676C16.2735 1.72672 16.2067 1.32092 15.8825 1.21636C15.4469 1.07588 14.9823 1 14.5 1C12.0147 1 10 3.01472 10 5.5C10 5.59783 10.0031 5.69494 10.0093 5.79122C10.065 6.66418 9.88174 7.59855 9.20974 8.15855L1.98017 14.1832C1.3591 14.7008 1 15.4674 1 16.2759C1 17.7804 2.21962 19 3.7241 19C4.53256 19 5.29925 18.6409 5.81681 18.0198L11.8414 10.7903C12.4014 10.1183 13.3358 9.93497 14.2088 9.99073C14.3051 9.99688 14.4022 10 14.5 10ZM5 16C5 16.5523 4.55228 17 4 17C3.44772 17 3 16.5523 3 16C3 15.4477 3.44772 15 4 15C4.55228 15 5 15.4477 5 16Z"
        clipRule="evenodd"
      />
      <path d="M14.5 11.5C14.6731 11.5 14.8445 11.4927 15.0138 11.4783L18.7678 15.2323C19.7441 16.2086 19.7441 17.7915 18.7678 18.7678C17.7915 19.7441 16.2086 19.7441 15.2323 18.7678L10.8216 14.3571L12.9938 11.7505C13.0455 11.6885 13.1413 11.6131 13.3357 11.5552C13.5378 11.4951 13.805 11.468 14.1132 11.4877C14.2413 11.4959 14.3702 11.5 14.5 11.5Z" />
      <path d="M6.00003 4.58582L8.33056 6.91635C8.3027 6.95627 8.27496 6.98497 8.24946 7.00622L6.79994 8.21415L4.58582 6.00003H3.30905C3.11966 6.00003 2.94653 5.89303 2.86184 5.72364L1.1612 2.32237C1.06495 2.12987 1.10268 1.89739 1.25486 1.74521L1.74521 1.25486C1.89739 1.10268 2.12987 1.06495 2.32237 1.1612L5.72364 2.86184C5.89303 2.94653 6.00003 3.11966 6.00003 3.30905V4.58582Z" />
    </svg>
  );
}

export function ClipboardIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 3.25h5" />
      <path d="M6.4 2h3.2a.9.9 0 0 1 .9.9v.35h1.3a1.2 1.2 0 0 1 1.2 1.2v7.35a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 11.8V4.45a1.2 1.2 0 0 1 1.2-1.2h1.3V2.9a.9.9 0 0 1 .9-.9Z" />
    </svg>
  );
}

export function authStatusLabel(
  value: ThreadMcpServersDto['servers'][number]['authStatus'],
) {
  switch (value) {
    case 'bearerToken':
      return translate("chat.token");
    case 'oAuth':
      return 'OAuth';
    case 'notLoggedIn':
      return translate("chat.login");
    case 'unsupported':
      return translate("chat.public");
    default:
      return translate("chat.unknown");
  }
}

export function skillScopeLabel(value: ThreadSkillsDto['skills'][number]['scope']) {
  switch (value) {
    case 'repo':
      return translate("chat.repo");
    case 'system':
      return translate("chat.system");
    case 'admin':
      return translate("chat.admin");
    case 'user':
    default:
      return translate("chat.user");
  }
}

export function hookEventLabel(value: AgentHookEventNameDto) {
  return (
    HOOK_EVENT_OPTIONS.find((entry) => entry.value === value)?.label ?? value
  );
}

export function hookSourceLabel(value: ThreadHooksDto['hooks'][number]['source']) {
  switch (value) {
    case 'cloudRequirements':
      return translate("chat.cloud");
    case 'legacyManagedConfigFile':
    case 'legacyManagedConfigMdm':
      return translate("chat.managed");
    case 'sessionFlags':
      return translate("chat.session");
    default:
      return value[0]?.toUpperCase() + value.slice(1);
  }
}

export function hookTrustLabel(value: ThreadHooksDto['hooks'][number]['trustStatus']) {
  switch (value) {
    case 'managed':
      return translate("chat.managed");
    case 'modified':
      return translate("chat.modified");
    case 'trusted':
      return translate("chat.trusted");
    case 'untrusted':
      return translate("chat.review");
  }
}

export function hookEventJsonKey(value: AgentHookEventNameDto) {
  switch (value) {
    case 'preToolUse':
      return 'PreToolUse';
    case 'permissionRequest':
      return 'PermissionRequest';
    case 'postToolUse':
      return 'PostToolUse';
    case 'preCompact':
      return 'PreCompact';
    case 'postCompact':
      return 'PostCompact';
    case 'sessionStart':
      return 'SessionStart';
    case 'userPromptSubmit':
      return 'UserPromptSubmit';
    case 'stop':
      return translate("chat.stop");
  }
}

export function hookScopeFromRecord(
  hook: AgentHookDto,
): CreateThreadHookInput['scope'] | null {
  if (hook.source === 'user') {
    return 'global';
  }
  if (hook.source === 'project') {
    return 'project';
  }
  return null;
}

export function editableHookTarget(
  hook: AgentHookDto,
): UpdateThreadHookInput['target'] | null {
  const scope = hookScopeFromRecord(hook);
  if (
    !scope ||
    hook.handlerType !== 'command' ||
    !hook.command ||
    hook.isManaged
  ) {
    return null;
  }
  return {
    scope,
    eventName: hook.eventName,
    matcher: hook.matcher,
    command: hook.command,
    timeoutSec: hook.timeoutSec,
    statusMessage: hook.statusMessage,
  };
}

export function goalStatusLabel(value: ThreadGoalStatusDto) {
  switch (value) {
    case 'active':
      return translate("chat.active");
    case 'paused':
      return translate("chat.paused");
    case 'budgetLimited':
      return translate("chat.budget");
    case 'complete':
      return translate("chat.complete");
    default:
      return value;
  }
}

export function ContextProgressBar({
  contextUsage,
}: {
  contextUsage: ThreadContextUsageDto | null | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const availability = contextUsage?.availability ?? 'unavailable';
  const percent = clampPercent(contextUsage?.remainingPercent);

  if (availability !== 'available') return null;

  const fillColor =
    percent <= 20
      ? 'rgba(251,113,133,0.90)'
      : percent <= 40
        ? 'rgba(252,211,77,0.85)'
        : 'rgba(125,211,252,0.80)';

  return (
    <span
      aria-hidden="true"
      className="thread-context-progress-track pointer-events-none mt-0.5 block"
    >
      <span
        className="thread-context-progress-fill block"
        style={{
          width: `${percent}%`,
          backgroundColor: fillColor,
        }}
      />
    </span>
  );
}

export function ToolPill({
  label,
  tone = 'stone',
}: {
  label: string;
  tone?: 'stone' | 'rose' | 'sky';
}) {
  const { locale: i18nLocale } = useI18n();
  const toneClassName =
    tone === 'rose'
      ? 'border-rose-300/35 bg-rose-300/14 text-rose-50'
      : tone === 'sky'
        ? 'border-sky-300/35 bg-sky-300/14 text-sky-50'
        : 'border-stone-700/90 bg-stone-900/80 text-stone-100';

  return (
    <span
      className={`inline-flex min-w-[3rem] items-center justify-center rounded-full border px-2 py-1.5 text-[10px] font-medium tracking-[0.12em] ${toneClassName}`}
    >
      {label}
    </span>
  );
}
