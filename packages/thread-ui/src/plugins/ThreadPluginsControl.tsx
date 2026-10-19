import { Puzzle, RotateCcw, Settings } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAppShellNav } from '../app-shell/AppShellNavContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/graph-ui/Dialog';
import { useI18n } from '../i18n';
import type { ThreadPluginScopeState } from './plugin-context';
import type {
  FrontendPluginModule,
  PluginSettingsSnapshot,
  ThreadPluginDto,
} from './plugin-types';
import { useDevicePlugins } from './ThreadPluginScope';
import { usePlugins } from './usePlugins';

type Choice = 'inherit' | 'on' | 'off';
const choiceOf = (plugin: ThreadPluginDto): Choice =>
  plugin.enabledOverride === null
    ? 'inherit'
    : plugin.enabledOverride
      ? 'on'
      : 'off';
const overrideOf = (choice: Choice) =>
  choice === 'inherit' ? null : choice === 'on';

/** Plugins without a declared scope predate scopes and work per conversation. */
function threadScoped(plugin: ThreadPluginDto) {
  const scopes = (plugin.capabilities as { scopes?: unknown }).scopes;
  return !Array.isArray(scopes) || scopes.includes('thread');
}

/**
 * The conversation's plugin button: one place to see which plugins work here, follow
 * or override the global switch, and edit this conversation's own settings.
 */
export function ThreadPluginsControl({
  readOnly = false,
  onOpenGlobalSettings,
}: {
  /** View-only sessions see the effective state but cannot change it. */
  readOnly?: boolean;
  onOpenGlobalSettings?: () => void;
}) {
  const { t } = useI18n();
  const scope = usePlugins().thread;
  const device = useDevicePlugins();
  const nav = useAppShellNav();
  const openGlobal =
    onOpenGlobalSettings ??
    (nav?.openSettingsSection
      ? () => nav.openSettingsSection!('plugins')
      : undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ThreadPluginDto | null>(null);
  const visible = useMemo(
    () => (scope?.plugins ?? []).filter(threadScoped),
    [scope?.plugins],
  );
  if (!scope) return null;
  const customized = visible.some(
    (plugin) => plugin.enabledOverride !== null || plugin.settingsOverridden,
  );
  const label = t('settings.threadPluginsTitle');
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="matter-watches-toggle thread-plugins-toggle"
        aria-label={
          customized
            ? `${label} · ${t('settings.threadPluginsCustomized')}`
            : label
        }
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Puzzle data-icon="plugins" size={14} />
        {customized && <span className="thread-plugins-dot" aria-hidden />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="thread-plugins-panel"
          overlayClassName="thread-plugins-overlay"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader className="thread-plugins-header">
            <DialogTitle ref={title} tabIndex={-1} className="outline-none">
              {label}
            </DialogTitle>
            <DialogDescription>
              {t('settings.threadPluginsHint')}
            </DialogDescription>
          </DialogHeader>
          <ScopeBody
            scope={scope}
            plugins={visible}
            modules={device.modules ?? []}
            readOnly={readOnly}
            {...(openGlobal
              ? {
                  onOpenGlobal: () => {
                    setOpen(false);
                    openGlobal();
                  },
                }
              : {})}
            onEdit={setEditing}
          />
        </DialogContent>
      </Dialog>
      {editing && (
        <ThreadPluginSettingsDialog
          scope={scope}
          plugin={
            scope.plugins.find((plugin) => plugin.id === editing.id) ?? editing
          }
          module={device.modules?.find(
            (module) => module.manifest.id === editing.id,
          )}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ScopeBody({
  scope,
  plugins,
  modules,
  readOnly,
  onOpenGlobal,
  onEdit,
}: {
  scope: ThreadPluginScopeState;
  plugins: ThreadPluginDto[];
  modules: FrontendPluginModule[];
  readOnly: boolean;
  onOpenGlobal?: () => void;
  onEdit: (plugin: ThreadPluginDto) => void;
}) {
  const { t } = useI18n();
  if (scope.status !== 'ready' && !scope.plugins.length) {
    const message =
      scope.status === 'loading'
        ? t('settings.threadPluginsLoading')
        : scope.status === 'unsupported'
          ? t('settings.threadPluginsUnsupported')
          : scope.status === 'forbidden'
            ? t('settings.threadPluginsForbidden')
            : t('settings.threadPluginsLoadFailed');
    return (
      <div
        className="thread-plugins-message"
        role={scope.status === 'error' ? 'alert' : 'status'}
      >
        <p>{message}</p>
        {scope.status === 'error' && (
          <button type="button" onClick={() => void scope.reload()}>
            {t('settings.threadPluginsReload')}
          </button>
        )}
      </div>
    );
  }
  if (!plugins.length)
    return (
      <p className="thread-plugins-message" role="status">
        {t('settings.threadPluginsEmpty')}
      </p>
    );
  return (
    <div className="thread-plugins-body">
      {readOnly && (
        <p className="thread-plugins-note" role="note">
          {t('settings.threadPluginsReadOnly')}
        </p>
      )}
      <ul className="thread-plugins-list">
        {plugins.map((plugin) => (
          <PluginRow
            key={plugin.id}
            scope={scope}
            plugin={plugin}
            hasSettings={Boolean(
              modules.find((module) => module.manifest.id === plugin.id)
                ?.settingsSections?.length,
            )}
            readOnly={readOnly}
            {...(onOpenGlobal ? { onOpenGlobal } : {})}
            onEdit={() => onEdit(plugin)}
          />
        ))}
      </ul>
    </div>
  );
}

function PluginRow({
  scope,
  plugin,
  hasSettings,
  readOnly,
  onOpenGlobal,
  onEdit,
}: {
  scope: ThreadPluginScopeState;
  plugin: ThreadPluginDto;
  hasSettings: boolean;
  readOnly: boolean;
  onOpenGlobal?: () => void;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const choice = choiceOf(plugin);
  const busy = Boolean(scope.pending[plugin.id]);
  const failure = scope.pluginErrors[plugin.id];
  const unavailable = plugin.available === false;
  const locked = readOnly || busy || unavailable;
  const options: Array<{ value: Choice; label: string; aria: string }> = [
    {
      value: 'inherit',
      // Following the device says what it resolves to: the plugin's default.
      label: plugin.defaultEnabled === undefined
        ? t('settings.threadPluginsInherit')
        : t(plugin.globalEnabled && plugin.defaultEnabled ? 'settings.threadPluginsInheritOn' : 'settings.threadPluginsInheritOff'),
      aria: t('settings.threadPluginsInheritAria'),
    },
    {
      value: 'on',
      label: t('settings.threadPluginsOn'),
      aria: t('settings.threadPluginsOnAria'),
    },
    {
      value: 'off',
      label: t('settings.threadPluginsOff'),
      aria: t('settings.threadPluginsOffAria'),
    },
  ];
  return (
    <li className="thread-plugins-row" aria-label={plugin.name}>
      <div className="thread-plugins-row-head">
        <strong>{plugin.name}</strong>
        <span
          className={`thread-plugins-state ${plugin.enabled ? 'is-on' : 'is-off'}`}
        >
          {t(
            plugin.enabled
              ? 'settings.threadPluginsActive'
              : 'settings.threadPluginsInactive',
          )}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('settings.threadPluginsChoiceLabel', {
          name: plugin.name,
        })}
        className="thread-plugins-choice"
      >
        {options.map((option) => {
          // The device-wide switch wins: a conversation cannot turn on what it has off.
          const blocked = option.value === 'on' && !plugin.globalEnabled;
          return (
            <label
              key={option.value}
              className={blocked ? 'is-blocked' : undefined}
              title={blocked ? t('settings.threadPluginsGlobalOff') : undefined}
            >
              <input
                type="radio"
                name={`${id}-choice`}
                value={option.value}
                checked={choice === option.value}
                disabled={locked || blocked}
                aria-label={option.aria}
                onChange={() =>
                  void scope.setEnabledOverride(
                    plugin.id,
                    overrideOf(option.value),
                  )
                }
              />
              <span aria-hidden>{option.label}</span>
            </label>
          );
        })}
      </div>
      {!plugin.globalEnabled && (
        <p className="thread-plugins-note">
          {t('settings.threadPluginsGlobalOff')}
          {onOpenGlobal && (
            <button type="button" onClick={onOpenGlobal}>
              {t('settings.threadPluginsOpenGlobal')}
            </button>
          )}
        </p>
      )}
      {unavailable && plugin.unavailableReason && (
        <p className="thread-plugins-note">{plugin.unavailableReason}</p>
      )}
      {(hasSettings || plugin.settingsOverridden) && (
        <div className="thread-plugins-actions">
          {hasSettings && !readOnly && (
            <button type="button" disabled={busy} onClick={onEdit}>
              <Settings size={13} aria-hidden />
              {t('settings.threadPluginsSettings')}
            </button>
          )}
          {plugin.settingsOverridden && (
            <>
              <span className="thread-plugins-tag">
                {t('settings.threadPluginsCustom')}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void scope.resetSettings(plugin.id)}
                >
                  <RotateCcw size={13} aria-hidden />
                  {t('settings.threadPluginsReset')}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {failure && (
        <p className="thread-plugins-error" role="alert">
          {failure.message}
          {failure.conflict && (
            <button type="button" onClick={() => void scope.reload()}>
              {t('settings.threadPluginsReload')}
            </button>
          )}
        </p>
      )}
    </li>
  );
}

/**
 * The plugin's own settings sections, bound to this conversation: they load the
 * effective values and save them as the conversation's override.
 */
function ThreadPluginSettingsDialog({
  scope,
  plugin,
  module,
  onClose,
}: {
  scope: ThreadPluginScopeState;
  plugin: ThreadPluginDto;
  module: FrontendPluginModule | undefined;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const device = useDevicePlugins();
  const [generation, setGeneration] = useState(0);
  const enabled = useRef<boolean | null>(null);
  const descriptor = useRef(plugin);
  descriptor.current = plugin;
  // Reload the editor whenever this conversation's values are reset, from here or
  // from the plugin list; a plain save keeps the editor (and its "saved" note).
  const overridden = useRef(plugin.settingsOverridden);
  useEffect(() => {
    if (overridden.current && !plugin.settingsOverridden)
      setGeneration((value) => value + 1);
    overridden.current = plugin.settingsOverridden;
  }, [plugin.settingsOverridden]);
  const context = useMemo(
    () => ({
      pluginId: plugin.id,
      load: async (): Promise<PluginSettingsSnapshot> => {
        const snapshot = await scope.loadSettings(plugin.id);
        enabled.current = snapshot.enabled;
        return {
          revision: snapshot.revision,
          values: snapshot.effective.values,
        };
      },
      save: async (
        settings: PluginSettingsSnapshot,
      ): Promise<PluginSettingsSnapshot> => {
        // Saving settings keeps the conversation's switch as it was.
        const saved = await scope.saveSettings(plugin.id, {
          revision: settings.revision,
          enabled: enabled.current,
          values: settings.values,
        });
        enabled.current = saved.enabled;
        return { revision: saved.revision, values: saved.effective.values };
      },
      ...(device.adapter?.connections
        ? { connections: device.adapter.connections }
        : {}),
      get plugin() {
        return descriptor.current;
      },
    }),
    // A new generation reloads the editor after its values were reset.
    [
      scope.loadSettings,
      scope.saveSettings,
      plugin.id,
      device.adapter,
      generation,
    ],
  );
  const sections = module?.settingsSections ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="thread-graph-dialog matter-settings-dialog plugin-settings-dialog"
        overlayClassName="plugin-settings-overlay"
      >
        <DialogHeader className="plugin-settings-dialog-header">
          <DialogTitle>
            {t('settings.threadPluginsSettingsTitle', { name: plugin.name })}
          </DialogTitle>
          <DialogDescription>
            {t('settings.threadPluginsSettingsHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="plugin-settings-dialog-body">
          {plugin.settingsOverridden && (
            <p className="thread-plugins-note" role="note">
              {t('settings.threadPluginsCustom')}
              <button
                type="button"
                disabled={Boolean(scope.pending[plugin.id])}
                onClick={() => void scope.resetSettings(plugin.id)}
              >
                {t('settings.threadPluginsReset')}
              </button>
            </p>
          )}
          {sections.map((section) => (
            <div key={`${section.id}:${generation}`}>
              {section.render(context)}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
