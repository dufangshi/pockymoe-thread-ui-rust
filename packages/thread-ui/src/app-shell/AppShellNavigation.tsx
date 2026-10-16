import { translate, useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { ImportPluginInput } from '@pockymoe/shared';
import { usePlugins } from '../plugins/usePlugins';
import { type ThemeMode, useAppShellNav } from './AppShellNavContext';
import { PhoneHandChoice } from './PhoneHandChoice';

function MenuIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
      <path d="M2 3.25h12v1.5H2Zm0 4h12v1.5H2Zm0 4h12v1.5H2Z" />
    </svg>
  );
}

function CloseIcon() {
  const { locale: i18nLocale } = useI18n();
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
      <path d="M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" />
    </svg>
  );
}

function menuItemClassName(disabled = false) {
  return `flex w-full items-center rounded-[0.95rem] px-3 py-2 text-left text-sm transition ${
    disabled
      ? 'cursor-not-allowed bg-[var(--theme-muted)] text-[var(--theme-fg-muted)]'
      : 'text-[var(--theme-fg)] hover:bg-[var(--theme-hover)]'
  }`;
}

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: 'light',
    get label() { return translate("files.light"); },
    get description() { return translate("files.alwaysUseTheBrightTheme"); },
  },
  {
    value: 'dark',
    get label() { return translate("files.dark"); },
    get description() { return translate("files.alwaysUseTheDarkTheme"); },
  },
  {
    value: 'system',
    get label() { return translate("files.system"); },
    get description() { return translate("files.followTheOperatingSystemAppearance"); },
  },
];

export interface AppShellNavigationItem {
  label: string;
  href: string;
}

export interface AppShellNavigationMenuProps {
  className?: string;
  currentPath?: string;
  items?: AppShellNavigationItem[];
  onNavigate?: (href: string) => void;
}

export function AppShellMenuButton({ className = '' }: { className?: string }) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();

  if (!shellNav) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={shellNav.navOpen ? translate("files.closeNavigation") : translate("files.openNavigation")}
      aria-expanded={shellNav.navOpen}
      aria-controls="app-shell-navigation-menu"
      onClick={shellNav.toggleNav}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center text-[var(--theme-fg)] transition hover:text-[var(--theme-fg-soft)] ${className}`.trim()}
    >
      {shellNav.navOpen ? <CloseIcon /> : <MenuIcon />}
    </button>
  );
}

export function AppShellNavigationMenu({
  className = '',
  currentPath = '',
  items = [{ label: translate("files.workspaces"), href: '/workspaces' }],
  onNavigate,
}: AppShellNavigationMenuProps) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shellNav?.navOpen) {
      return;
    }

    const activeNav = shellNav;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const menuNode = menuRef.current;
      if (menuNode?.contains(target)) {
        return;
      }

      const trigger = target instanceof Element
        ? target.closest('[aria-controls="app-shell-navigation-menu"]')
        : null;
      if (trigger) {
        return;
      }

      activeNav.closeNav();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [shellNav]);

  if (!shellNav?.navOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      id="app-shell-navigation-menu"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      className={`rounded-[1.8rem] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 shadow-2xl shadow-black/15 backdrop-blur ${className}`.trim()}
    >
      <div>
        <p className="text-base font-semibold tracking-wide text-[var(--theme-accent-strong)]">
          Pockymoe
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[var(--theme-fg-muted)]">
          {translate("files.navigation")}</p>
      </div>
      <nav className="mt-4 flex flex-col gap-1.5 text-sm">
        {items.map((item) => {
          const active = currentPath === item.href;
          return (
            <button
              key={item.href}
              type="button"
              disabled={active}
              onClick={() => {
                if (active) {
                  return;
                }
                shellNav.closeNav();
                onNavigate?.(item.href);
              }}
              className={menuItemClassName(active)}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={shellNav.openSettings}
          className={menuItemClassName()}
        >
          {translate("files.settings")}</button>
      </nav>
    </div>
  );
}

export interface AppShellSettingsDialogProps {
  extraContent?: ReactNode;
  importPluginInput?: (draft: string) => ImportPluginInput;
}

function defaultImportPluginInput(draft: string): ImportPluginInput {
  const trimmed = draft.trim();
  const isManifestJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  return {
    ...(isManifestJson ? { manifestJson: trimmed } : { manifestUrl: trimmed }),
    enabled: true,
  };
}

export function AppShellSettingsDialog({
  extraContent,
  importPluginInput = defaultImportPluginInput,
}: AppShellSettingsDialogProps = {}) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  const plugins = usePlugins();
  const [pluginImportDraft, setPluginImportDraft] = useState('');
  const [pluginImportState, setPluginImportState] = useState<{
    busy: boolean;
    message: string | null;
    error: string | null;
  }>({
    busy: false,
    message: null,
    error: null,
  });
  const selectedThemeMode = shellNav?.themeMode ?? 'system';
  const effectiveTheme = shellNav?.effectiveTheme ?? 'dark';
  const autoCollapseCompletedTurns =
    shellNav?.autoCollapseCompletedTurns ?? true;

  useEffect(() => {
    if (!shellNav?.settingsOpen) {
      return;
    }

    const activeNav = shellNav;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        activeNav.closeSettings();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shellNav]);

  async function handleImportPlugin() {
    const draft = pluginImportDraft.trim();
    if (!draft || pluginImportState.busy) {
      return;
    }

    setPluginImportState({
      busy: true,
      message: null,
      error: null,
    });
    try {
      await plugins.importPluginManifest(importPluginInput(draft));
      setPluginImportDraft('');
      setPluginImportState({
        busy: false,
        message: translate("files.pluginImported"),
        error: null,
      });
    } catch (error) {
      setPluginImportState({
        busy: false,
        message: null,
        error: error instanceof Error ? error.message : translate("files.unableToImportPlugin"),
      });
    }
  }

  async function handleUninstallPlugin(pluginId: string, pluginName: string) {
    const confirmed = window.confirm(`Uninstall ${pluginName}?`);
    if (!confirmed) {
      return;
    }

    try {
      await plugins.uninstallPlugin(pluginId);
    } catch (error) {
      setPluginImportState({
        busy: false,
        message: null,
        error: error instanceof Error ? error.message : translate("files.unableToUninstallPlugin"),
      });
    }
  }

  if (!shellNav?.settingsOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:items-center">
      <button
        type="button"
        aria-label={translate("files.closeSettings")}
        onClick={shellNav.closeSettings}
        className="ui-overlay-scrim absolute inset-0 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={translate("files.settings")}
        className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-[var(--theme-border)] bg-[var(--theme-panel)] shadow-2xl shadow-black/20"
      >
        <div className="shrink-0 p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--theme-fg-muted)]">
                {translate("files.settings")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--theme-fg)]">
                {translate("files.settings")}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--theme-fg-soft)]">
                {translate("files.manageAppearanceAndThreadUIPlugins")}</p>
            </div>
            <button
              type="button"
              aria-label={translate("files.closeSettings")}
              onClick={shellNav.closeSettings}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface-strong)] text-[var(--theme-fg)] transition hover:border-[var(--theme-border-contrast)] hover:bg-[var(--theme-hover)]"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-5">
          <div className="space-y-2">
            <div className="rounded-[1.1rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--theme-fg)]">{translate("files.appearance")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">
                    {translate("files.chooseLightDarkOrFollowTheSystem")} {effectiveTheme}.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const active = selectedThemeMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => shellNav.setThemeMode(option.value)}
                      className={`block rounded-[1rem] border px-3 py-2.5 text-left transition ${
                        active
                          ? 'border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)]'
                          : 'border-[var(--theme-border)] bg-[var(--theme-surface-strong)] hover:bg-[var(--theme-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[var(--theme-fg)]">
                          {option.label}
                        </span>
                        {active ? (
                          <span className="rounded-full border border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--theme-accent-strong)]">
                            {translate("files.active")}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {shellNav?.setPhoneDock ? (
              <div className="rounded-[1.1rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--theme-fg)]">{translate("workbench.phoneDockSetting")}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">{translate("workbench.phoneDockSettingHint")}</p>
                  </div>
                  <label className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-medium text-[var(--theme-fg-soft)]">
                    <input type="checkbox" checked={shellNav.phoneDock ?? true}
                      onChange={(event) => shellNav.setPhoneDock?.(event.currentTarget.checked)}
                      className="h-4 w-4 accent-[var(--theme-accent-solid)]" />
                    <span>{translate("workbench.phoneDockSettingToggle")}</span>
                  </label>
                </div>
                {shellNav.setPhoneHand && (shellNav.phoneDock ?? true) ? (
                  <PhoneHandChoice hand={shellNav.phoneHand ?? 'right'} onChange={shellNav.setPhoneHand} />
                ) : null}
              </div>
            ) : null}

            {shellNav?.setAutoCollapseCompletedTurns ? (
              <div className="rounded-[1.1rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--theme-fg)]">
                      {translate("files.threadTimeline")}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">
                      {translate("files.collapseCompletedTurnsIntoPromptElapsedWork")}</p>
                  </div>
                  <label className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-medium text-[var(--theme-fg-soft)]">
                    <input
                      type="checkbox"
                      checked={autoCollapseCompletedTurns}
                      onChange={(event) =>
                        shellNav.setAutoCollapseCompletedTurns?.(
                          event.currentTarget.checked,
                        )
                      }
                      className="h-4 w-4 accent-[var(--theme-accent-solid)]"
                    />
                    <span>{translate("files.autoCollapse")}</span>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.1rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--theme-fg)]">{translate("files.plugins")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">
                    {translate("files.enableRenderersAndThreadExtensionsLoadedBy")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void plugins.refresh()}
                  disabled={plugins.loading}
                  className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:text-[var(--theme-fg-muted)]"
                >
                  {plugins.loading ? translate("files.loading") : translate("files.refresh")}
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {plugins.plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-start justify-between gap-3 rounded-[1rem] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--theme-fg)]">
                        {plugin.name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--theme-fg-muted)]">
                        {plugin.description}
                      </span>
                      <span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-[var(--theme-fg-muted)]">
                        {[
                          ...plugin.capabilities.artifactTypes.map((type) => type.type),
                          ...plugin.capabilities.threadPanels.map((panel) => panel.kind ?? panel.id),
                        ].join(', ') || translate("files.utility")}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-[var(--theme-fg-muted)]">
                        {plugin.source === 'imported' ? translate("files.importedManifest") : translate("files.builtInModule")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {plugin.source === 'imported' ? (
                        <button
                          type="button"
                          onClick={() => void handleUninstallPlugin(plugin.id, plugin.name)}
                          className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-xs font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)]"
                        >
                          {translate("files.uninstall")}</button>
                      ) : null}
                      <label className="sr-only" htmlFor={`plugin-toggle-${plugin.id}`}>
                        {translate("files.toggle")} {plugin.name}
                      </label>
                      <input
                        id={`plugin-toggle-${plugin.id}`}
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={(event) =>
                          void plugins.setPluginEnabled(plugin.id, event.currentTarget.checked)
                        }
                        className="h-4 w-4 accent-[var(--theme-accent-solid)]"
                      />
                    </span>
                  </div>
                ))}
                {plugins.plugins.length === 0 && (
                  <p className="rounded-[1rem] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-3 py-3 text-xs text-[var(--theme-fg-muted)]">
                    {translate("files.noPluginsAreRegistered")}</p>
                )}
              </div>
              <div className="mt-3 border-t border-[var(--theme-border)] pt-3">
                <label className="block text-xs font-medium text-[var(--theme-fg)]">
                  {translate("files.importPlugin")}</label>
                <textarea
                  value={pluginImportDraft}
                  onChange={(event) => {
                    setPluginImportDraft(event.currentTarget.value);
                    if (pluginImportState.message || pluginImportState.error) {
                      setPluginImportState({ busy: false, message: null, error: null });
                    }
                  }}
                  placeholder={translate("files.pastePluginJsonOrManifestURL")}
                  rows={4}
                  className="mt-2 min-h-28 w-full resize-y rounded-[0.9rem] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-3 py-2 font-mono text-xs leading-5 text-[var(--theme-fg)] outline-none transition placeholder:text-[var(--theme-fg-muted)] focus:border-[var(--theme-accent-border)]"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="max-w-[42rem] text-xs leading-5 text-[var(--theme-fg-muted)]">
                    {translate("files.importsRegisterManifestDeclaredArtifactTypesRendering")}</p>
                  <button
                    type="button"
                    onClick={() => void handleImportPlugin()}
                    disabled={!pluginImportDraft.trim() || pluginImportState.busy}
                    className="rounded-full border border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--theme-accent-strong)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:border-[var(--theme-border)] disabled:bg-[var(--theme-muted)] disabled:text-[var(--theme-fg-muted)]"
                  >
                    {pluginImportState.busy ? translate("files.importing") : translate("files.import")}
                  </button>
                </div>
                {pluginImportState.error && (
                  <p className="mt-2 text-xs text-rose-300">{pluginImportState.error}</p>
                )}
                {pluginImportState.message && (
                  <p className="mt-2 text-xs text-emerald-300">{pluginImportState.message}</p>
                )}
              </div>
              {plugins.error && <p className="mt-2 text-xs text-rose-300">{plugins.error}</p>}
            </div>

            {extraContent}
          </div>
        </div>
      </section>
    </div>
  );
}
