import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { buildThreadMap, type ThreadMapThread } from './model';
import { mapTipData } from './tooltipData';
const now = Date.parse('2026-11-01T12:00:00Z');
const thread = (extra: Partial<ThreadMapThread> = {}): ThreadMapThread => ({
  key: 'one',
  title: 'A readable title',
  href: '#one',
  agent: 'codex',
  agentName: 'Codex display',
  running: false,
  turns: 9,
  activeMs: 60000,
  totalMs: 7200000,
  model: 'internal-model-id',
  modelDisplayName: 'GPT display',
  lastActiveAt: new Date(now - 13 * 86400000).toISOString(),
  lastPrompt: '  Keep the latest prompt.\nCheck the edge case. ',
  priceEstimate: {
    totalUsd: 2.14,
    inputUsd: 2,
    cachedInputUsd: 0,
    outputUsd: 0.14,
  },
  hourlyMs: [3600000, 0],
  ...extra,
});
const nodes = (threads: ThreadMapThread[]) =>
  buildThreadMap(
    [
      {
        id: 'device',
        name: 'Display device',
        state: 'ready',
        workspaces: [
          { id: 'internal-workspace-id', label: 'Display workspace', threads },
        ],
      },
    ],
    'All',
    { keepDeviceRoot: true },
  ).children[0]!;
beforeEach(() => {
  setLocale('en', false);
  vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => vi.restoreAllMocks());
it('uses catalog/agent/workspace display labels and structured values without the old prose', () => {
  const data = mapTipData(nodes([thread()]).children[0]!.children[0]!);
  expect(data.agentLabel).toBe('Codex display');
  expect(data.subtitle).toBe('GPT display · Display workspace');
  expect(JSON.stringify(data)).not.toContain('internal-');
  expect(data.metrics.map((m) => m.kind)).toEqual([
    'turns',
    'total',
    'recent',
    'cost',
  ]);
  expect(data.metrics.find((m) => m.kind === 'recent')!.label).toContain('24');
  expect(data.hourly).toHaveLength(24);
  expect(data.hourly!.slice(-2)).toEqual([3600000, 0]);
  expect(data.prompt).toBe('Keep the latest prompt. Check the edge case.');
  expect(data.footer).toBe('active 13 days ago');
});
it('omits absent/nonfinite values rather than creating dash placeholders', () => {
  const data = mapTipData(
    nodes([
      thread({
        turns: null,
        activeMs: null,
        totalMs: undefined,
        priceEstimate: undefined,
        hourlyMs: undefined,
        lastPrompt: ' ',
        lastActiveAt: 'invalid',
        model: undefined,
        modelDisplayName: undefined,
      }),
    ]).children[0]!.children[0]!,
  );
  expect(data.metrics).toEqual([]);
  expect(data.hourly).toBeUndefined();
  expect(data.prompt).toBeUndefined();
  expect(data.footer).toBeUndefined();
  expect(data.subtitle).toBe('Display workspace');
  expect(JSON.stringify(data)).not.toContain('—');
});
it('preserves known zero counts/time/cost and does not turn them into unknown fields', () => {
  const data = mapTipData(
    nodes([
      thread({
        turns: 0,
        totalMs: 0,
        activeMs: 0,
        priceEstimate: {
          totalUsd: 0,
          inputUsd: 0,
          cachedInputUsd: 0,
          outputUsd: 0,
        },
      }),
    ]).children[0]!.children[0]!,
  );
  expect(data.metrics).toHaveLength(4);
  expect(data.metrics[0]!.value).toBe('0');
  expect(data.metrics[1]!.value).toContain('0');
  expect(data.metrics[2]!.value).toContain('0');
  expect(data.metrics[3]!.value).toContain('$0');
});
it('aggregates workspace/device totals and bars without recounting folded agents', () => {
  const root = nodes([
    thread({ children: [thread({ turns: 1000 })] }),
    thread({
      key: 'two',
      turns: 4,
      totalMs: 60000,
      activeMs: 30000,
      priceEstimate: undefined,
      hourlyMs: [0, 7200000],
    }),
  ]);
  const data = mapTipData(root.children[0]!);
  expect(data.metrics.find((m) => m.kind === 'threads')!.value).toBe('2');
  expect(data.metrics.find((m) => m.kind === 'turns')!.value).toBe('13');
  expect(data.metrics.find((m) => m.kind === 'cost')!.value).toContain('≥');
  expect(data.hourly!.slice(-2)).toEqual([3600000, 7200000]);
  expect(data.subtitle).toBe('Display device');
  expect(data.prompt).toBeUndefined();
  const device = mapTipData(root, 24, {
    runtimeVersion: '0.13.41',
    metrics: 'CPU 12% · RAM 4 GB',
  });
  expect(device.subtitle).toBe('v0.13.41');
  expect(device.details).toContain('CPU 12%');
  expect(
    mapTipData(root, 24, { metrics: 'CPU —% · RAM —' }).details,
  ).toBeUndefined();
});
it('keeps waiting static and identifies a running folded agent separately', () => {
  const waiting = mapTipData(
    nodes([thread({ running: true, needsInput: { kind: 'approval' } })])
      .children[0]!.children[0]!,
  );
  expect(waiting.status).toBe('waiting');
  const parent = mapTipData(
    nodes([thread({ children: [thread({ key: 'child', running: true })] })])
      .children[0]!.children[0]!,
  );
  expect(parent.status).toBe('agents-running');
});
