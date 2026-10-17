import { createContext, type ReactNode } from 'react';
import type { SettingsSection } from '../components/SettingsPanels';

import type {
  ImportPluginInput,
  PluginDto,
  ThreadArtifactDto,
} from '@pockymoe/shared';
import type {
  ArtifactRenderContext,
  FrontendPluginModule,
  InlineCodeRenderContext,
  MessagePresentation,
  MessagePresentationContext,
  PluginActionOutputContext,
  ThreadPanelContribution,
  ThreadPluginDto,
  ThreadPluginSettingsInput,
  ThreadPluginSettingsSnapshot,
} from './plugin-types';
import type { PluginProviderAdapter } from './PluginProvider';

export interface PluginContextValue {
  plugins: PluginDto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  importPluginManifest: (input: ImportPluginInput) => Promise<void>;
  setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  renderArtifact: (context: ArtifactRenderContext) => ReactNode | null;
  renderInlineCode: (context: InlineCodeRenderContext) => ReactNode | null;
  hasRendererForArtifact: (artifact: ThreadArtifactDto) => boolean;
  getThreadPanels: () => ThreadPanelContribution[];
  /** Sections are ids `plugin:<pluginId>:<sectionId>`; pass a plugin id for one plugin's sections. */
  getSettingsSections: (pluginId?: string) => SettingsSection[];
  presentMessage: (
    context: MessagePresentationContext,
  ) => MessagePresentation | null;
  renderActionOutput: (
    pluginId: string,
    context: PluginActionOutputContext,
  ) => ReactNode | null;
  /** The plugin modules this host ships. */
  modules?: FrontendPluginModule[];
  adapter?: PluginProviderAdapter;
  /** Changes whenever device-wide plugin settings are saved. */
  settingsVersion?: number;
  /** Inside a conversation scope: the device-wide context, for global management. */
  device?: PluginContextValue;
  /** Inside a conversation scope: its switches and settings. */
  thread?: ThreadPluginScopeState;
}

export type ThreadPluginScopeStatus =
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'forbidden'
  | 'error';

export interface ThreadPluginScopeState {
  threadId: string;
  status: ThreadPluginScopeStatus;
  plugins: ThreadPluginDto[];
  error: string | null;
  /** Per plugin: the last failed change, kept until the next attempt. */
  pluginErrors: Record<string, { message: string; conflict: boolean }>;
  pending: Record<string, boolean>;
  reload: () => Promise<void>;
  setEnabledOverride: (
    pluginId: string,
    enabled: boolean | null,
  ) => Promise<void>;
  resetSettings: (pluginId: string) => Promise<void>;
  loadSettings: (pluginId: string) => Promise<ThreadPluginSettingsSnapshot>;
  saveSettings: (
    pluginId: string,
    input: ThreadPluginSettingsInput,
  ) => Promise<ThreadPluginSettingsSnapshot>;
}

type PluginCapabilities = Pick<
  PluginContextValue,
  | 'renderArtifact'
  | 'renderInlineCode'
  | 'hasRendererForArtifact'
  | 'getThreadPanels'
  | 'presentMessage'
  | 'renderActionOutput'
>;

/**
 * Renderers and panels for the plugins enabled in a scope. Stored results (such as a
 * polished reply) are presented by any shipped module, so turning a plugin off stops
 * new work without hiding what it already produced.
 */
export function pluginCapabilities(
  modules: FrontendPluginModule[],
  plugins: PluginDto[],
): PluginCapabilities {
  const enabledIds = new Set(
    plugins
      .filter((plugin) => plugin.enabled && plugin.available !== false)
      .map((plugin) => plugin.id),
  );
  const enabledModules = modules.filter((module) =>
    enabledIds.has(module.manifest.id),
  );
  const artifactModule = (type: string) =>
    enabledModules.find(
      (entry) =>
        Boolean(entry.renderArtifact) &&
        entry.manifest.capabilities.artifactTypes.some(
          (artifactType) => artifactType.type === type,
        ),
    );
  return {
    renderArtifact: (context) =>
      artifactModule(context.artifact.type)?.renderArtifact?.(context) ?? null,
    renderInlineCode: (context) => {
      for (const module of enabledModules) {
        for (const renderer of module.inlineCodeRenderers ?? []) {
          if (
            !renderer.languages.includes(context.language.trim().toLowerCase())
          )
            continue;
          const rendered = renderer.render(context);
          if (rendered) return rendered;
        }
      }
      return null;
    },
    hasRendererForArtifact: (artifact) =>
      Boolean(artifactModule(artifact.type)),
    getThreadPanels: () =>
      enabledModules.flatMap((module) => module.threadPanels ?? []),
    presentMessage: (context) => {
      for (const module of modules) {
        const presentation = module.presentMessage?.(context);
        if (presentation) return presentation;
      }
      return null;
    },
    renderActionOutput: (pluginId, context) =>
      modules
        .find((module) => module.manifest.id === pluginId)
        ?.renderActionOutput?.(context) ?? null,
  };
}

export function mergePluginState(
  modules: FrontendPluginModule[],
  serverPlugins: PluginDto[],
): PluginDto[] {
  const byId = new Map(serverPlugins.map((plugin) => [plugin.id, plugin]));
  const merged: PluginDto[] = modules.map((module) => ({
    // Keep the device's availability report (for example a missing harness).
    ...byId.get(module.manifest.id),
    ...module.manifest,
    capabilities: {
      ...module.manifest.capabilities,
      ...byId.get(module.manifest.id)?.capabilities,
    },
    enabled:
      byId.get(module.manifest.id)?.enabled ?? module.defaultEnabled ?? true,
    source: byId.get(module.manifest.id)?.source ?? 'builtin',
  }));
  const moduleIds = new Set(modules.map((module) => module.manifest.id));
  for (const plugin of serverPlugins) {
    if (!moduleIds.has(plugin.id)) {
      merged.push(plugin);
    }
  }
  return merged;
}

export function createDefaultPluginContextValue(
  modules: FrontendPluginModule[] = [],
): PluginContextValue {
  const plugins = mergePluginState(modules, []);
  return {
    plugins,
    loading: false,
    error: null,
    async refresh() {},
    async importPluginManifest() {},
    async setPluginEnabled() {},
    async uninstallPlugin() {},
    getSettingsSections: () => [],
    ...pluginCapabilities(modules, plugins),
    modules,
    adapter: {},
  };
}

export const PluginContext = createContext<PluginContextValue>(createDefaultPluginContextValue());
