import type { CreateThreadHookInput } from '@pockymoe/shared';

export interface SlashPanelState<T> {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  data: T | null;
  error: string | null;
}

export type McpPanelMode = 'list' | 'add' | 'http' | 'stdio';
export type HooksPanelMode = 'list' | 'add' | 'edit';
export type HookScope = CreateThreadHookInput['scope'];
export type SettingsMenu =
  | 'attachments'
  | 'slash'
  | 'model'
  | 'context'
  | 'effort'
  | 'shellTools'
  | null;
export type SlashPanelView =
  | 'root'
  | 'skills'
  | 'mcp'
  | 'hooks'
  | 'goals'
  | 'fork'
  | 'forkTurns';
