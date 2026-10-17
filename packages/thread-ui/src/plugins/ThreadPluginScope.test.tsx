/** @vitest-environment jsdom */
import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { setLocale } from '../i18n';
import { PluginProvider, type PluginProviderAdapter } from './PluginProvider';
import { PluginSettingsButton } from './PluginSettingsButton';
import type {
  FrontendPluginModule,
  PluginSettingsContext,
  ThreadPluginAdapter,
  ThreadPluginDto,
  ThreadPluginSettingsInput,
} from './plugin-types';
import { ThreadPluginScope } from './ThreadPluginScope';
import { ThreadPluginsControl } from './ThreadPluginsControl';
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
  document.body.innerHTML = '';
});

const ID = 'demo.panel';
/** Any plugin with a panel, settings and stored results; nothing Content Quality specific. */
function DemoSettings({ load, save }: PluginSettingsContext) {
  const [snapshot, setSnapshot] = useState<{
    revision: number;
    values: Record<string, unknown>;
  } | null>(null);
  const [tone, setTone] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void load().then((loaded) => {
      setSnapshot(loaded);
      setTone(String(loaded.values.tone ?? ''));
    });
  }, [load]);
  if (!snapshot) return <p>loading demo</p>;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save({
          revision: snapshot.revision,
          values: { ...snapshot.values, tone },
        })
          .then((saved) => {
            setSnapshot(saved);
            setStatus('saved');
          })
          .catch(() => setStatus('failed'));
      }}
    >
      <label>
        Tone
        <input
          aria-label="Tone"
          value={tone}
          onChange={(event) => setTone(event.target.value)}
        />
      </label>
      <button type="submit">Save demo</button>
      <span data-testid="demo-status">{status}</span>
    </form>
  );
}
const demo: FrontendPluginModule = {
  manifest: {
    id: ID,
    name: 'Panel Demo',
    version: '1',
    description: 'demo',
    remoteCodex: '*',
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [
        { id: 'p', kind: 'demo', label: 'Demo', artifactTypes: [] },
      ],
    },
  },
  threadPanels: [{ id: 'p', kind: 'demo', label: 'Demo' }],
  settingsSections: [
    {
      id: 's',
      label: 'Demo',
      render: (context) => <DemoSettings {...context} />,
    },
  ],
  presentMessage: ({ item }) =>
    item.text === 'old reply'
      ? { id: 'stored', text: 'stored result', label: 'L', originalLabel: 'O' }
      : null,
};

type Own = {
  revision: number;
  enabled: boolean | null;
  values: Record<string, unknown> | null;
};
function fakeBackend(globalEnabled = true) {
  const global = { enabled: globalEnabled, values: { tone: 'global' } };
  const threads: Record<string, Own> = {};
  const own = (thread: string) =>
    (threads[thread] ??= { revision: 1, enabled: null, values: null });
  const snapshot = (thread: string) => {
    const o = own(thread);
    return {
      revision: o.revision,
      globalRevision: 1,
      enabled: o.enabled,
      values: o.values,
      effective: {
        enabled: global.enabled && (o.enabled ?? global.enabled),
        values: o.values ?? global.values,
      },
    };
  };
  const saves: Array<[string, ThreadPluginSettingsInput]> = [];
  let failNext: number | null = null;
  const adapter: ThreadPluginAdapter = {
    fetchPlugins: vi.fn(async (thread: string): Promise<ThreadPluginDto[]> => {
      const s = snapshot(thread);
      return [
        {
          ...demo.manifest,
          enabled: s.effective.enabled,
          available: true,
          globalEnabled: global.enabled,
          enabledOverride: s.enabled,
          settingsOverridden: s.values !== null,
        },
      ];
    }),
    loadSettings: vi.fn(async (thread: string) => snapshot(thread)),
    saveSettings: vi.fn(async (thread: string, _id: string, input) => {
      saves.push([thread, input]);
      if (failNext) {
        const status = failNext;
        failNext = null;
        throw Object.assign(new Error('nope'), { statusCode: status });
      }
      const o = own(thread);
      if (input.revision !== o.revision)
        throw Object.assign(new Error('stale'), { statusCode: 409 });
      o.revision += 1;
      o.enabled = input.enabled;
      o.values = input.values;
      return snapshot(thread);
    }),
  };
  return {
    adapter,
    global,
    saves,
    own,
    failNextWith: (status: number) => {
      failNext = status;
    },
  };
}

function Probe({ name }: { name: string }) {
  const plugins = usePlugins();
  const panels = plugins.getThreadPanels().length;
  const stored = plugins.presentMessage({
    item: { kind: 'agentMessage', text: 'old reply' } as ThreadHistoryItemDto,
    streaming: false,
  });
  return (
    <p data-testid={name}>
      {`panels:${panels} stored:${stored?.text ?? 'none'}`}
    </p>
  );
}

async function renderScopes(
  backend: ReturnType<typeof fakeBackend>,
  options: { readOnly?: boolean; deviceAdapter?: PluginProviderAdapter } = {},
) {
  const adapter: PluginProviderAdapter = options.deviceAdapter ?? {
    fetchPlugins: () => [
      { ...demo.manifest, enabled: backend.global.enabled, available: true },
    ],
    loadPluginSettings: vi
      .fn()
      .mockResolvedValue({ revision: 1, values: { tone: 'global' } }),
    savePluginSettings: vi.fn(),
    threads: backend.adapter,
  };
  await act(async () =>
    root.render(
      <PluginProvider adapter={adapter} builtinPlugins={[demo]}>
        <section data-testid="a">
          <ThreadPluginScope threadId="a">
            <Probe name="probe-a" />
            <ThreadPluginsControl readOnly={options.readOnly ?? false} />
          </ThreadPluginScope>
        </section>
        <section data-testid="b">
          <ThreadPluginScope threadId="b">
            <Probe name="probe-b" />
          </ThreadPluginScope>
        </section>
        <PluginSettingsButton plugin={demo.manifest} />
      </PluginProvider>,
    ),
  );
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement;
const byText = (text: string, tag = 'button') =>
  [...document.querySelectorAll(tag)].find(
    (element) => element.textContent === text,
  ) as HTMLElement | undefined;
async function openPanel() {
  await act(async () =>
    q('button[aria-label^="Plugins in this conversation"]').click(),
  );
}
const radio = (label: string) =>
  q(`input[aria-label="${label}"]`) as HTMLInputElement;
async function pick(label: string) {
  await act(async () => radio(label).click());
}

it('overrides one conversation without touching another, then follows the global switch again', async () => {
  const backend = fakeBackend();
  await renderScopes(backend);
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  await openPanel();
  expect(radio('Use the global setting').checked).toBe(true);
  expect(byText('Active', 'span')).toBeTruthy();
  await pick('Off in this conversation');
  // A switch sends the conversation's own values (none yet), never the effective ones.
  expect(backend.saves).toEqual([
    ['a', { revision: 1, enabled: false, values: null }],
  ]);
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    // History stays readable even with the plugin off here.
    'panels:0 stored:stored result',
  );
  expect(q('[data-testid="probe-b"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  expect(byText('Not active', 'span')).toBeTruthy();
  expect(q('.thread-plugins-dot')).not.toBeNull();
  await pick('Use the global setting');
  expect(backend.saves.at(-1)).toEqual([
    'a',
    { revision: 2, enabled: null, values: null },
  ]);
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  expect(backend.own('b').revision).toBe(1);
});

it('edits settings for one conversation, keeps its switch, and restores the global values', async () => {
  const backend = fakeBackend();
  await renderScopes(backend);
  await openPanel();
  await pick('On in this conversation');
  await act(async () => byText('Settings here')!.click());
  const tone = () => q('input[aria-label="Tone"]') as HTMLInputElement;
  // The editor starts from the effective values.
  expect(tone().value).toBe('global');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(tone(), 'friendly');
    tone().dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => byText('Save demo')!.click());
  expect(backend.saves.at(-1)).toEqual([
    'a',
    { revision: 2, enabled: true, values: { tone: 'friendly' } },
  ]);
  expect(backend.own('b').values).toBeNull();
  const restore = [...document.querySelectorAll('button')].filter((button) =>
    button.textContent?.includes('Restore global settings'),
  );
  expect(restore.length).toBeGreaterThan(0);
  await act(async () => restore[0]!.click());
  expect(backend.saves.at(-1)).toEqual([
    'a',
    { revision: 3, enabled: true, values: null },
  ]);
  expect(tone().value).toBe('global');
});

it('cannot switch on what the device has off and points to the global settings', async () => {
  const backend = fakeBackend(false);
  await renderScopes(backend);
  await openPanel();
  expect(radio('On in this conversation').disabled).toBe(true);
  expect(document.body.textContent).toContain(
    'Off globally, so it cannot be turned on for one conversation.',
  );
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:0 stored:stored result',
  );
});

it('rolls back a failed change and asks for an explicit reload after a conflict', async () => {
  const backend = fakeBackend();
  await renderScopes(backend);
  await openPanel();
  backend.failNextWith(409);
  await pick('Off in this conversation');
  expect(radio('Use the global setting').checked).toBe(true);
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  expect(q('.thread-plugins-error').textContent).toContain(
    'Changed elsewhere. Reload, then try again.',
  );
  const fetches = vi.mocked(backend.adapter.fetchPlugins).mock.calls.length;
  await act(async () => byText('Reload')!.click());
  expect(vi.mocked(backend.adapter.fetchPlugins).mock.calls.length).toBe(
    fetches + 1,
  );
  backend.failNextWith(500);
  await pick('Off in this conversation');
  expect(q('.thread-plugins-error').textContent).toBe('nope');
  expect(radio('Use the global setting').checked).toBe(true);
});

it('shows the effective state read-only and keeps global settings global inside a conversation', async () => {
  const backend = fakeBackend();
  backend.own('a').enabled = false;
  await renderScopes(backend, { readOnly: true });
  await openPanel();
  expect(document.body.textContent).toContain('View only');
  for (const label of [
    'Use the global setting',
    'On in this conversation',
    'Off in this conversation',
  ])
    expect(radio(label).disabled).toBe(true);
  expect(byText('Settings here')).toBeUndefined();
  // The device-wide settings button reads the device switch, not this conversation's.
  expect(
    document.querySelector('[role="note"].plugin-settings-off'),
  ).toBeNull();
  expect(backend.saves).toEqual([]);
});

it('falls back to the device scope on an older Supervisor without retrying', async () => {
  const backend = fakeBackend();
  vi.mocked(backend.adapter.fetchPlugins).mockRejectedValue(
    Object.assign(new Error('not found'), { statusCode: 404 }),
  );
  await renderScopes(backend);
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  await openPanel();
  expect(document.body.textContent).toContain(
    'Update this Supervisor to set plugins per conversation.',
  );
  expect(byText('Reload')).toBeUndefined();
  // One request per conversation; no retry loop.
  expect(
    vi
      .mocked(backend.adapter.fetchPlugins)
      .mock.calls.map((c) => c[0])
      .sort(),
  ).toEqual(['a', 'b']);
});

it('does not refetch when the host passes a new adapter object on each render', async () => {
  const backend = fakeBackend();
  const render = () =>
    root.render(
      <PluginProvider adapter={{}} builtinPlugins={[demo]}>
        <ThreadPluginScope threadId="a" adapter={{ ...backend.adapter }}>
          <Probe name="probe-a" />
        </ThreadPluginScope>
      </PluginProvider>,
    );
  await act(async () => render());
  await act(async () => render());
  await act(async () => render());
  expect(backend.adapter.fetchPlugins).toHaveBeenCalledTimes(1);
});

it('follows a device-wide switch and settings save at once, without leaving the conversation', async () => {
  const backend = fakeBackend();
  let device: ReturnType<typeof usePlugins> | undefined;
  function DeviceHandle() {
    device = usePlugins();
    return null;
  }
  const save = vi.fn(
    async (
      _id: string,
      snapshot: { revision: number; values: Record<string, unknown> },
    ) => ({
      ...snapshot,
      revision: snapshot.revision + 1,
    }),
  );
  const adapter: PluginProviderAdapter = {
    fetchPlugins: () => [
      { ...demo.manifest, enabled: backend.global.enabled, available: true },
    ],
    loadPluginSettings: vi
      .fn()
      .mockResolvedValue({ revision: 1, values: { tone: 'global' } }),
    savePluginSettings: save,
    threads: backend.adapter,
  };
  await act(async () =>
    root.render(
      <PluginProvider adapter={adapter} builtinPlugins={[demo]}>
        <DeviceHandle />
        <ThreadPluginScope threadId="a">
          <Probe name="probe-a" />
        </ThreadPluginScope>
        <PluginSettingsButton plugin={demo.manifest} />
      </PluginProvider>,
    ),
  );
  const fetches = () =>
    vi.mocked(backend.adapter.fetchPlugins).mock.calls.length;
  expect(fetches()).toBe(1);
  // Switching the plugin off device-wide wins at once and refreshes the scope.
  backend.global.enabled = false;
  await act(async () => device!.setPluginEnabled(ID, false));
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:0 stored:stored result',
  );
  expect(fetches()).toBe(2);
  backend.global.enabled = true;
  await act(async () => device!.setPluginEnabled(ID, true));
  expect(q('[data-testid="probe-a"]').textContent).toBe(
    'panels:1 stored:stored result',
  );
  expect(fetches()).toBe(3);
  // Saving the device-wide settings refreshes what the conversation inherits.
  await act(async () => q('button[aria-label="Panel Demo settings"]').click());
  await act(async () => byText('Save demo')!.click());
  expect(save).toHaveBeenCalledTimes(1);
  expect(fetches()).toBe(4);
});
