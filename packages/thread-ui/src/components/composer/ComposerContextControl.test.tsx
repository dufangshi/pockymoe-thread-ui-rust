/**
 * @vitest-environment jsdom
 */
import type { ContextInspectionSnapshotDto, ThreadContextInspectionDto, ThreadContextUsageDto } from '@pockymoe/shared';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerContextControl, type ThreadContextInspector } from './ComposerContextControl';
import { preferredSnapshot, totalMovedOn, contextCategoryItems } from './contextInspectionModel';

const claudeSummary: ContextInspectionSnapshotDto = {
  provider: 'claude',
  model: 'claude-opus',
  source: 'claudeSummary',
  precision: 'estimated',
  usedTokens: 30_000,
  windowTokens: 100_000,
  updatedAt: new Date().toISOString(),
  categories: [
    { id: 'messages', label: 'Messages', kind: 'used', tokens: 20_000 },
    { id: 'memory_files', label: 'Memory files', kind: 'used', tokens: 10_000 },
    { id: 'autocompact_buffer', label: 'Autocompact buffer', kind: 'buffer', tokens: 5_000 },
    { id: 'free_space', label: 'Free space', kind: 'free', tokens: 65_000 },
    { id: 'mcp_tools_deferred', label: 'MCP tools (deferred)', kind: 'deferred', tokens: 40_000 },
  ],
  groups: [
    { id: 'mcp_tools', items: [{ name: 'mcp__docs__read', tokens: 300, source: 'docs', loaded: false }] },
    { id: 'memory_files', items: [{ name: '/repo/CLAUDE.md', path: '/repo/CLAUDE.md', tokens: 10_000 }] },
  ],
};

const available = (snapshot: ContextInspectionSnapshotDto | null): ThreadContextInspectionDto =>
  ({ enabled: true, supported: true, availability: 'available', snapshot });

const usage: ThreadContextUsageDto = {
  availability: 'available', remainingPercent: 75, tokensInContextWindow: 25_000, modelContextWindow: 100_000, updatedAt: null,
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(props: {
  inspector?: ThreadContextInspector | null;
  contextUsage?: ThreadContextUsageDto | null;
  onCompact?: () => Promise<void> | void;
  compactDisabled?: boolean;
  agent?: string;
}) {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <ComposerContextControl open={open} contextUsage={'contextUsage' in props ? props.contextUsage : usage} inspector={props.inspector}
        agent={props.agent} onCompact={props.onCompact} compactDisabled={props.compactDisabled} onToggle={() => setOpen((value) => !value)} onClose={() => setOpen(false)} />
    );
  }
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Harness />); });
}

const meter = () => document.querySelector<HTMLButtonElement>('[data-testid="composer-context-meter"]')!;
const openPanel = async () => { await act(async () => { meter().click(); }); };
const row = (id: string) => document.querySelector<HTMLElement>(`[data-context-category="${id}"]`);
const note = () => document.querySelector<HTMLElement>('[data-context-note]');
const button = (name: string) => [...document.querySelectorAll('button')].find((entry) => entry.textContent?.includes(name));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLElement.prototype.showPopover ??= function showPopover() {};
  HTMLElement.prototype.hidePopover ??= function hidePopover() {};
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe('ComposerContextControl', () => {
  it('keeps DSH occupancy separate from heuristic composition including a negative difference', async () => {
    const dsh: ContextInspectionSnapshotDto = {
      provider: 'deepseek', source: 'dshProjection', precision: 'estimated',
      usedTokens: 8000, windowTokens: 100000, compositionTokens: 10000, attributionDeltaTokens: -2000,
      updatedAt: new Date().toISOString(),
      categories: [
        { id: 'tools', kind: 'used', tokens: 4000 },
        { id: 'messages', kind: 'used', tokens: 6000 },
        { id: 'free_space', kind: 'free', tokens: 92000 },
      ],
      groups: [{ id: 'tools', items: [{ name: 'mcp__docs__read', tokens: 4001 }] }],
    };
    const load = vi.fn().mockResolvedValue(available(dsh));
    await render({ inspector: { load }, agent: 'deepseek', contextUsage: { ...usage, tokensInContextWindow: 8000, details: dsh } });
    await openPanel();
    expect(load).toHaveBeenCalledWith({ detail: 'summary' });
    expect(document.querySelector('.thread-context-percent')?.textContent).toBe('8%');
    const occupancy = document.querySelectorAll<HTMLElement>('.thread-context-summary > .thread-context-bar .thread-context-segment');
    expect(occupancy).toHaveLength(1);
    expect(occupancy[0]!.style.width).toBe('8%');
    expect(row('tools')?.querySelector('.thread-context-share')?.textContent).toBe('40%');
    expect(row('free_space')?.querySelector('.thread-context-share')?.textContent).toBe('92%');
    expect(document.querySelector('[data-context-composition]')?.textContent).toContain('−2k');
    expect(document.querySelector('.thread-context-meta')?.textContent).toContain('DSH next-prompt estimate');
    await act(async () => { row('tools')!.querySelector('button')!.click(); });
    expect(row('tools')?.textContent).toContain('mcp__docs__read');
  });

  it('refreshes Codex on open and labels categories bounded by the native total', async () => {
    const codex: ContextInspectionSnapshotDto = {
      provider: 'codex', source: 'codexTrace', precision: 'estimated', categoriesClamped: true,
      usedTokens: 20_000, windowTokens: 100_000, updatedAt: new Date().toISOString(),
      categories: [
        { id: 'system_prompt', kind: 'used', tokens: 1_000 },
        { id: 'messages', kind: 'used', tokens: 19_000 },
        { id: 'free_space', kind: 'free', tokens: 80_000 },
      ],
    };
    const load = vi.fn().mockResolvedValue(available(codex));
    await render({ inspector: { load }, agent: 'codex', contextUsage: { ...usage, tokensInContextWindow: 20_000, details: codex } });
    await openPanel();
    expect(load).toHaveBeenCalledWith({ detail: 'summary', refresh: true });
    expect(document.querySelector('.thread-context-meta')?.textContent).toContain('bounded by Codex total');
  });
  it('shows the total on a closed key without asking anything', async () => {
    const load = vi.fn();
    await render({ inspector: { load } });
    expect(meter().textContent).toBe('');
    expect(meter().getAttribute('aria-label')).toContain('25%');
    expect(meter().getAttribute('aria-expanded')).toBe('false');
    expect(meter().hasAttribute('title')).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('uses one proportional fill for a small occupancy even with many categories', async () => {
    await render({ contextUsage: { ...usage, tokensInContextWindow: 32898, modelContextWindow: 1_000_000, details: { ...claudeSummary, usedTokens: 32898, windowTokens: 1_000_000 } } });
    const fills = meter().querySelectorAll<HTMLElement>('.thread-context-segment');
    expect(fills).toHaveLength(1);
    expect(parseFloat(fills[0]!.style.width)).toBeCloseTo(3.2898, 4);
    expect(fills[0]!.dataset.slot).toBe('-1');
  });

  it('keeps deferred categories outside the window, with no share, and lists their tools there', async () => {
    const load = vi.fn().mockResolvedValue(available(claudeSummary));
    await render({ inspector: { load } });
    await openPanel();
    expect(load).toHaveBeenCalledWith({ detail: 'summary' });

    expect(row('messages')?.querySelector('.thread-context-share')?.textContent).toBe('20%');
    const deferred = row('mcp_tools_deferred')!;
    expect(deferred.closest('.thread-context-outside')).not.toBeNull();
    expect(deferred.querySelector('.thread-context-share')).toBeNull();
    // 30%, not 70%: forty thousand deferred tokens are not in the window.
    expect(document.querySelector('.thread-context-percent')?.textContent).toBe('30%');

    const toggle = deferred.querySelector('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(deferred.textContent).not.toContain('mcp__docs__read');
    await act(async () => { toggle.click(); });
    expect(deferred.textContent).toContain('mcp__docs__read');
    // A category with no native list does not pretend to have one.
    expect(row('messages')?.querySelector('button')).toBeNull();
  });

  it('loads Claude full details when opening without offering a counting button', async () => {
    const full: ContextInspectionSnapshotDto = { ...claudeSummary, source: 'claudeFull', precision: 'reported' };
    const load = vi.fn().mockResolvedValue(available(full));
    await render({ inspector: { load }, agent: 'claude' });
    await openPanel();
    expect(load).toHaveBeenLastCalledWith({ detail: 'full', refresh: true });
    expect(document.querySelector('.thread-context-meta')?.textContent).toContain('Claude full count');
    expect(button('Full count')).toBeUndefined();
    expect(button('Refresh')).toBeUndefined();
  });

  it('keeps the total and invents no categories in each state without an analysis', async () => {
    const openSettings = vi.fn();
    const disabled = vi.fn().mockResolvedValue({ enabled: false, supported: true, availability: 'disabled', snapshot: null });
    await render({ inspector: { load: disabled, openSettings }, contextUsage: { ...usage, details: claudeSummary } });
    await openPanel();
    // Turned off: an analysis that arrived earlier is no longer shown.
    expect(note()?.dataset.contextNote).toBe('disabled');
    expect(document.querySelector('.thread-context-percent')?.textContent).toBe('25%');
    expect(row('messages')).toBeNull();
    await act(async () => { button('Open settings')!.click(); });
    expect(openSettings).toHaveBeenCalled();
    act(() => root?.unmount());
    host?.remove();

    await render({ inspector: { load: vi.fn().mockResolvedValue(available(null)) } });
    await openPanel();
    expect(note()?.dataset.contextNote).toBe('waiting');
    expect(document.querySelector('.thread-context-amount')?.textContent).toContain('25k');
    expect(document.querySelector('.thread-context-rows')).toBeNull();
    act(() => root?.unmount());
    host?.remove();

    await render({ inspector: { load: vi.fn().mockResolvedValue({ enabled: true, supported: false, availability: 'unavailable', snapshot: null, reason: 'DSH reports totals only' }) } });
    await openPanel();
    expect(note()?.dataset.contextNote).toBe('unsupported');
    expect(button('Refresh')).toBeUndefined();
    act(() => root?.unmount());
    host?.remove();

    await render({ inspector: null, contextUsage: null });
    expect(meter().getAttribute('data-empty')).toBe('true');
    await openPanel();
    expect(document.querySelector('.thread-context-amount')?.textContent).toBe('No usage reported yet');
  });

  it('says a read failed, offers a retry and keeps the last result', async () => {
    const load = vi.fn().mockRejectedValue(new Error('harness busy'));
    await render({ inspector: { load }, contextUsage: { ...usage, details: claudeSummary } });
    await openPanel();
    expect(note()?.dataset.contextNote).toBe('failed');
    expect(row('messages')).not.toBeNull();
    expect(note()?.querySelector('.error-mark')).not.toBeNull();
  });

  it('compacts through the host and closes with Escape, returning focus to the key', async () => {
    const onCompact = vi.fn();
    await render({ inspector: null, onCompact });
    meter().focus();
    await openPanel();
    await act(async () => { button('Compact context')!.click(); });
    expect(onCompact).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(meter());
  });

  it('shows compact disabled without a harness action and blocks duplicate requests while pending', async () => {
    await render({ inspector: null });
    await openPanel();
    expect(button('Compact context')?.disabled).toBe(true);
    act(() => root?.unmount()); host?.remove();
    let resolve!: () => void;
    const onCompact = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    await render({ inspector: null, onCompact });
    await openPanel();
    const compact = button('Compact context')!;
    await act(async () => { compact.click(); compact.click(); });
    expect(onCompact).toHaveBeenCalledTimes(1);
    expect(compact.disabled).toBe(true);
    await act(async () => resolve());
    expect(compact.disabled).toBe(false);
  });
});

describe('contextInspectionModel', () => {
  it('keeps a full count over a summary of the same context, but not over a later one', () => {
    const full = { ...claudeSummary, source: 'claudeFull' as const, updatedAt: '2026-11-01T00:00:00Z' };
    const summary = { ...claudeSummary, updatedAt: '2026-11-01T00:01:00Z' };
    expect(preferredSnapshot(full, summary)).toBe(full);
    const later = { ...summary, usedTokens: 31_000 };
    expect(preferredSnapshot(full, later)).toBe(later);
  });

  it('notices a total that moved on from the categories only past rounding', () => {
    const analysis = { used: 30_000, window: 100_000, updatedAt: '2026-11-01T00:00:00Z' };
    expect(totalMovedOn(analysis, { ...analysis, used: 30_500, updatedAt: '2026-11-01T00:01:00Z' })).toBe(false);
    expect(totalMovedOn(analysis, { ...analysis, used: 12_000, updatedAt: '2026-11-01T00:01:00Z' })).toBe(true);
    expect(totalMovedOn(analysis, { ...analysis, used: 12_000, updatedAt: '2026-10-31T00:00:00Z' })).toBe(false);
  });

  it('splits a tool group along loaded and deferred, and leaves unclaimed groups aside', () => {
    const { items, rest } = contextCategoryItems({
      ...claudeSummary,
      groups: [
        { id: 'mcp_tools', items: [{ name: 'a', tokens: 1, loaded: false }, { name: 'b', tokens: 2, loaded: true }] },
      ],
    });
    expect(items.get('mcp_tools_deferred')?.map((item) => item.name)).toEqual(['a']);
    expect(rest.map((group) => group.id)).toEqual(['mcp_tools']);
    expect(rest[0]?.items.map((item) => item.name)).toEqual(['b']);
  });
});
