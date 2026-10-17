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
} from '@pockymoe/shared';
import {
  PluginContext,
  mergePluginState,
  pluginCapabilities,
  type PluginContextValue,
} from './plugin-context';
import type {
  FrontendPluginModule,
  PluginSettingsSnapshot,
  PluginSettingsContribution,
  ThreadPluginAdapter,
  UpstreamConnectionHost,
} from './plugin-types';

export interface PluginProviderAdapter {
  connections?: UpstreamConnectionHost;
  /** Per-conversation plugin switches and settings, when the device supports them. */
  threads?: ThreadPluginAdapter;
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

function PluginSettingsSection({ section, pluginId, adapter, onSaved }: {
  section: PluginSettingsContribution;
  pluginId: string;
  adapter: PluginProviderAdapter;
  onSaved: () => void;
}) {
  const context = useMemo(() => ({
    pluginId,
    load: () => adapter.loadPluginSettings!(pluginId),
    save: async (settings: PluginSettingsSnapshot) => {
      const saved = await adapter.savePluginSettings!(pluginId, settings);
      onSaved();
      return saved;
    },
    ...(adapter.connections ? { connections: adapter.connections } : {}),
  }), [adapter, pluginId, onSaved]);
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
  // Bumped after device-wide settings are saved, so conversation scopes that inherit
  // them can refresh without depending on adapter identity.
  const [settingsVersion, setSettingsVersion] = useState(0);
  const settingsSaved = useCallback(() => setSettingsVersion(value => value + 1), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True only once the device answered with its plugins; module defaults alone
  // (for example when a view-only share cannot read them) are not authoritative.
  const [devicePluginsKnown, setDevicePluginsKnown] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const serverPlugins = adapter.fetchPlugins
        ? await adapter.fetchPlugins()
        : [];
      setPlugins(mergePluginState(builtinPlugins, serverPlugins));
      setSettingsPluginIds(new Set(serverPlugins.filter(plugin => plugin.available !== false).map(plugin => plugin.id)));
      setDevicePluginsKnown(Boolean(adapter.fetchPlugins));
    } catch (err) {
      setDevicePluginsKnown(false);
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

  const capabilities = useMemo(
    () => pluginCapabilities(builtinPlugins, plugins),
    [builtinPlugins, plugins],
  );

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
      content: <PluginSettingsSection section={section} pluginId={module.manifest.id} adapter={adapter} onSaved={settingsSaved} />,
    }))];
  }), [adapter, builtinPlugins, plugins, settingsPluginIds, settingsSaved]);

  const value = useMemo<PluginContextValue>(
    () => ({
      plugins,
      loading,
      error,
      refresh,
      importPluginManifest,
      setPluginEnabled,
      uninstallPlugin,
      getSettingsSections,
      ...capabilities,
      modules: builtinPlugins,
      adapter,
      settingsVersion,
      devicePluginsKnown,
    }),
    [
      adapter,
      builtinPlugins,
      capabilities,
      devicePluginsKnown,
      error,
      getSettingsSections,
      importPluginManifest,
      loading,
      plugins,
      refresh,
      setPluginEnabled,
      settingsVersion,
      uninstallPlugin,
    ],
  );

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}
