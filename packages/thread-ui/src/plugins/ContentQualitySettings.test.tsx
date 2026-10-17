/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { ContentQualitySettings } from './ContentQualitySettings';
import { contentQualityPlugin } from './content-quality-plugin';
import { PluginProvider, type PluginProviderAdapter } from './PluginProvider';
import { usePlugins } from './usePlugins';
import type { PluginContextValue } from './plugin-context';

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
  vi.restoreAllMocks();
});

function control(label: string) {
  const element = [...container.querySelectorAll('label')].find(
    (element) => element.textContent === label,
  );
  expect(element, label).toBeTruthy();
  return document.getElementById(element!.htmlFor) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;
}
async function change(label: string, value: string) {
  const element = control(label);
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (element) => element.textContent === label,
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}

describe('Content Quality settings', () => {
  it('loads defaults for an empty snapshot, saves exact values/revision while disabled, and retains the form across enablement changes', async () => {
    let latest: PluginContextValue;
    function Sections() {
      latest = usePlugins();
      return (
        <>
          {latest.getSettingsSections().map((section) => (
            <div key={section.id}>{section.content}</div>
          ))}
        </>
      );
    }
    const loadPluginSettings = vi
      .fn()
      .mockResolvedValue({ revision: 3, values: {} });
    const savePluginSettings = vi
      .fn()
      .mockImplementation(async (_id, snapshot) => ({
        ...snapshot,
        revision: snapshot.revision + 1,
      }));
    const adapter: PluginProviderAdapter = {
      fetchPlugins: () => [
        { ...contentQualityPlugin.manifest, enabled: false, available: true },
      ],
      loadPluginSettings,
      savePluginSettings,
    };
    await act(async () =>
      root.render(
        <PluginProvider
          adapter={adapter}
          builtinPlugins={[contentQualityPlugin]}
        >
          <Sections />
        </PluginProvider>,
      ),
    );
    expect(control('Output language').value).toBe('zh-CN');
    expect(control('Auto-polish trigger length (characters)').value).toBe(
      '800',
    );
    expect(container.textContent).toContain(
      "only if the final reply's prose, not counting code, is at least this many characters",
    );
    // Without the host capability there is no connection picker and no file path.
    expect(container.textContent).toContain(
      'Saved connections cannot be chosen here.',
    );
    expect(container.textContent).not.toContain('Connection profile file');
    expect(control('Writing preset').querySelectorAll('option')).toHaveLength(
      5,
    );
    expect(control('Level of detail').value).toBe('balanced');
    expect(
      (control('Automatically polish long replies') as HTMLInputElement)
        .checked,
    ).toBe(true);
    await change('Output language', 'en');
    await change('Writing preset', 'technical');
    expect(container.textContent).toContain('Keep precise terminology');
    await change('Level of detail', 'short');
    await change('Reader background', 'Rust developer');
    await change('Auto-polish trigger length (characters)', '1200');
    await change('Default manual document action', 'rewrite');
    expect(control('Default manual document action').textContent).toContain(
      'write the revised file',
    );
    expect(container.textContent).toContain(
      'Automatic document reviews always use review mode',
    );
    expect(
      (control('Automatically review changed documents') as HTMLInputElement)
        .checked,
    ).toBe(false);
    await act(async () =>
      (
        control('Automatically review changed documents') as HTMLInputElement
      ).click(),
    );
    await act(async () =>
      (
        control('Automatically polish long replies') as HTMLInputElement
      ).click(),
    );
    await act(async () =>
      latest!.setPluginEnabled(contentQualityPlugin.manifest.id, true),
    );
    await act(async () =>
      latest!.setPluginEnabled(contentQualityPlugin.manifest.id, false),
    );
    expect(control('Reader background').value).toBe('Rust developer');
    expect(loadPluginSettings).toHaveBeenCalledTimes(1);
    await click('Save settings');
    expect(savePluginSettings).toHaveBeenLastCalledWith(
      contentQualityPlugin.manifest.id,
      {
        revision: 3,
        values: {
          connectionFile: '',
          model: '',
          language: 'en',
          preset: 'technical',
          detail: 'short',
          readerBackground: 'Rust developer',
          minReplyChars: 1200,
          autoReplies: false,
          autoDocuments: true,
          documentMode: 'rewrite',
        },
      },
    );
    expect(container.textContent).toContain('Settings saved.');
    await click('Save settings');
    expect(savePluginSettings.mock.calls[1]![1].revision).toBe(4);
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('offers only the host connection picker, never the file path, and saves stored values back', async () => {
    const pickerProps: Array<Record<string, unknown>> = [];
    const connections = {
      renderPicker: (props: {
        connectionId: string;
        model: string;
        protocols?: string[];
        onChange: (value: { connectionId: string; model: string }) => void;
      }) => {
        pickerProps.push(props);
        return (
          <button
            type="button"
            onClick={() =>
              props.onChange({ connectionId: 'conn-1', model: 'chat-model' })
            }
          >
            {`picker:${props.connectionId || 'none'}:${props.model || 'none'}`}
          </button>
        );
      },
    };
    const load = vi.fn().mockResolvedValue({
      revision: 5,
      values: {
        connectionFile: '/legacy/profile.json',
        model: 'old-model',
        futureOption: { kept: true },
      },
    });
    const save = vi
      .fn()
      .mockImplementation(async (snapshot) => ({ ...snapshot, revision: 6 }));
    await act(async () =>
      root.render(
        <ContentQualitySettings
          pluginId="quality"
          load={load}
          save={save}
          connections={connections}
        />,
      ),
    );
    expect(container.querySelector('details')).toBeNull();
    expect(container.textContent).not.toContain('Connection profile file');
    expect(
      [...container.querySelectorAll('input')].some(
        (input) => input.value === '/legacy/profile.json',
      ),
    ).toBe(false);
    expect(container.textContent).toContain(
      'An earlier connection setup is still in use.',
    );
    // The model belongs to the picker; there is no separate model field.
    expect(
      [...container.querySelectorAll('label')].some(
        (label) => label.textContent === 'Model',
      ),
    ).toBe(false);
    expect(pickerProps.at(-1)).toMatchObject({
      connectionId: '',
      model: 'old-model',
      protocols: ['openai_chat', 'openai_responses', 'anthropic', 'gemini'],
    });
    await change('Reader background', 'Kept while choosing');
    await click('picker:none:old-model');
    expect(container.textContent).toContain('picker:conn-1:chat-model');
    expect(control('Reader background').value).toBe('Kept while choosing');
    await click('Save settings');
    expect(save).toHaveBeenCalledWith({
      revision: 5,
      values: expect.objectContaining({
        connectionId: 'conn-1',
        model: 'chat-model',
        connectionFile: '/legacy/profile.json',
        readerBackground: 'Kept while choosing',
        futureOption: { kept: true },
      }),
    });
  });

  it('omits an empty connectionId unless it was stored, so older Supervisors accept the save', async () => {
    const connections = { renderPicker: () => <span>picker</span> };
    const save = vi
      .fn()
      .mockImplementation(async (snapshot) => ({ ...snapshot, revision: 2 }));
    const load = vi
      .fn()
      .mockResolvedValueOnce({ revision: 1, values: { model: 'm' } })
      .mockResolvedValue({
        revision: 3,
        values: { model: 'm', connectionId: '' },
      });
    await act(async () =>
      root.render(
        <ContentQualitySettings
          pluginId="quality"
          load={load}
          save={save}
          connections={connections}
        />,
      ),
    );
    expect(container.textContent).toContain(
      'Choose a saved connection, or add one with +.',
    );
    await change('Reader background', 'edited');
    await click('Save settings');
    expect(save.mock.calls[0]![0].values).not.toHaveProperty('connectionId');
    expect(save.mock.calls[0]![0].values).toMatchObject({
      model: 'm',
      readerBackground: 'edited',
    });
    await click('Reload saved settings');
    await click('Save settings');
    expect(save.mock.calls[1]![0].values).toHaveProperty('connectionId', '');
  });

  it('shows context limit defaults for older runtimes and only sends them once stored or changed', async () => {
    const save = vi
      .fn()
      .mockImplementation(async (snapshot) => ({ ...snapshot, revision: 2 }));
    const load = vi
      .fn()
      .mockResolvedValueOnce({ revision: 1, values: { model: 'm' } })
      .mockResolvedValue({
        revision: 3,
        values: { replyContextTurns: 0, replyContextMaxChars: 2500 },
      });
    await act(async () =>
      root.render(
        <ContentQualitySettings pluginId="quality" load={load} save={save} />,
      ),
    );
    const turns = control('Context turns') as HTMLInputElement;
    const chars = control('Context character limit') as HTMLInputElement;
    expect([turns.value, turns.min, turns.max]).toEqual(['5', '1', '1000']);
    expect([chars.value, chars.min, chars.max]).toEqual([
      '10000',
      '1',
      '10000000',
    ]);
    expect(container.textContent).toContain('including the one being polished');
    expect(container.textContent).toContain('characters, not tokens');
    // An older runtime rejects unknown keys: an untouched form leaves them out.
    await click('Save settings');
    expect(save.mock.calls[0]![0].values).not.toHaveProperty(
      'replyContextTurns',
    );
    expect(save.mock.calls[0]![0].values).not.toHaveProperty(
      'replyContextMaxChars',
    );
    await change('Context turns', '12');
    await click('Save settings');
    expect(save.mock.calls[1]![0].values).toMatchObject({
      replyContextTurns: 12,
    });
    expect(save.mock.calls[1]![0].values).not.toHaveProperty(
      'replyContextMaxChars',
    );
    // Stored values are kept; an out-of-range one falls back to the default.
    await click('Reload saved settings');
    expect(control('Context turns').value).toBe('5');
    expect(control('Context character limit').value).toBe('2500');
    await click('Save settings');
    expect(save.mock.calls[2]![0].values).toMatchObject({
      replyContextTurns: 5,
      replyContextMaxChars: 2500,
    });
    await act(async () => setLocale('zh-CN', false));
    expect(control('参考轮数').value).toBe('5');
    expect(container.textContent).toContain('含正在润色的这一轮');
    expect(container.textContent).toContain('按字符计，不是 token');
  });

  it('does not promise context limits on a runtime without them', async () => {
    const save = vi
      .fn()
      .mockImplementation(async (snapshot) => ({ ...snapshot, revision: 2 }));
    const load = vi
      .fn()
      .mockResolvedValueOnce({ revision: 1, values: {} })
      .mockResolvedValue({
        revision: 1,
        values: { replyContextTurns: 7, replyContextMaxChars: 3000 },
      });
    const descriptor = (replyContextLimits: boolean) => ({
      ...contentQualityPlugin.manifest,
      enabled: true,
      capabilities: {
        ...contentQualityPlugin.manifest.capabilities,
        ...(replyContextLimits ? { replyContextLimits } : {}),
      },
    });
    await act(async () =>
      root.render(
        <ContentQualitySettings
          key="old"
          pluginId="quality"
          load={load}
          save={save}
          plugin={descriptor(false)}
        />,
      ),
    );
    expect(control('Context turns').disabled).toBe(true);
    expect(control('Context character limit').disabled).toBe(true);
    expect(container.textContent).toContain(
      "Update this device's Supervisor to limit polishing context",
    );
    await click('Save settings');
    expect(save.mock.calls[0]![0].values).not.toHaveProperty(
      'replyContextTurns',
    );
    expect(save.mock.calls[0]![0].values).not.toHaveProperty(
      'replyContextMaxChars',
    );
    // A runtime that declares the capability edits and saves them.
    await act(async () =>
      root.render(
        <ContentQualitySettings
          key="new"
          pluginId="quality"
          load={load}
          save={save}
          plugin={descriptor(true)}
        />,
      ),
    );
    expect(control('Context turns').disabled).toBe(false);
    expect(container.textContent).not.toContain('Update this device');
    await click('Save settings');
    expect(save.mock.calls[1]![0].values).toMatchObject({
      replyContextTurns: 7,
      replyContextMaxChars: 3000,
    });
    // A runtime that declares them gets the limits saved, defaults included.
    await act(async () =>
      root.render(
        <ContentQualitySettings
          key="fresh"
          pluginId="quality"
          load={vi.fn().mockResolvedValue({ revision: 1, values: {} })}
          save={save}
          plugin={descriptor(true)}
        />,
      ),
    );
    await click('Save settings');
    expect(save.mock.calls[2]![0].values).toMatchObject({
      replyContextTurns: 5,
      replyContextMaxChars: 10000,
    });
  });

  it('passes the host connection capability through PluginProvider settings sections', async () => {
    const renderPicker = vi.fn(() => <span>host picker</span>);
    const adapter: PluginProviderAdapter = {
      fetchPlugins: () => [
        { ...contentQualityPlugin.manifest, enabled: true, available: true },
      ],
      loadPluginSettings: vi
        .fn()
        .mockResolvedValue({ revision: 0, values: {} }),
      savePluginSettings: vi.fn(),
      connections: { renderPicker },
    };
    function Sections() {
      const plugins = usePlugins();
      return (
        <>
          {plugins.getSettingsSections().map((section) => (
            <div key={section.id}>{section.content}</div>
          ))}
        </>
      );
    }
    await act(async () =>
      root.render(
        <PluginProvider
          adapter={adapter}
          builtinPlugins={[contentQualityPlugin]}
        >
          <Sections />
        </PluginProvider>,
      ),
    );
    expect(container.textContent).toContain('host picker');
    expect(renderPicker).toHaveBeenCalled();
  });

  it('retains edits on save failure and conflict, then explicitly reloads the latest revision', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        revision: 2,
        values: { readerBackground: 'saved' },
      })
      .mockResolvedValue({ revision: 9, values: { readerBackground: 'new' } });
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce({ statusCode: 409 })
      .mockImplementation(async (snapshot) => ({ ...snapshot, revision: 10 }));
    await act(async () =>
      root.render(
        <ContentQualitySettings pluginId="quality" load={load} save={save} />,
      ),
    );
    await change('Reader background', 'my-edit');
    await click('Save settings');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to save',
    );
    expect(control('Reader background').value).toBe('my-edit');
    await click('Save settings');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'changed elsewhere',
    );
    expect(control('Reader background').value).toBe('my-edit');
    expect(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Save settings',
      )?.disabled,
    ).toBe(true);
    await click('Reload saved settings');
    expect(control('Reader background').value).toBe('new');
    await click('Save settings');
    expect(save.mock.calls[2]![0].revision).toBe(9);
  });

  it('recovers from a load failure and localizes the independent page', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ revision: 0, values: {} });
    const save = vi.fn();
    await act(async () =>
      root.render(
        <ContentQualitySettings pluginId="quality" load={load} save={save} />,
      ),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load',
    );
    expect(container.querySelector('input')).toBeNull();
    await click('Reload saved settings');
    expect(control('Output language').value).toBe('zh-CN');
    await act(async () => setLocale('zh-CN', false));
    expect(control('自动润色触发长度（字符数）').value).toBe('800');
    expect(container.textContent).toContain(
      '最终回复正文达到此字符数后，才在回合结束时自动润色；代码不计入，较短的回复保持原样。',
    );
    expect(container.textContent).not.toContain('最短回复长度');
    expect(container.textContent).not.toContain('连接配置文件');
    expect(control('写作预设').querySelectorAll('option')).toHaveLength(5);
    expect(control('默认手动文档操作').textContent).toContain(
      '直接写入修订后的文件',
    );
    expect(container.textContent).toContain('可自由重组以便阅读');
    expect(
      [...container.querySelectorAll('button')].some(
        (button) => button.textContent === '保存设置',
      ),
    ).toBe(true);
  });
});
