/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { contentQualityPlugin } from './content-quality-plugin';
import type { PluginContextValue } from './plugin-context';
import { PluginProvider, type PluginProviderAdapter } from './PluginProvider';
import { PluginSettingsButton } from './PluginSettingsButton';
import { usePlugins } from './usePlugins';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  setLocale('en', false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it('tells the user a plugin is off while still letting its settings be saved', async () => {
  let latest: PluginContextValue;
  function Host() {
    latest = usePlugins();
    return <PluginSettingsButton plugin={contentQualityPlugin.manifest} />;
  }
  const save = vi
    .fn()
    .mockImplementation(async (_id, snapshot) => ({
      ...snapshot,
      revision: 2,
    }));
  const adapter: PluginProviderAdapter = {
    fetchPlugins: () => [
      { ...contentQualityPlugin.manifest, enabled: false, available: true },
    ],
    loadPluginSettings: vi.fn().mockResolvedValue({ revision: 1, values: {} }),
    savePluginSettings: save,
  };
  await act(async () =>
    root.render(
      <PluginProvider adapter={adapter} builtinPlugins={[contentQualityPlugin]}>
        <Host />
      </PluginProvider>,
    ),
  );
  await act(async () =>
    (
      document.querySelector(
        'button[aria-label="Content Quality settings"]',
      ) as HTMLButtonElement
    ).click(),
  );
  const note = () => document.querySelector('[role="note"]');
  expect(note()?.textContent).toBe(
    'This plugin is off. Turn it on in the plugin list for these settings to take effect.',
  );
  // No second switch: saving still works and does not turn the plugin on.
  const submit = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Save settings',
  )!;
  await act(async () => submit.click());
  expect(save).toHaveBeenCalledTimes(1);
  expect(note()).not.toBeNull();
  await act(async () =>
    latest!.setPluginEnabled(contentQualityPlugin.manifest.id, true),
  );
  expect(note()).toBeNull();
  await act(async () => setLocale('zh-CN', false));
  await act(async () =>
    latest!.setPluginEnabled(contentQualityPlugin.manifest.id, false),
  );
  expect(note()?.textContent).toBe('插件未启用，请在插件列表中开启后生效。');
});
