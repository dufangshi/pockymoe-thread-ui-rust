import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { translate } from '../i18n';
import {
  PluginContext,
  pluginCapabilities,
  type PluginContextValue,
  type ThreadPluginScopeState,
  type ThreadPluginScopeStatus,
} from './plugin-context';
import type {
  ThreadPluginAdapter,
  ThreadPluginDto,
  ThreadPluginSettingsInput,
} from './plugin-types';

export function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  if ('statusCode' in error && typeof error.statusCode === 'number')
    return error.statusCode;
  if ('status' in error && typeof error.status === 'number')
    return error.status;
  return undefined;
}

/** The device-wide plugin context, even inside a conversation scope. */
export function useDevicePlugins(): PluginContextValue {
  const context = useContext(PluginContext);
  return context.device ?? context;
}

type Loaded = {
  status: ThreadPluginScopeStatus;
  plugins: ThreadPluginDto[];
  error: string | null;
};

/**
 * Gives one conversation its effective plugins: renderers, panels and actions below
 * follow its switches, while global management (switches, device settings) still
 * reaches the device. Each conversation gets its own scope, keyed by the host.
 */
export function ThreadPluginScope({
  threadId,
  adapter,
  children,
}: {
  threadId: string;
  /** For a conversation on another route or device; defaults to the provider's. */
  adapter?: ThreadPluginAdapter;
  children: ReactNode;
}) {
  const parent = useContext(PluginContext);
  const device = parent.device ?? parent;
  // Hosts may rebuild the adapter on each render; only the conversation (and
  // whether the host supports scopes at all) decides when to reload.
  const threadsRef = useRef(adapter ?? device.adapter?.threads);
  threadsRef.current = adapter ?? device.adapter?.threads;
  const supported = Boolean(threadsRef.current);
  const [loaded, setLoaded] = useState<Loaded>({
    status: supported ? 'loading' : 'unsupported',
    plugins: [],
    error: null,
  });
  const [pluginErrors, setPluginErrors] = useState<
    ThreadPluginScopeState['pluginErrors']
  >({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const request = useRef(0);

  const reload = useCallback(async () => {
    const threads = threadsRef.current;
    if (!threads) {
      setLoaded({ status: 'unsupported', plugins: [], error: null });
      return;
    }
    const id = ++request.current;
    setLoaded((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const plugins = await threads.fetchPlugins(threadId);
      if (id !== request.current) return;
      setLoaded({
        status: 'ready',
        plugins: Array.isArray(plugins) ? plugins : [],
        error: null,
      });
    } catch (error) {
      if (id !== request.current) return;
      const status = errorStatus(error);
      // Older Supervisors have no conversation scope: fall back to the device's.
      setLoaded({
        status:
          status === 404 || status === 405
            ? 'unsupported'
            : status === 401 || status === 403
              ? 'forbidden'
              : 'error',
        plugins: [],
        error:
          error instanceof Error && error.message
            ? error.message
            : translate('settings.threadPluginsLoadFailed'),
      });
    }
  }, [supported, threadId]);

  useEffect(() => {
    void reload();
    return () => {
      ++request.current;
    };
  }, [reload]);

  // A device-wide switch or settings save changes what this conversation inherits:
  // refresh in place, keyed by the device's state rather than adapter identity.
  // Only a conversation on this provider's device inherits from it; one reached
  // through its own adapter (another device) answers for itself.
  const sameDevice = !adapter;
  const deviceState = sameDevice
    ? `${device.plugins
        .map((plugin) => `${plugin.id}:${plugin.enabled}`)
        .join('|')}#${device.settingsVersion ?? 0}`
    : '';
  const seenDeviceState = useRef(deviceState);
  useEffect(() => {
    if (seenDeviceState.current === deviceState) return;
    seenDeviceState.current = deviceState;
    void reload();
  }, [deviceState, reload]);

  const failed = useCallback((pluginId: string, error: unknown) => {
    const conflict = errorStatus(error) === 409;
    setPluginErrors((current) => ({
      ...current,
      [pluginId]: {
        conflict,
        message: conflict
          ? translate('settings.threadPluginsConflict')
          : error instanceof Error && error.message
            ? error.message
            : translate('settings.threadPluginsSaveFailed'),
      },
    }));
  }, []);

  const change = useCallback(
    async (
      pluginId: string,
      build: (snapshot: {
        revision: number;
        enabled: boolean | null;
        values: Record<string, unknown> | null;
      }) => ThreadPluginSettingsInput,
      optimistic?: (plugin: ThreadPluginDto) => ThreadPluginDto,
    ) => {
      const threads = threadsRef.current;
      if (!threads) return;
      const before = loaded.plugins;
      setPending((current) => ({ ...current, [pluginId]: true }));
      setPluginErrors(({ [pluginId]: _, ...rest }) => rest);
      if (optimistic)
        setLoaded((current) => ({
          ...current,
          plugins: current.plugins.map((plugin) =>
            plugin.id === pluginId ? optimistic(plugin) : plugin,
          ),
        }));
      try {
        // Read the conversation's own values first so a switch never stores the
        // effective (inherited) values as custom ones.
        const snapshot = await threads.loadSettings(threadId, pluginId);
        await threads.saveSettings(threadId, pluginId, build(snapshot));
        await reload();
      } catch (error) {
        setLoaded((current) => ({ ...current, plugins: before }));
        failed(pluginId, error);
      } finally {
        setPending(({ [pluginId]: _, ...rest }) => rest);
      }
    },
    [threadId, loaded.plugins, reload, failed],
  );

  const setEnabledOverride = useCallback(
    (pluginId: string, enabled: boolean | null) =>
      change(
        pluginId,
        (snapshot) => ({
          revision: snapshot.revision,
          enabled,
          values: snapshot.values,
        }),
        (plugin) => ({
          ...plugin,
          enabledOverride: enabled,
          // A conversation can never switch on what the device has off.
          enabled: plugin.globalEnabled && (enabled ?? plugin.globalEnabled),
        }),
      ),
    [change],
  );

  const resetSettings = useCallback(
    (pluginId: string) =>
      change(pluginId, (snapshot) => ({
        revision: snapshot.revision,
        enabled: snapshot.enabled,
        values: null,
      })),
    [change],
  );

  const loadSettings = useCallback(
    (pluginId: string) => {
      const threads = threadsRef.current;
      if (!threads) return Promise.reject(new Error('unsupported'));
      return threads.loadSettings(threadId, pluginId);
    },
    [threadId],
  );
  const saveSettings = useCallback(
    async (pluginId: string, input: ThreadPluginSettingsInput) => {
      const threads = threadsRef.current;
      if (!threads) throw new Error('unsupported');
      const saved = await threads.saveSettings(threadId, pluginId, input);
      void reload();
      return saved;
    },
    [threadId, reload],
  );

  const plugins = useMemo(() => {
    if (loaded.status !== 'ready') return device.plugins;
    const scoped = new Map(loaded.plugins.map((plugin) => [plugin.id, plugin]));
    // The conversation's own descriptor is authoritative (availability included).
    // On this device its global switch also wins at once, before a refresh lands.
    const merged = device.plugins.map((plugin) => {
      const own = scoped.get(plugin.id);
      if (!own) return plugin;
      return {
        ...plugin,
        ...own,
        enabled: sameDevice ? plugin.enabled && own.enabled : own.enabled,
      };
    });
    const known = new Set(device.plugins.map((plugin) => plugin.id));
    return [
      ...merged,
      ...loaded.plugins.filter((plugin) => !known.has(plugin.id)),
    ];
  }, [device.plugins, loaded, sameDevice]);

  const thread = useMemo<ThreadPluginScopeState>(
    () => ({
      threadId,
      status: loaded.status,
      plugins: loaded.plugins,
      error: loaded.error,
      pluginErrors,
      pending,
      reload,
      setEnabledOverride,
      resetSettings,
      loadSettings,
      saveSettings,
    }),
    [
      threadId,
      loaded,
      pluginErrors,
      pending,
      reload,
      setEnabledOverride,
      resetSettings,
      loadSettings,
      saveSettings,
    ],
  );

  const value = useMemo<PluginContextValue>(
    () => ({
      ...device,
      plugins,
      ...pluginCapabilities(device.modules ?? [], plugins),
      device,
      thread,
    }),
    [device, plugins, thread],
  );
  return (
    <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
  );
}
