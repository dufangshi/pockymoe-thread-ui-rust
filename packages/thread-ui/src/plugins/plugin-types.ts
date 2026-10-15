import type { ReactNode } from 'react';

import type {
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

export interface PluginSettingsContext {
  pluginId: string;
  load: () => Promise<PluginSettingsSnapshot>;
  save: (settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
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
  manifest: PluginManifestDto;
  threadPanels?: ThreadPanelContribution[];
  renderArtifact?: (context: ArtifactRenderContext) => ReactNode;
  inlineCodeRenderers?: Array<{
    languages: string[];
    render: (context: InlineCodeRenderContext) => ReactNode | null;
  }>;
}
