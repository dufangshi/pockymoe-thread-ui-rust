/**
 * @vitest-environment jsdom
 */
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { terminalPluginManifest } from '@pockymoe/plugin-terminal';
import type { PluginDto } from '@pockymoe/shared';
import { PluginProvider, type PluginProviderAdapter } from './PluginProvider';
import type { PluginContextValue } from './plugin-context';
import type { FrontendPluginModule } from './plugin-types';
import { usePlugins } from './usePlugins';

const terminalModule: FrontendPluginModule = {
  manifest: terminalPluginManifest,
  threadPanels: [{ id: 'terminal', kind: 'terminal', label: 'Terminal' }],
};

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

function Capture({ onValue }: { onValue: (value: PluginContextValue) => void }) {
  const value = usePlugins();
  useEffect(() => onValue(value), [onValue, value]);
  return null;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('PluginProvider', () => {
  it('keeps registered settings load/save available while disabled and hides unavailable or unregistered sections', async () => {
    const snapshot = { revision: 7, values: { model: 'configured-model' } };
    const loadPluginSettings = vi.fn().mockResolvedValue(snapshot);
    const savePluginSettings = vi.fn().mockResolvedValue({ ...snapshot, revision: 8 });
    let reported: PluginDto[] = [{ ...terminalPluginManifest, enabled: false, available: true }];
    const adapter: PluginProviderAdapter = {
      fetchPlugins: () => reported,
      loadPluginSettings,
      savePluginSettings,
    };
    const module: FrontendPluginModule = {
      ...terminalModule,
      settingsSections: [{
        id: 'test', label: 'Plugin settings',
        render: context => <>
          <button onClick={() => void context.load()}>Load settings</button>
          <button onClick={() => void context.save(snapshot)}>Save settings</button>
        </>,
      }],
    };
    let latest: PluginContextValue | null = null;
    function Settings() {
      const plugins = usePlugins();
      latest = plugins;
      return <>{plugins.getSettingsSections().map(section => <div key={section.id}>{section.content}</div>)}</>;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<PluginProvider adapter={adapter} builtinPlugins={[module]}><Settings /></PluginProvider>));
    expect(latest!.plugins[0]?.enabled).toBe(false);
    expect(latest!.getSettingsSections()).toHaveLength(1);
    await act(async () => { container!.querySelectorAll('button')[0]!.click(); });
    await act(async () => { container!.querySelectorAll('button')[1]!.click(); });
    expect(loadPluginSettings).toHaveBeenCalledWith(terminalPluginManifest.id);
    expect(savePluginSettings).toHaveBeenCalledWith(terminalPluginManifest.id, snapshot);
    await act(async () => latest!.setPluginEnabled(terminalPluginManifest.id, true));
    await act(async () => latest!.setPluginEnabled(terminalPluginManifest.id, false));
    expect(latest!.getSettingsSections()).toHaveLength(1);
    reported = [{ ...reported[0]!, available: false }];
    await act(async () => latest!.refresh());
    expect(latest!.getSettingsSections()).toEqual([]);
    expect(container!.querySelector('button')).toBeNull();
    reported = [];
    await act(async () => latest!.refresh());
    expect(latest!.getSettingsSections()).toEqual([]);
  });

  it('shows browser-only settings only while the plugin is enabled', async () => {
    let reported: PluginDto[] = [{ ...terminalPluginManifest, enabled: true, available: true }];
    const adapter: PluginProviderAdapter = { fetchPlugins: () => reported, updatePlugin: async (_id, input) => { reported = [{ ...reported[0]!, enabled: input.enabled }]; return reported[0]!; } };
    const module: FrontendPluginModule = {
      ...terminalModule,
      browserSettingsSections: [{ id: 'clipboard', label: 'Terminal', render: () => <p>Copy on select</p> }],
    };
    let latest: PluginContextValue | null = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<PluginProvider adapter={adapter} builtinPlugins={[module]}><Capture onValue={value => { latest = value; }} /></PluginProvider>));
    expect(latest!.getSettingsSections().map(section => section.id)).toEqual([`plugin:${terminalPluginManifest.id}:clipboard`]);
    await act(async () => latest!.setPluginEnabled(terminalPluginManifest.id, false));
    expect(latest!.getSettingsSections()).toEqual([]);
    reported = [{ ...reported[0]!, enabled: true, available: false }];
    await act(async () => latest!.refresh());
    expect(latest!.getSettingsSections()).toEqual([]);
  });

  it('updates enabled state before the server request settles', async () => {
    let resolveUpdate: ((plugin: PluginDto) => void) | null = null;
    const updated = new Promise<PluginDto>((resolve) => {
      resolveUpdate = resolve;
    });
    const serverPlugin: PluginDto = {
      ...terminalPluginManifest,
      enabled: true,
      source: 'builtin',
    };
    const adapter: PluginProviderAdapter = {
      fetchPlugins: () => [serverPlugin],
      updatePlugin: () => updated,
    };
    let latest: PluginContextValue | null = null;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <PluginProvider adapter={adapter} builtinPlugins={[terminalModule]}>
          <Capture onValue={(value) => { latest = value; }} />
        </PluginProvider>,
      );
    });

    let request: Promise<void> | undefined;
    act(() => {
      request = latest!.setPluginEnabled('remote-codex.terminal', false);
    });
    expect(latest!.plugins[0]?.enabled).toBe(false);

    await act(async () => {
      resolveUpdate?.({ ...serverPlugin, enabled: false });
      await request;
    });
    expect(latest!.plugins[0]?.enabled).toBe(false);
  });
});
