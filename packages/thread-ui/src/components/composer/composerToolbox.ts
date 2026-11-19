import { translate, useI18n } from '../../i18n';
import type {
  AgentBackendToolboxItemSchemaDto,
  ThreadGoalStatusDto,
} from '@pockymoe/shared';

import { goalStatusLabel } from './composerPresentation';
import type { SlashPanelView } from './types';

export type ToolboxActionDecision =
  | { type: 'toggleFast'; fastMode: boolean }
  | { type: 'runCompact' }
  | { type: 'enterGoalCompose' }
  | { type: 'exitGoalCompose' }
  | { type: 'openPanel'; panel: Exclude<SlashPanelView, 'root' | 'forkTurns'> }
  | { type: 'insertPrompt'; text: string }
  | { type: 'openHarness' }
  | { type: 'noop' };

export interface ToolboxItemCapabilities {
  compact: boolean;
  fast: boolean;
  fork: boolean;
  goal: boolean;
  hooks: boolean;
  mcp: boolean;
  skills: boolean;
}

export function filterToolboxItemsForCapabilities(
  toolboxItems: AgentBackendToolboxItemSchemaDto[] | null | undefined,
  capabilities: ToolboxItemCapabilities,
) {
  return (toolboxItems ?? []).filter((item) => {
    // Skill invocations are still valid prompts, but are not toolbox actions.
    // Also filter older supervisors which advertise each /$skill separately.
    if (item.command.trim().replace(/^\/+/, '').startsWith('$')) return false;
    switch (item.action) {
      case 'fast':
        return capabilities.fast;
      case 'compact':
        return capabilities.compact;
      case 'goal':
        return capabilities.goal;
      case 'fork':
        return capabilities.fork;
      case 'skills':
        return capabilities.skills;
      case 'mcp':
        return capabilities.mcp;
      case 'hooks':
        return capabilities.hooks;
      case 'harness':
      case 'prompt':
      case 'unsupported':
        return true;
      default:
        return false;
    }
  });
}

export function toolboxItemActionDecision(
  item: AgentBackendToolboxItemSchemaDto,
  {
    fastMode,
    goalComposeMode,
  }: {
    fastMode: boolean;
    goalComposeMode: boolean;
  },
): ToolboxActionDecision {
  switch (item.action) {
    case 'fast':
      return { type: 'toggleFast', fastMode: !fastMode };
    case 'compact':
      return { type: 'runCompact' };
    case 'goal':
      return goalComposeMode
        ? { type: 'exitGoalCompose' }
        : { type: 'enterGoalCompose' };
    case 'fork':
    case 'skills':
    case 'mcp':
    case 'hooks':
      return { type: 'openPanel', panel: item.action };
    case 'harness':
      return { type: 'openHarness' };
    case 'prompt':
      return { type: 'insertPrompt', text: `${item.command} ` };
    default:
      return { type: 'noop' };
  }
}

/** What the right edge of a toolbox row says. Toggles are switches, rows that
    open a panel end in a chevron, actions that run at once say nothing unless
    they are busy, and a goal says its state (docs/ui-principles.md §12). */
export type ToolboxItemStatus =
  | { kind: 'switch'; on: boolean }
  | { kind: 'text'; text: string; active?: boolean }
  | { kind: 'more' }
  | null;

export function toolboxItemStatus(
  item: AgentBackendToolboxItemSchemaDto,
  {
    fastMode,
    compactBusy,
    goalComposeMode,
    goalStatus,
    busy,
  }: {
    fastMode: boolean;
    compactBusy: boolean;
    goalComposeMode: boolean;
    goalStatus: ThreadGoalStatusDto | null | undefined;
    busy: boolean;
  },
): ToolboxItemStatus {
  switch (item.action) {
    case 'fast':
      return { kind: 'switch', on: fastMode };
    case 'compact':
      return compactBusy ? { kind: 'text', text: translate("chat.busy") } : null;
    case 'goal':
      return goalComposeMode
        ? { kind: 'text', text: translate("chat.composing"), active: true }
        : goalStatus
          ? { kind: 'text', text: goalStatusLabel(goalStatus), active: goalStatus === 'active' }
          : null;
    case 'fork':
      return busy ? { kind: 'text', text: translate("chat.idleOnly") } : { kind: 'more' };
    case 'skills':
    case 'mcp':
    case 'hooks':
    case 'harness':
      return { kind: 'more' };
    case 'prompt':
      return null;
    case 'unsupported':
      return { kind: 'text', text: translate("chat.unavailable_2c9c1f") };
    default:
      return null;
  }
}

export function toolboxItemDisabled(
  item: AgentBackendToolboxItemSchemaDto,
  {
    settingsBusy,
    compactBusy,
    busy,
    forkBusy,
  }: {
    settingsBusy: boolean;
    compactBusy: boolean;
    busy: boolean;
    forkBusy: boolean;
  },
) {
  switch (item.action) {
    case 'fast':
      return settingsBusy;
    case 'compact':
      return compactBusy || busy;
    case 'fork':
      return busy || forkBusy;
    case 'unsupported':
      return true;
    default:
      return false;
  }
}

/** True for an active toggle or goal; the row says so with data-active and its
    switch or state, not with a warning colour (being on is not a problem). */
export function toolboxItemActive(
  item: AgentBackendToolboxItemSchemaDto,
  {
    fastMode,
    goalComposeMode,
    goalStatus,
  }: {
    fastMode: boolean;
    goalComposeMode: boolean;
    goalStatus: ThreadGoalStatusDto | null | undefined;
  },
) {
  return (
    (item.action === 'fast' && fastMode) ||
    (item.action === 'goal' && (goalComposeMode || goalStatus === 'active'))
  );
}

export function toolboxItemClassName(menuItemClassName: string) {
  return `${menuItemClassName} mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60`;
}
