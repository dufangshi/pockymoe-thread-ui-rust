import type { ReactNode } from 'react';

import type {
  PluginDto,
  PluginManifestDto,
  ThreadArtifactDto,
  ThreadHistoryItemDto,
} from '@pockymoe/shared';

export interface ArtifactRenderContext {
  artifact: ThreadArtifactDto;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export interface InlineCodeRenderContext {
  code: string;
  isIncomplete: boolean;
  language: string;
  meta?: string;
}

export interface ThreadPanelContribution {
  id: string;
  kind: string;
  label: string;
}

export interface PluginSettingsSnapshot {
  revision: number;
  values: Record<string, unknown>;
}

/** Wire formats a saved upstream connection can speak; not a model brand. */
export type UpstreamConnectionProtocol =
  | 'openai_chat'
  | 'openai_responses'
  | 'anthropic'
  | 'gemini';

export interface UpstreamConnectionPickerValue {
  connectionId: string;
  model: string;
}

export interface UpstreamConnectionPickerProps extends UpstreamConnectionPickerValue {
  /** Only connections speaking one of these protocols can be selected. */
  protocols?: UpstreamConnectionProtocol[];
  disabled?: boolean;
  onChange: (value: UpstreamConnectionPickerValue) => void;
}

/**
 * Optional host capability: the host renders its saved-connection selector, including
 * its own add/edit form. Selecting or saving a connection never applies it anywhere.
 */
export interface UpstreamConnectionHost {
  renderPicker: (props: UpstreamConnectionPickerProps) => ReactNode;
}

export interface PluginSettingsContext {
  pluginId: string;
  load: () => Promise<PluginSettingsSnapshot>;
  save: (settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
  connections?: UpstreamConnectionHost;
  /** The device's (or conversation's) descriptor, for capability checks. */
  plugin?: PluginDto;
}

export interface PluginSettingsContribution {
  id: string;
  label: string;
  description?: string;
  render: (context: PluginSettingsContext) => ReactNode;
}

export interface MessagePresentationContext {
  item: ThreadHistoryItemDto;
  streaming: boolean;
}

export interface PluginActionOutputContext {
  action: string;
  output: unknown;
}

/** An alternate body; the host keeps its existing markdown, expansion and copy controls. */
export interface MessagePresentation {
  id: string;
  text: string;
  label: string;
  originalLabel: string;
  validate?: () => Promise<boolean>;
}

export interface FrontendPluginModule {
  /** Historical receipts remain readable after disabling the plugin. */
  renderActionOutput?: (context: PluginActionOutputContext) => ReactNode | null;
  defaultEnabled?: boolean;
  presentMessage?: (context: MessagePresentationContext) => MessagePresentation | null;
  /** Available even when disabled so the plugin can be configured before enabling. */
  settingsSections?: PluginSettingsContribution[];
  /** Preferences kept in this browser, shown in settings only while the plugin is enabled. */
  browserSettingsSections?: Array<{ id: string; readonly label: string; readonly description?: string; render: () => ReactNode }>;
  manifest: PluginManifestDto;
  threadPanels?: ThreadPanelContribution[];
  renderArtifact?: (context: ArtifactRenderContext) => ReactNode;
  inlineCodeRenderers?: Array<{
    languages: string[];
    render: (context: InlineCodeRenderContext) => ReactNode | null;
  }>;
}

/** A plugin as one conversation sees it; `enabled` is the effective switch there. */
export interface ThreadPluginDto extends PluginDto {
  globalEnabled: boolean;
  /** null follows the device-wide switch. */
  enabledOverride: boolean | null;
  settingsOverridden: boolean;
}

export interface ThreadPluginSettingsSnapshot {
  revision: number;
  globalRevision: number;
  /** The conversation's own values; null inherits the device-wide ones. */
  enabled: boolean | null;
  values: Record<string, unknown> | null;
  effective: { enabled: boolean; values: Record<string, unknown> };
}

export interface ThreadPluginSettingsInput {
  revision: number;
  enabled: boolean | null;
  /** A complete override snapshot, not a patch; null inherits. */
  values: Record<string, unknown> | null;
}

/** Host access to one conversation's plugin scope. */
export interface ThreadPluginAdapter {
  fetchPlugins: (threadId: string) => Promise<ThreadPluginDto[]>;
  loadSettings: (
    threadId: string,
    pluginId: string,
  ) => Promise<ThreadPluginSettingsSnapshot>;
  saveSettings: (
    threadId: string,
    pluginId: string,
    input: ThreadPluginSettingsInput,
  ) => Promise<ThreadPluginSettingsSnapshot>;
}
