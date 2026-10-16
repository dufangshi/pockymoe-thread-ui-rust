import { translate, useI18n } from '../i18n';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  ImportPluginInput,
  PluginDto,
  UpdatePluginInput,
  ThreadArtifactDto,
} from '@pockymoe/shared';
import {
  PluginContext,
  mergePluginState,
  type PluginContextValue,
} from './plugin-context';
import type {
  ArtifactRenderContext,
  FrontendPluginModule,
  InlineCodeRenderContext,
  PluginSettingsSnapshot,
  PluginSettingsContribution,
  MessagePresentationContext,
  PluginActionOutputContext,
  UpstreamConnectionHost,
} from './plugin-types';

export interface PluginProviderAdapter {
  connections?: UpstreamConnectionHost;
  loadPluginSettings?: (pluginId: string) => Promise<PluginSettingsSnapshot>;
  savePluginSettings?: (pluginId: string, settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
  fetchPlugins?: () => Promise<PluginDto[]> | PluginDto[];
  importPlugin?: (input: ImportPluginInput) => Promise<PluginDto> | PluginDto;
  updatePlugin?: (
    pluginId: string,
    input: UpdatePluginInput,
  ) => Promise<PluginDto> | PluginDto;
  deletePlugin?: (pluginId: string) => Promise<PluginDto> | PluginDto;
}

const DEFAULT_PLUGIN_PROVIDER_ADAPTER: PluginProviderAdapter = {};
const DEFAULT_BUILTIN_PLUGINS: FrontendPluginModule[] = [];

function PluginSettingsSection({ section, pluginId, adapter }: {
  section: PluginSettingsContribution;
  pluginId: string;
  adapter: PluginProviderAdapter;
}) {
  const context = useMemo(() => ({
    pluginId,
    load: () => adapter.loadPluginSettings!(pluginId),
    save: (settings: PluginSettingsSnapshot) => adapter.savePluginSettings!(pluginId, settings),
    ...(adapter.connections ? { connections: adapter.connections } : {}),
  }), [adapter, pluginId]);
  return section.render(context);
}

export function PluginProvider({
  adapter = DEFAULT_PLUGIN_PROVIDER_ADAPTER,
  builtinPlugins = DEFAULT_BUILTIN_PLUGINS,
  children,
}: {
  adapter?: PluginProviderAdapter;
  builtinPlugins?: FrontendPluginModule[];
  children: ReactNode;
}) {
  useI18n();
  const [plugins, setPlugins] = useState<PluginDto[]>(() =>
    mergePluginState(builtinPlugins, []),
  );
  const [settingsPluginIds, setSettingsPluginIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const serverPlugins = adapter.fetchPlugins
        ? await adapter.fetchPlugins()
        : [];
      setPlugins(mergePluginState(builtinPlugins, serverPlugins));
      setSettingsPluginIds(new Set(serverPlugins.filter(plugin => plugin.available !== false).map(plugin => plugin.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : translate("workbench.unableToLoadPlugins"));
    } finally {
      setLoading(false);
    }
  }, [adapter, builtinPlugins]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPluginEnabled = useCallback(
    async (pluginId: string, enabled: boolean) => {
      let previousEnabled: boolean | undefined;
      setError(null);
      setPlugins((current) =>
        current.map((plugin) => {
          if (plugin.id !== pluginId) {
            return plugin;
          }
          previousEnabled = plugin.enabled;
          return { ...plugin, enabled };
        }),
      );

      if (!adapter.updatePlugin) {
        return;
      }

      try {
        const updated = await adapter.updatePlugin(pluginId, { enabled });
        setPlugins((current) =>
          current.map((plugin) => (plugin.id === updated.id ? updated : plugin)),
        );
      } catch (err) {
        if (previousEnabled !== undefined) {
          setPlugins((current) =>
            current.map((plugin) =>
              plugin.id === pluginId && plugin.enabled === enabled
                ? { ...plugin, enabled: previousEnabled! }
                : plugin,
            ),
          );
        }
        setError(err instanceof Error ? err.message : translate("workbench.unableToUpdatePlugin"));
        throw err;
      }
    },
    [adapter],
  );

  const importPluginManifest = useCallback(
    async (input: ImportPluginInput) => {
      if (!adapter.importPlugin) {
        throw new Error(translate("workbench.pluginImportIsNotAvailable"));
      }

      const imported = await adapter.importPlugin(input);
      setSettingsPluginIds(current => new Set([...current, imported.id]));
      setPlugins((current) => {
        const next = current.filter((plugin) => plugin.id !== imported.id);
        return [...next, imported];
      });
    },
    [adapter],
  );

  const uninstallPlugin = useCallback(
    async (pluginId: string) => {
      if (!adapter.deletePlugin) {
        throw new Error(translate("workbench.pluginUninstallIsNotAvailable"));
      }

      const removed = await adapter.deletePlugin(pluginId);
      setSettingsPluginIds(current => new Set([...current].filter(id => id !== removed.id)));
      setPlugins((current) =>
        current.filter((plugin) => plugin.id !== removed.id),
      );
    },
    [adapter],
  );

  const enabledModules = useMemo(() => {
    const enabledIds = new Set(
      plugins.filter((plugin) => plugin.enabled && plugin.available !== false).map((plugin) => plugin.id),
    );
    return builtinPlugins.filter((module) =>
      enabledIds.has(module.manifest.id),
    );
  }, [builtinPlugins, plugins]);

  const renderArtifact = useCallback(
    (context: ArtifactRenderContext) => {
      const module = enabledModules.find(
        (entry) =>
          entry.renderArtifact &&
          entry.manifest.capabilities.artifactTypes.some(
            (type) => type.type === context.artifact.type,
          ),
      );
      return module?.renderArtifact?.(context) ?? null;
    },
    [enabledModules],
  );

  const renderInlineCode = useCallback(
    (context: InlineCodeRenderContext) => {
      for (const module of enabledModules) {
        for (const renderer of module.inlineCodeRenderers ?? []) {
          if (!renderer.languages.includes(context.language.trim().toLowerCase())) {
            continue;
          }
          const rendered = renderer.render(context);
          if (rendered) {
            return rendered;
          }
        }
      }
      return null;
    },
    [enabledModules],
  );

  const hasRendererForArtifact = useCallback(
    (artifact: ThreadArtifactDto) =>
      enabledModules.some(
        (entry) =>
          Boolean(entry.renderArtifact) &&
          entry.manifest.capabilities.artifactTypes.some(
            (type) => type.type === artifact.type,
          ),
      ),
    [enabledModules],
  );

  const getThreadPanels = useCallback(
    () => enabledModules.flatMap((module) => module.threadPanels ?? []),
    [enabledModules],
  );

  const presentMessage = useCallback((context: MessagePresentationContext) => {
    for (const module of enabledModules) {
      const presentation = module.presentMessage?.(context);
      if (presentation) return presentation;
    }
    return null;
  }, [enabledModules]);

  const getSettingsSections = useCallback((pluginId?: string) => builtinPlugins.flatMap(module => {
    if (pluginId !== undefined && module.manifest.id !== pluginId) return [];
    const devicePlugin = plugins.find(plugin => plugin.id === module.manifest.id);
    const browser = devicePlugin?.enabled && devicePlugin.available !== false
      ? (module.browserSettingsSections ?? []).map(section => ({
        id: `plugin:${module.manifest.id}:${section.id}`,
        label: section.label,
        ...(section.description ? { description: section.description } : {}),
        content: section.render(),
      }))
      : [];
    if (!adapter.loadPluginSettings || !adapter.savePluginSettings) return browser;
    if (!settingsPluginIds.has(module.manifest.id) || !devicePlugin || devicePlugin.available === false) return browser;
    return [...browser, ...(module.settingsSections ?? []).map(section => ({
      id: `plugin:${module.manifest.id}:${section.id}`,
      label: section.label,
      description: section.description,
      content: <PluginSettingsSection section={section} pluginId={module.manifest.id} adapter={adapter} />,
    }))];
  }), [adapter, builtinPlugins, plugins, settingsPluginIds]);

  const renderActionOutput = useCallback((pluginId: string, context: PluginActionOutputContext) =>
    builtinPlugins.find(module => module.manifest.id === pluginId)?.renderActionOutput?.(context) ?? null,
  [builtinPlugins]);

  const value = useMemo<PluginContextValue>(
    () => ({
      plugins,
      loading,
      error,
      refresh,
      importPluginManifest,
      setPluginEnabled,
      uninstallPlugin,
      renderArtifact,
      renderInlineCode,
      hasRendererForArtifact,
      getThreadPanels,
      getSettingsSections,
      presentMessage,
      renderActionOutput,
    }),
    [
      error,
      getThreadPanels,
      getSettingsSections,
      presentMessage,
      renderActionOutput,
      hasRendererForArtifact,
      importPluginManifest,
      loading,
      plugins,
      refresh,
      renderArtifact,
      renderInlineCode,
      setPluginEnabled,
      uninstallPlugin,
    ],
  );

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}
