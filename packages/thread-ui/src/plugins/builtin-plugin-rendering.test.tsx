/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import type { PluginDto } from '@pockymoe/shared';
import { builtinFrontendPlugins } from '../builtin-plugins';
import { createDefaultPluginContextValue, mergePluginState } from './plugin-context';

describe('built-in plugin rendering', () => {
  it('registers built-in plugins with Content Quality disabled by default', () => {
    const plugins = createDefaultPluginContextValue(builtinFrontendPlugins);
    expect(plugins.plugins.map((plugin) => plugin.id)).toEqual([
      'remote-codex.terminal',
      'remote-codex.deepseek-harness',
      'pockymoe.content-quality',
    ]);
    expect(plugins.plugins.find(plugin => plugin.id === 'pockymoe.content-quality')?.enabled).toBe(false);
    expect(plugins.getThreadPanels()).toEqual([
      { id: 'terminal', kind: 'terminal', label: 'Terminal' },
      { id: 'deepseek-harness', kind: 'harness:deepseek', label: 'DeepSeek Harness' },
    ]);
    expect(
      plugins.renderInlineCode({
        code: '3\nwater\nO 0 0 0',
        language: 'xyz',
        isIncomplete: false,
      }),
    ).toBeNull();
  });

  it('keeps the device availability report for built-in plugins', () => {
    const reported = {
      id: 'remote-codex.deepseek-harness',
      enabled: false,
      source: 'builtin',
      available: false,
      unavailableReason: 'Install DeepSeek Harness (dsh) on this device to use this plugin.',
    } as unknown as PluginDto;
    const merged = mergePluginState(builtinFrontendPlugins, [reported]);
    const dsh = merged.find((plugin) => plugin.id === reported.id) as PluginDto & { available?: boolean; unavailableReason?: string };
    expect(dsh).toMatchObject({ name: 'DeepSeek Harness', enabled: false, available: false });
    expect(dsh.unavailableReason).toMatch(/Install DeepSeek Harness/);
    expect(dsh.capabilities.threadPanels[0]?.kind).toBe('harness:deepseek');
  });

  it('retains backend action capabilities alongside frontend metadata', () => {
    const module = builtinFrontendPlugins.find(plugin => plugin.manifest.id === 'pockymoe.content-quality')!;
    const reported: PluginDto = { ...module.manifest, enabled: false, capabilities: { ...module.manifest.capabilities, actions: ['newBackendAction'] } };
    expect(mergePluginState(builtinFrontendPlugins, [reported]).find(plugin => plugin.id === reported.id)?.capabilities.actions).toEqual(['newBackendAction']);
  });
});
