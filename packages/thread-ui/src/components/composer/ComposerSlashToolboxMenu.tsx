import { translate, useI18n } from '../../i18n';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import type {
  AgentBackendToolboxItemSchemaDto,
  AgentHookDto,
  AgentHookEventNameDto,
  CollaborationModeDto,
  ThreadForkTurnOptionDto,
  ThreadHooksDto,
  ThreadMcpServersDto,
  ThreadSkillsDto,
  ThreadGoalDto,
  UpdateThreadHookInput,
  UpdateThreadGoalInput,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';
import type { ComponentType, MouseEvent, SVGProps } from 'react';
import {
  CircleSlash,
  GitFork,
  History,
  ListChecks,
  MessageSquarePlus,
  Plug,
  Shrink,
  SlidersHorizontal,
  Sparkles,
  Target,
  Webhook,
  Zap,
} from 'lucide-react';
import { useThemeFeature } from '../themeHooks';

import { InputGroupButton } from '../graph-ui/InputGroup';
import { SlashIcon } from './composerPresentation';
import {
  ComposerForkPanel,
  ComposerForkTurnsPanel,
} from './ComposerForkPanels';
import { ComposerHooksPanel } from './ComposerHooksPanel';
import { ComposerGoalsPanel } from './ComposerGoalsPanel';
import { ComposerMcpPanel } from './ComposerMcpPanel';
import { ComposerSkillsPanel } from './ComposerSkillsPanel';
import type {
  HookScope,
  HooksPanelMode,
  McpPanelMode,
  SlashPanelState,
  SlashPanelView,
} from './types';

// With rich menus every toolbox row gets an icon tile and its description.
const toolboxIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  plan: ListChecks,
  goal: Target,
  fast: Zap,
  compact: Shrink,
  fork: GitFork,
  skills: Sparkles,
  mcp: Plug,
  hooks: Webhook,
  harness: SlidersHorizontal,
  prompt: MessageSquarePlus,
  unsupported: CircleSlash,
};

function ToolboxLabel({ rich, action, command, description }: {
  rich: boolean;
  action: string;
  command: string;
  description?: string | null | undefined;
}) {
  if (!rich) return <span>{command}</span>;
  const Icon = toolboxIcons[action] ?? MessageSquarePlus;
  return (
    <>
      <span className="composer-toolbox-icon" aria-hidden="true"><Icon data-icon={toolboxIcons[action] ? action : 'prompt'} /></span>
      <span className="composer-toolbox-text">
        <span className="composer-toolbox-command">{command}</span>
        {description ? <span className="composer-toolbox-description">{description}</span> : null}
      </span>
    </>
  );
}

export function ComposerSlashToolboxMenu({
  open,
  slashPanelView,
  slashQuery = null,
  slashActive = 0,
  availableToolboxItems,
  planModeAvailable,
  forkFromTurnAvailable,
  displayedCollaborationMode,
  settingsBusy,
  busy,
  forkBusy,
  forkError,
  forkTurnOptionsState,
  skillsState,
  goalState,
  goalHistory,
  goalBusy,
  copiedSkillName,
  hooksPanelMode,
  hooksState,
  hostConfigFilesAvailable,
  hookTrustAvailable,
  hookConfigBusy,
  hookConfigError,
  hookConfigSuccess,
  editingHookTarget,
  hookScope,
  hookEventName,
  hookMatcher,
  hookCommand,
  hookTimeoutSec,
  hookStatusMessage,
  mcpPanelMode,
  mcpState,
  mcpConfigEditing,
  mcpConfigPath,
  mcpConfigError,
  mcpConfigSuccess,
  mcpConfigBusy,
  mcpHttpName,
  mcpHttpUrl,
  mcpRawBlock,
  iconButtonClassName,
  menuClassName,
  menuItemClassName,
  panelButtonClassName,
  chipButtonClassName,
  onToggle,
  onToolboxItemClick,
  onUpdateSettings,
  toolboxItemDisabled,
  toolboxItemClassName,
  toolboxItemStatus,
  onSetSlashPanelView,
  onViewGoals,
  onUpdateGoal,
  onOpenForkTurns,
  onForkLatest,
  onForkTurn,
  onCopySkillInvokeName,
  onResetHookForm,
  onSetHooksPanelMode,
  onClearHookConfigStatus,
  onSetEditingHookTarget,
  onSetHookScope,
  onSetHookEventName,
  onSetHookMatcher,
  onSetHookCommand,
  onSetHookTimeoutSec,
  onSetHookStatusMessage,
  onSaveHook,
  onStartEditingHook,
  onTrustHook,
  onUntrustHook,
  onSetMcpPanelMode,
  onClearMcpConfigStatus,
  onSetMcpHttpName,
  onSetMcpHttpUrl,
  onSetMcpRawBlock,
  onPrepareRawMcpBlock,
  onSaveHttpMcp,
  onSaveRawMcpBlock,
}: {
  open: boolean;
  slashPanelView: SlashPanelView;
  /** What follows a typed `/`: rows not starting with it are hidden. */
  slashQuery?: string | null;
  /** The row Enter would run, among the shown ones. */
  slashActive?: number;
  availableToolboxItems: AgentBackendToolboxItemSchemaDto[];
  planModeAvailable: boolean;
  forkFromTurnAvailable: boolean;
  displayedCollaborationMode: CollaborationModeDto;
  settingsBusy: boolean;
  busy: boolean;
  forkBusy: boolean;
  forkError?: string | null;
  forkTurnOptionsState: SlashPanelState<ThreadForkTurnOptionDto[]>;
  skillsState: SlashPanelState<ThreadSkillsDto>;
  goalState: SlashPanelState<ThreadGoalDto | null | undefined>;
  goalHistory: ThreadGoalDto[];
  goalBusy: boolean;
  copiedSkillName: string | null;
  hooksPanelMode: HooksPanelMode;
  hooksState: SlashPanelState<ThreadHooksDto>;
  hostConfigFilesAvailable: boolean;
  hookTrustAvailable: boolean;
  hookConfigBusy: boolean;
  hookConfigError: string | null;
  hookConfigSuccess: string | null;
  editingHookTarget: UpdateThreadHookInput['target'] | null;
  hookScope: HookScope;
  hookEventName: AgentHookEventNameDto;
  hookMatcher: string;
  hookCommand: string;
  hookTimeoutSec: string;
  hookStatusMessage: string;
  mcpPanelMode: McpPanelMode;
  mcpState: SlashPanelState<ThreadMcpServersDto>;
  mcpConfigEditing: boolean;
  mcpConfigPath: string | null;
  mcpConfigError: string | null;
  mcpConfigSuccess: string | null;
  mcpConfigBusy: boolean;
  mcpHttpName: string;
  mcpHttpUrl: string;
  mcpRawBlock: string;
  iconButtonClassName: string;
  menuClassName: string;
  menuItemClassName: string;
  panelButtonClassName: string;
  chipButtonClassName: string;
  onToggle: () => void;
  onToolboxItemClick: (
    item: AgentBackendToolboxItemSchemaDto,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onUpdateSettings: (input: UpdateThreadSettingsInput) => void;
  toolboxItemDisabled: (item: AgentBackendToolboxItemSchemaDto) => boolean;
  toolboxItemClassName: (item: AgentBackendToolboxItemSchemaDto) => string;
  toolboxItemStatus: (item: AgentBackendToolboxItemSchemaDto) => string;
  onSetSlashPanelView: (view: SlashPanelView) => void;
  onViewGoals?: () => Promise<void> | void;
  onUpdateGoal?: (input: UpdateThreadGoalInput) => Promise<void> | void;
  onOpenForkTurns: () => Promise<void> | void;
  onForkLatest: () => Promise<void> | void;
  onForkTurn: (turnId: string) => Promise<void> | void;
  onCopySkillInvokeName: (skillName: string) => Promise<void> | void;
  onResetHookForm: () => void;
  onSetHooksPanelMode: (mode: HooksPanelMode) => void;
  onClearHookConfigStatus: () => void;
  onSetEditingHookTarget: (
    target: UpdateThreadHookInput['target'] | null,
  ) => void;
  onSetHookScope: (scope: HookScope) => void;
  onSetHookEventName: (eventName: AgentHookEventNameDto) => void;
  onSetHookMatcher: (value: string) => void;
  onSetHookCommand: (value: string) => void;
  onSetHookTimeoutSec: (value: string) => void;
  onSetHookStatusMessage: (value: string) => void;
  onSaveHook: () => Promise<void> | void;
  onStartEditingHook: (hook: AgentHookDto) => void;
  onTrustHook: (hook: AgentHookDto) => Promise<void> | void;
  onUntrustHook: (hook: AgentHookDto) => Promise<void> | void;
  onSetMcpPanelMode: (mode: McpPanelMode) => void;
  onClearMcpConfigStatus: () => void;
  onSetMcpHttpName: (value: string) => void;
  onSetMcpHttpUrl: (value: string) => void;
  onSetMcpRawBlock: (value: string) => void;
  onPrepareRawMcpBlock: () => Promise<void> | void;
  onSaveHttpMcp: () => Promise<void> | void;
  onSaveRawMcpBlock: () => Promise<void> | void;
}) {
  useI18n();
  const rich = useThemeFeature('composer.richMenus');
  const matches = (command: string) => slashQuery === null || command.slice(1).toLowerCase().startsWith(slashQuery.toLowerCase());
  const planShown = planModeAvailable && matches('/plan');
  const shownItems = availableToolboxItems.filter(item => matches(item.command));
  // Rows in the order Enter cycles through them.
  const activeCommand = [...(planShown ? ['/plan'] : []), ...shownItems.map(item => item.command)][slashActive];
  const activeProps = (command: string) => ({
    'data-slash-row': true,
    'data-active': slashQuery !== null && command === activeCommand ? true : undefined,
  });
  const panelCommand: Partial<Record<SlashPanelView, string>> = { fork: '/fork', forkTurns: '/fork', skills: '/skills', hooks: '/hooks', mcp: '/mcp' };
  return (
    <div className="relative">
      <InputGroupButton
        type="button"
        variant="ghost"
        size="icon-xs"
        data-composer-menu-trigger="true"
        aria-label={translate("chat.openSlashToolbox")}
        title={translate("chat.openSlashToolbox")}
        onClick={onToggle}
        className={`${iconButtonClassName} h-9 w-9 rounded-full sm:h-8 sm:w-8`}
      >
        {rich ? <span aria-hidden="true" className="composer-slash-glyph">/</span> : <SlashIcon />}
      </InputGroupButton>

      {open && (
        <ComposerMenuSurface
          align="start"
          className={`${menuClassName} w-72 rounded-2xl border bg-stone-900/72 shadow-2xl shadow-stone-950/20 backdrop-blur-xl`}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
          }}
        >
          {slashPanelView === 'root' ? (
            <div className="p-2">
              {planShown ? (
                <button
                  type="button"
                  {...activeProps('/plan')}
                  data-toolbox-action="plan"
                  aria-pressed={displayedCollaborationMode === 'plan'}
                  disabled={settingsBusy}
                  onClick={() =>
                    onUpdateSettings({
                      collaborationMode:
                        displayedCollaborationMode === 'plan'
                          ? 'default'
                          : 'plan',
                    })
                  }
                  className={`${
                    displayedCollaborationMode === 'plan'
                      ? 'ui-status-warning'
                      : menuItemClassName
                  } block w-full rounded-xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60`}
                  title={translate("chat.togglePlanMode")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <ToolboxLabel rich={rich} action="plan" command="/plan" />
                    <span className="composer-toolbox-status text-[11px] uppercase tracking-[0.16em] text-stone-400">
                      {displayedCollaborationMode === 'plan' ? translate("chat.on") : translate("chat.off")}
                    </span>
                  </div>
                </button>
              ) : null}
              {shownItems.map((item, index) =>
                item.action === 'goal' ? (
                  // The row sets a goal like the others run their tool; the history
                  // of earlier goals is the button at its end.
                  <div
                    key={`${item.action}:${item.command}`}
                    data-toolbox-action={item.action}
                    className={`composer-toolbox-split mt-1 flex min-h-11 overflow-hidden rounded-xl ${index === 0 && !planShown ? 'mt-0' : ''}`}
                    title={item.description ?? item.label}
                  >
                    <button
                      type="button"
                      {...activeProps(item.command)}
                      disabled={toolboxItemDisabled(item)}
                      onClick={(event) => onToolboxItemClick(item, event)}
                      className={`${toolboxItemClassName(item)} mt-0 min-w-0 flex-1`}
                      aria-label={translate("chat.openGoalComposer")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <ToolboxLabel rich={rich} action={item.action} command={item.command} description={item.description} />
                        <span className="composer-toolbox-status text-[11px] uppercase tracking-[0.16em] text-stone-400">
                          {toolboxItemStatus(item)}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={toolboxItemDisabled(item)}
                      onClick={() => {
                        onSetSlashPanelView('goals');
                        void onViewGoals?.();
                      }}
                      className="grid w-11 shrink-0 place-items-center rounded-xl text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-accent-border)] disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label={translate("chat.viewGoals")}
                      title={translate("chat.viewGoals")}
                    >
                      <History aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    key={`${item.action}:${item.command}`}
                    type="button"
                    {...activeProps(item.command)}
                    data-toolbox-action={item.action}
                    disabled={toolboxItemDisabled(item)}
                    onClick={(event) => onToolboxItemClick(item, event)}
                    className={`${toolboxItemClassName(item)} ${index === 0 && !planShown ? 'mt-0' : ''}`}
                    title={item.description ?? item.label}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <ToolboxLabel rich={rich} action={item.action} command={item.command} description={item.description} />
                      <span className="composer-toolbox-status text-[11px] uppercase tracking-[0.16em] text-stone-400">
                        {toolboxItemStatus(item)}
                      </span>
                    </div>
                  </button>
                ),
              )}
              {availableToolboxItems.length === 0 && !planModeAvailable ? (
                <p className="px-3 py-2 text-sm text-stone-400">
                  {translate("chat.noBackendToolsAreAvailableForThis")}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 max-h-80 flex-col">
              {forkBusy && (slashPanelView === 'fork' || slashPanelView === 'forkTurns') ? (
                <p role="status" className="shrink-0 px-3 py-2 text-sm text-[var(--theme-fg-muted)]">
                  {translate("chat.creatingForkYouWillBeTakenTo")}</p>
              ) : null}
              {forkError && (slashPanelView === 'fork' || slashPanelView === 'forkTurns') ? (
                <p role="alert" className="m-2 shrink-0 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-3 text-sm text-[var(--status-danger-fg)]">
                  {forkError}
                </p>
              ) : null}
              {/* Every second-level panel leads back to the toolbox; goals has its own header. */}
              {panelCommand[slashPanelView] ? (
                <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onSetSlashPanelView('root')}
                    className="min-h-9 rounded-lg px-2 text-xs font-medium text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)]"
                  >
                    {translate("chat.back")}</button>
                  <span className="text-xs font-semibold text-[var(--theme-fg)]">{panelCommand[slashPanelView]}</span>
                </div>
              ) : null}
              <div className="min-h-0 overflow-auto">
              {slashPanelView === 'goals' ? (
                <ComposerGoalsPanel
                  goalState={goalState}
                  goalHistory={goalHistory}
                  busy={goalBusy}
                  onBack={() => onSetSlashPanelView('root')}
                  onUpdateGoal={onUpdateGoal}
                />
              ) : slashPanelView === 'fork' ? (
                <ComposerForkPanel
                  busy={busy}
                  forkBusy={forkBusy}
                  forkFromTurnAvailable={forkFromTurnAvailable}
                  composerMenuItemClassName={menuItemClassName}
                  onForkLatest={onForkLatest}
                  onSelectForkTurnPanel={() => {
                    onSetSlashPanelView('forkTurns');
                    return onOpenForkTurns();
                  }}
                />
              ) : slashPanelView === 'forkTurns' ? (
                <ComposerForkTurnsPanel
                  forkTurnOptionsState={forkTurnOptionsState}
                  forkBusy={forkBusy}
                  composerPanelButtonClassName={panelButtonClassName}
                  onForkTurn={onForkTurn}
                />
              ) : slashPanelView === 'skills' ? (
                <ComposerSkillsPanel
                  skillsState={skillsState}
                  copiedSkillName={copiedSkillName}
                  composerChipButtonClassName={chipButtonClassName}
                  onCopySkillInvokeName={onCopySkillInvokeName}
                />
              ) : slashPanelView === 'hooks' ? (
                <ComposerHooksPanel
                  hooksPanelMode={hooksPanelMode}
                  hooksState={hooksState}
                  hostConfigFilesAvailable={hostConfigFilesAvailable}
                  hookTrustAvailable={hookTrustAvailable}
                  hookConfigBusy={hookConfigBusy}
                  hookConfigError={hookConfigError}
                  hookConfigSuccess={hookConfigSuccess}
                  editingHookTarget={editingHookTarget}
                  hookScope={hookScope}
                  hookEventName={hookEventName}
                  hookMatcher={hookMatcher}
                  hookCommand={hookCommand}
                  hookTimeoutSec={hookTimeoutSec}
                  hookStatusMessage={hookStatusMessage}
                  composerChipButtonClassName={chipButtonClassName}
                  onResetHookForm={onResetHookForm}
                  onSetHooksPanelMode={onSetHooksPanelMode}
                  onClearHookConfigStatus={onClearHookConfigStatus}
                  onSetEditingHookTarget={onSetEditingHookTarget}
                  onSetHookScope={onSetHookScope}
                  onSetHookEventName={onSetHookEventName}
                  onSetHookMatcher={onSetHookMatcher}
                  onSetHookCommand={onSetHookCommand}
                  onSetHookTimeoutSec={onSetHookTimeoutSec}
                  onSetHookStatusMessage={onSetHookStatusMessage}
                  onSaveHook={onSaveHook}
                  onStartEditingHook={onStartEditingHook}
                  onTrustHook={onTrustHook}
                  onUntrustHook={onUntrustHook}
                />
              ) : (
                <ComposerMcpPanel
                  mcpPanelMode={mcpPanelMode}
                  mcpState={mcpState}
                  mcpConfigEditing={mcpConfigEditing}
                  mcpConfigPath={mcpConfigPath}
                  mcpConfigError={mcpConfigError}
                  mcpConfigSuccess={mcpConfigSuccess}
                  mcpConfigBusy={mcpConfigBusy}
                  mcpHttpName={mcpHttpName}
                  mcpHttpUrl={mcpHttpUrl}
                  mcpRawBlock={mcpRawBlock}
                  composerPanelButtonClassName={panelButtonClassName}
                  composerChipButtonClassName={chipButtonClassName}
                  onSetMcpPanelMode={onSetMcpPanelMode}
                  onClearMcpConfigStatus={onClearMcpConfigStatus}
                  onSetMcpHttpName={onSetMcpHttpName}
                  onSetMcpHttpUrl={onSetMcpHttpUrl}
                  onSetMcpRawBlock={onSetMcpRawBlock}
                  onPrepareRawMcpBlock={onPrepareRawMcpBlock}
                  onSaveHttpMcp={onSaveHttpMcp}
                  onSaveRawMcpBlock={onSaveRawMcpBlock}
                />
              )}
              </div>
            </div>
          )}
        </ComposerMenuSurface>
      )}
    </div>
  );
}
