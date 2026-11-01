/** Standalone map fixture: /map.html?count=600&theme=terminal&mode=dark&scope=all.
 * Theme CSS/assets use the host's /themes endpoint when testing inside Pockymoe.
 * No Supervisor, account data or network polling is involved. */
import { Profiler, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DenseLayout } from '../../../packages/thread-ui/src/components/threadMap/density';
import { ThreadMapDialog } from '../../../packages/thread-ui/src/components/threadMap/ThreadMapDialog';
import { ThreadMap } from '../../../packages/thread-ui/src/components/threadMap/ThreadMap';
import type { MapAttention, MapScope } from '../../../packages/thread-ui/src/components/threadMap/types';
import type { ThreadMapDevice, ThreadMapThread } from '../../../packages/thread-ui/src/components/threadMap/model';
import { I18nProvider, setLocale } from '../../../packages/thread-ui/src/i18n';
import '../../../packages/thread-ui/src/styles.css';
import './map-fixture.css';

const params = new URLSearchParams(location.search);
// The fixture can isolate planning time from React development overhead.
if (params.get('measureLayout') === '1') {
  const layout = DenseLayout.prototype.layout;
  DenseLayout.prototype.layout = function (this: DenseLayout, ...args: Parameters<DenseLayout['layout']>) {
    const start = performance.now();
    try { return layout.apply(this, args); }
    finally { ((window as Window & { mapLayoutTimes?: number[] }).mapLayoutTimes ??= []).push(performance.now() - start); }
  };
}
const realShape = params.get('dataset') === 'real';
const count = realShape ? 117 : Math.max(12, Math.min(1200, Number(params.get('count')) || 12));
const theme = params.get('theme') ?? 'classic';
const mode = params.get('mode') ?? 'light';
const lang = params.get('lang') === 'en' ? 'en' : 'zh-CN';
setLocale(lang, false);
document.documentElement.dataset.themePreset = theme;
document.documentElement.dataset.themeEffective = mode;
const themeReady = theme !== 'classic' ? new Promise<void>(resolve => {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `/themes/${theme}.css`; link.onload = () => resolve(); link.onerror = () => resolve(); document.head.append(link);
}) : Promise.resolve();
const titles = ['整理桌面通知的投递逻辑', '为新工作区添加索引缓存', '修复编辑器中的焦点恢复', '验证 runtime 更新流程', '重构线程活动快照', '调整移动端输入体验', 'Review API error handling', '精简 Playwright 回归用例', '改善地图上的键盘导航', '统一三套主题的状态标识', '处理多设备离线恢复', '完善价格统计与模型分布'];
const prompts = ['请检查这次改动的边界情况，并补充一个最小回归。', '保持已有行为，把这一处的交互做得更清晰。', '恢复时优先使用缓存，然后静默刷新最新结果。', 'Run the focused regressions and review the resulting diff.'];
const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
// Keep the demo's hourly series consistent with its window total.
const fixtureHourly = (i: number, total: number) => {
  const weights = Array.from({ length: 24 }, (_, hour) => (hour + i) % 7 < 2 ? 1 + (hour + i) % 5 : 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map(weight => Math.floor(total * weight / sum));
  const last = weights.findLastIndex(weight => weight > 0);
  if (last >= 0) values[last]! += total - values.reduce((a, b) => a + b, 0);
  return values;
};
const makeThread = (i: number): ThreadMapThread => ({
  key: `mac:${i}`, title: `${titles[i % titles.length]}${i >= 12 ? ` · ${Math.floor(i / 12) + 1}` : ''}`, href: `#thread-${i}`,
  agent: ['codex', 'claude', 'deepseek', 'gemini'][i % 4], modelDisplayName: ['GPT 6.1', 'Claude Opus', 'DeepSeek V4', 'Gemini'][i % 4], model: ['gpt-6.1-sol', 'Opus', 'DeepSeek V4', 'Gemini'][i % 4],
  running: i === 3 || i === 4 || i % 47 === 11, turns: 4 + i * 7 % 180, activeMs: (i * 13 % 260) * 60_000, totalMs: (i + 2) * 73 * 60_000,
  createdAt: ago(24 + i * 19), lastActiveAt: ago(i % 9 === 7 ? 400 : i % 7 === 6 ? 60 : i % 20),
  needsInput: i === 0 ? { kind: 'approval', requestId: 'request-0', summary: '需要允许执行定向回归测试' } : i === 1 ? { kind: 'input', summary: '这里应该采用哪种缓存策略？' } : undefined,
  unread: i === 2 || i === 5, failed: i === 2, lastPrompt: prompts[i % prompts.length],
  hourlyMs: fixtureHourly(i, (i * 13 % 260) * 60_000),
  tokenUsage: { inputTokens: (i + 1) * 24000, cachedInputTokens: i * 10000, outputTokens: (i + 1) * 1200, totalTokens: (i + 1) * 25200, reasoningOutputTokens: 0 },
  priceEstimate: { inputUsd: .012 * (i + 1), cachedInputUsd: .004, outputUsd: .02 * (i + 1), totalUsd: .032 * (i + 1) + .004 },
});
function Fixture() {
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [scope, setScope] = useState<MapScope>((params.get('scope') as MapScope) || 'all');
  const [query, setQuery] = useState('');
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const baseThreads = useMemo(() => Array.from({ length: count }, (_, i) => {
    const thread = makeThread(i);
    return params.get('unreadHistory') === '1' ? { ...thread, unread: i % 3 !== 0, failed: i % 6 === 1, lastActiveAt: ago(400 + i) } : thread;
  }), []);
  const devices = useMemo(() => {
    const threads = [...baseThreads];
    if (revision) threads[3] = { ...threads[3]!, lastPrompt: `最近一次刷新 · ${revision}` };
    if (realShape) {
      let serial = 0;
      const shape = [['wsl', 21, 58], ['ubuntu', 4, 21], ['zzq docker', 2, 5], ['mac', 7, 17], ['LuisMini2', 0, 0], ['Ubuntu Docker', 1, 4], ['Titoliember', 2, 4], ['gm wsl', 1, 7], ['LuisMini1', 1, 1]] as const;
      return [...shape.map(([name, spaces, total], d) => ({ id: `real-${d}`, name, state: 'ready' as const,
        workspaces: Array.from({ length: spaces }, (_, w) => ({ id: `w${w}`, label: ['pockymoe', 'workspace', 'tools', 'research', 'notes'][w % 5] + (w >= 5 ? `-${w}` : ''),
          threads: Array.from({ length: Math.floor(total / spaces) + (w < total % spaces ? 1 : 0) }, () => {
            const i = serial++, thread = makeThread(i);
            return { ...thread, key: `real-${d}:${i}`, running: i === 3 || i === 65, needsInput: i === 0 ? thread.needsInput : undefined,
              unread: i % 3 === 2, failed: i % 6 === 2, activeMs: i < 5 ? thread.activeMs : 0, hourlyMs: i < 5 ? thread.hourlyMs : Array(24).fill(0), lastActiveAt: ago(i < 5 ? i : 100 + i * 23) };
          }) })),
      })), { id: 'offline', name: 'Travel MacBook', state: 'offline' as const, cachedAt: ago(3), workspaces: [] }];
    }
    if (params.get('priorityUpdates') === '1') {
      const last = threads.length - 1;
      threads[last] = { ...threads[last]!, needsInput: revision % 2 ? { kind: 'input' } : undefined };
    }
    const split = Math.ceil(count * .68);
    const workspaces = (list: ThreadMapThread[], offset: number) => {
      const per = Number(params.get('workspaceSize')) || (count <= 12 ? 4 : 48);
      return Array.from({ length: Math.ceil(list.length / per) }, (_, i) => ({ id: `w${offset + i}`, label: ['pockymoe', 'shared-ui', 'desktop-shell', 'design-system', 'notes', 'experiments'][i % 6]!, threads: list.slice(i * per, (i + 1) * per) }));
    };
    return [{ id: 'studio', name: 'Mac Studio', state: 'ready', workspaces: workspaces(threads.slice(0, split), 0) },
      { id: 'server', name: 'Build Server', state: 'ready', workspaces: workspaces(threads.slice(split), 100) },
      { id: 'travel', name: 'Travel MacBook', state: 'offline', cachedAt: ago(3), workspaces: [{ id: 'cache', label: 'sandbox', threads: [makeThread(700), makeThread(701)] }] },
    ] satisfies ThreadMapDevice[];
  }, [revision, baseThreads]);
  const attention: MapAttention[] = [
    { key: 'mac:0', kind: 'approval', title: titles[0]!, device: 'Mac Studio', workspace: 'pockymoe', summary: '允许执行定向回归测试', requestId: 'request-0', since: ago(.2) },
    { key: 'mac:1', kind: 'input', title: titles[1]!, device: 'Mac Studio', workspace: 'pockymoe', summary: '等待你选择缓存策略', since: ago(.4) },
    { key: 'mac:2', kind: 'failed', title: titles[2]!, device: 'Mac Studio', workspace: 'pockymoe', summary: '焦点回归未通过', since: ago(.1) },
    { key: 'mac:5', kind: 'unread', title: titles[5]!, device: 'Mac Studio', workspace: 'shared-ui', summary: '已完成，等待查看', since: ago(.1) },
  ];
  const extraAttention = Math.max(0, (Number(params.get('attentionCount')) || 4) - 4);
  attention.push(...Array.from({ length: extraAttention }, (_, i): MapAttention => ({ key: `mac:${i + 6}`, kind: 'unread', title: titles[(i + 6) % titles.length]!, device: 'Mac Studio', workspace: 'shared-ui', summary: '已完成，等待查看', since: ago(.1) })));
  const menu = (name: string) => ['设备详情', '检查更新', '重命名', '在浏览器中管理'].map((label, i) => ({ id: String(i), label, onSelect: () => setNotice(`${name} · ${label}`) }));
  return <div className="thread-ui-shell map-fixture" data-theme-effective={mode}>
    <div className="map-fixture-toolbar" hidden={params.get('chrome') === '0'}><b>Pockymoe</b><span>线程地图 · {count}</span><nav aria-label="Fixture sizes">{[12, 150, 600].map(n => <a key={n} href={`?${new URLSearchParams({ count: String(n), theme, mode, scope })}`} aria-current={n === count ? 'page' : undefined}>{n}</a>)}</nav>
      <button type="button" onClick={() => setRevision(n => n + 1)}>刷新内容</button><button type="button" onClick={() => setRevealKey(`mac:${count - 1}`)}>显示最新</button>
    </div>
    <Profiler id="map" onRender={(_id, phase, duration) => {
      const readings = (window as Window & { mapRenderTimes?: number[] }).mapRenderTimes ??= [];
      if (phase !== 'mount') readings.push(duration);
    }}>
      {params.get('presentation') === 'dialog' ? <ThreadMapDialog open onOpenChange={() => undefined} effectiveTheme={mode === 'dark' ? 'dark' : 'light'} devices={devices} onOpen={thread => setNotice(`打开 · ${thread.title}`)} /> : <ThreadMap presentation="page" devices={devices} stableLayout scope={scope} onScopeChange={setScope} attention={attention}
        heading={<h1 className="thread-map-title">线程地图</h1>} filterText={query} onFilterChange={setQuery}
        deviceExtras={{ studio: { latencyMs: 8, runtimeVersion: '0.13.41', updateAvailable: true, runningCount: 3, waitingCount: 2, todayCostUsd: 4.27, metrics: 'CPU 12% · 内存 18.2 / 64 GB · GPU 4%', menuItems: menu('Mac Studio') }, server: { latencyMs: 31, runtimeVersion: '0.13.41', runningCount: 1, waitingCount: 0, todayCostUsd: 1.36, metrics: 'CPU 8% · 内存 5.1 / 16 GB', menuItems: menu('Build Server') } }}
        onOpen={thread => setNotice(`打开 · ${thread.title}`)} onQuickLook={key => setNotice(`快速查看 · ${key}`)} revealKey={revealKey}
        onRequestDecision={(key, _id, decision) => setNotice(`${key} · ${decision === 'approve' ? '已批准' : '已拒绝'}`)} />}
    </Profiler>
    {notice && <button type="button" className="map-fixture-notice" onClick={() => setNotice('')}>{notice} ×</button>}
  </div>;
}
void themeReady.then(() => createRoot(document.getElementById('root')!).render(<I18nProvider><Fixture /></I18nProvider>));
