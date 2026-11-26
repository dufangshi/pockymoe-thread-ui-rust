/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelOptionDto } from '@pockymoe/shared';

import { ComposerModelPicker, type ComposerModelPickerProps } from './ComposerModelPicker';
import type { ComposerModelSwitching, HandoffSummary } from './modelPickerLogic';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const option = (model: string, displayName: string, extra: Partial<ModelOptionDto> = {}): ModelOptionDto => ({
  id: model, model, displayName, description: '', isDefault: false, hidden: false,
  supportedReasoningEfforts: [], defaultReasoningEffort: null, ...extra,
});
const codexModels = [
  option('gpt-6.1-sol', '6.1 Sol', {
    isDefault: true,
    supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }, { reasoningEffort: 'high', description: '' }],
    defaultReasoningEffort: 'low',
  }),
  option('gpt-5.6-luna', '5.6 Luna', { defaultReasoningEffort: 'medium' }),
];
const claudeModels = [
  option('opus', 'Opus 5.5', {
    isDefault: true,
    defaultReasoningEffort: 'high',
    supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }, { reasoningEffort: 'medium', description: '' }, { reasoningEffort: 'high', description: '' }],
  }),
  option('haiku', 'Haiku 5.5'),
];
const summary: HandoffSummary = { turns: 3, estimatedTokens: 1200, resumesSession: false, text: '[Pockymoe portable history]\nTurn 1' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function switching(overrides: Partial<ComposerModelSwitching> = {}): ComposerModelSwitching {
  return {
    currentAgentId: 'codex',
    agents: [{ id: 'claude', name: 'Claude Agent' }, { id: 'codex', name: 'Codex' }],
    loadModels: vi.fn(async (agentId: string) => (agentId === 'claude' ? claudeModels : codexModels)),
    preview: vi.fn(async () => summary),
    switchTo: vi.fn(async () => {}),
    ...overrides,
  };
}

async function render(props: Partial<ComposerModelPickerProps> = {}) {
  container = document.createElement('div');
  container.className = 'thread-ui-shell';
  container.innerHTML = '<div class="composer-model-control"><button data-composer-menu-trigger="true">model</button></div>';
  document.body.appendChild(container);
  const host = container.querySelector('.composer-model-control')!;
  const holder = document.createElement('div');
  host.appendChild(holder);
  root = createRoot(holder);
  const all: ComposerModelPickerProps = {
    model: 'gpt-6.1-sol',
    modelOptions: codexModels,
    reasoningEffort: 'low',
    supportedEfforts: codexModels[0]!.supportedReasoningEfforts,
    running: false,
    liveModelSwitch: false,
    modelDisabled: false,
    effortDisabled: false,
    onUpdateSettings: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  await act(async () => { root?.render(<ComposerModelPicker {...all} />); });
  return all;
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.model-picker-row')];
const rowNames = () => rows().map((row) => row.querySelector('.model-picker-row-name')?.textContent);
const tab = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.model-picker-agent-tab')].find((button) => button.title === name)!;
const click = (element: Element) => act(async () => { (element as HTMLElement).click(); });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ComposerModelPicker', () => {
  it('without switching shows only the current models, with no rail', async () => {
    await render();
    expect(document.querySelector('.model-picker-rail')).toBeNull();
    expect(rowNames()).toEqual(['6.1 Sol', '5.6 Luna']);
    expect(rows()[0]!.getAttribute('aria-checked')).toBe('true');
    // Effort is one row of chips, the current level chosen.
    expect([...document.querySelectorAll('.model-picker-effort-chip')].map((chip) => [chip.textContent, chip.getAttribute('aria-checked')]))
      .toEqual([['low', 'true'], ['high', 'false']]);
  });

  it('lists ACP Codex next to native Codex with its mark tagged and switches by agent key', async () => {
    const source = switching({ agents: [{ id: 'codex', name: 'Codex' }, { id: 'acp:codex', name: 'ACP · Codex' }] });
    await render({ source: { switching: source } });
    const acp = tab('ACP · Codex');
    expect(acp.querySelector('.thread-map-agent')?.getAttribute('data-agent')).toBe('codex');
    expect(acp.querySelector('.model-picker-agent-protocol')?.textContent).toBe('ACP');
    expect(tab('Codex').querySelector('.model-picker-agent-protocol')).toBeNull();
    await click(acp);
    await settle();
    expect(source.loadModels).toHaveBeenCalledWith('acp:codex');
    expect(document.querySelector('.model-picker-head-name')?.textContent).toBe('ACP · Codex');
  });

  it('applies a model of the same agent with its default effort', async () => {
    const props = await render({ source: { switching: switching() } });
    await click(rows()[1]!);
    expect(props.onUpdateSettings).toHaveBeenCalledWith({ model: 'gpt-5.6-luna', reasoningEffort: 'medium' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows labelled facts from the host', async () => {
    await render({ source: { facts: (model) => (model.model === 'gpt-6.1-sol' ? { contextWindow: 1_050_000, inputUsdPerMillion: 2, outputUsdPerMillion: 10 } : null) } });
    const head = document.querySelector('.model-picker-head')!;
    expect(head.textContent).toContain('Context');
    expect(head.textContent).toContain('$/1M in · out');
    expect(rows()[0]!.textContent).toContain('1M');
    expect(rows()[0]!.textContent).toContain('$2 · $10');
    expect(rows()[0]!.getAttribute('aria-label')).toBe('6.1 Sol, 1M context, $2 in, $10 out per million tokens');
  });

  it('lists agents with the current one first and switches an idle thread on a pick', async () => {
    const source = switching();
    const props = await render({ source: { switching: source } });
    expect([...document.querySelectorAll('.model-picker-agent-tab')].map((button) => button.getAttribute('title'))).toEqual(['Codex', 'Claude Agent']);
    expect(tab('Codex').getAttribute('aria-pressed')).toBe('true');
    await click(tab('Claude Agent'));
    await settle();
    expect(source.loadModels).toHaveBeenCalledWith('claude');
    expect(rowNames()).toEqual(['Opus 5.5', 'Haiku 5.5']);
    expect(source.preview).toHaveBeenCalledWith({ agentId: 'claude', model: 'opus' });
    const note = document.querySelector('.model-picker-note')!.textContent;
    expect(note).toContain('Hands over 3 turns');
    expect(note).toContain('Resets plan, sandbox, fast mode and effort');
    // The target model's levels, its default chosen.
    expect(document.querySelector('.model-picker-effort-chip[aria-checked="true"]')!.textContent).toBe('high');
    expect(rows()[1]!.getAttribute('aria-label')).toBe('Switch to Claude Agent · Haiku 5.5');
    await click(rows()[1]!);
    await settle();
    expect(source.switchTo).toHaveBeenCalledWith({ agentId: 'claude', model: 'haiku', reasoningEffort: null, stop: false });
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onUpdateSettings).not.toHaveBeenCalled();
  });

  it('offers Stop and switch while a turn runs', async () => {
    const source = switching();
    const props = await render({ running: true, source: { switching: source } });
    await click(tab('Claude Agent'));
    await settle();
    expect(document.querySelector('.model-picker-note')!.textContent).toContain('Stops the running turn first');
    await click(rows()[0]!);
    expect(source.switchTo).not.toHaveBeenCalled();
    expect(rows()[0]!.getAttribute('aria-checked')).toBe('true');
    const stop = document.querySelector<HTMLButtonElement>('.model-picker-stop')!;
    expect(stop.textContent).toContain('Stop and switch');
    expect(stop.textContent).toContain('Claude Agent · Opus 5.5');
    await click(stop);
    await settle();
    expect(source.switchTo).toHaveBeenCalledWith({ agentId: 'claude', model: 'opus', reasoningEffort: 'high', stop: true });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('keeps the picker open with the reason when a switch fails', async () => {
    const source = switching({ switchTo: vi.fn(async () => { throw new Error('clear the active goal first'); }) });
    const props = await render({ source: { switching: source } });
    await click(tab('Claude Agent'));
    await settle();
    await click(rows()[0]!);
    await settle();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.model-picker-note-error')!.textContent).toContain('Did not switch');
    expect(document.querySelector('.model-picker-note-error .error-mark, .model-picker-note-error [aria-label]')).not.toBeNull();
  });

  it('says resuming a saved session and opens the history preview in place', async () => {
    const source = switching({ preview: vi.fn(async () => ({ ...summary, turns: 1, resumesSession: true })) });
    await render({ source: { switching: source } });
    await click(tab('Claude Agent'));
    await settle();
    expect(document.querySelector('.model-picker-note')!.textContent).toContain('Resumes its session · 1 new turn');
    await click(document.querySelector('.model-picker-link')!);
    expect(document.querySelector('.model-picker-preview')!.textContent).toBe(summary.text);
    expect(document.querySelector('.model-picker-preview-head')!.textContent).toContain('History for Claude Agent');
    expect(document.querySelector('.model-picker-row')).toBeNull();
    await click(document.querySelector('.model-picker-back')!);
    expect(rowNames()).toEqual(['Opus 5.5', 'Haiku 5.5']);
  });

  it('retries models that did not load', async () => {
    let fail = true;
    const source = switching({ loadModels: vi.fn(async () => { if (fail) throw new Error('offline'); return claudeModels; }) });
    await render({ source: { switching: source } });
    await click(tab('Claude Agent'));
    await settle();
    expect(document.querySelector('.model-picker-status')!.textContent).toContain('Models did not load');
    fail = false;
    await click(document.querySelector('.error-mark-button, .model-picker-status button')!);
    const retry = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Retry'));
    if (retry) await click(retry);
    await settle();
    expect(rowNames()).toEqual(['Opus 5.5', 'Haiku 5.5']);
  });

  it('searches every agent, grouped by agent', async () => {
    const source = switching();
    await render({ source: { switching: source } });
    const search = document.querySelector<HTMLInputElement>('.model-picker-search')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(search, '5.5');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
    const groups = [...document.querySelectorAll('.model-picker-group')];
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['Claude Agent']);
    expect(rowNames()).toEqual(['Opus 5.5', 'Haiku 5.5']);
  });

  it('moves between agents with ←/→ from a row', async () => {
    const pending = deferred<ModelOptionDto[]>();
    const source = switching({ loadModels: vi.fn(() => pending.promise) });
    await render({ source: { switching: source } });
    await act(async () => {
      rows()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(tab('Claude Agent').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.model-picker-status')!.textContent).toBe('Loading models…');
    await act(async () => { pending.resolve(claudeModels); });
    await settle();
    expect(rowNames()).toEqual(['Opus 5.5', 'Haiku 5.5']);
    await act(async () => {
      rows()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(tab('Codex').getAttribute('aria-pressed')).toBe('true');
  });

  it('opens harness settings from the icon beside the search', async () => {
    const onOpenHarness = vi.fn();
    const props = await render({ onOpenHarness });
    const settings = document.querySelector<HTMLButtonElement>('.model-picker-bar .model-picker-settings')!;
    expect(settings.getAttribute('aria-label')).toBe('Harness settings');
    await click(settings);
    expect(props.onClose).toHaveBeenCalled();
    expect(onOpenHarness).toHaveBeenCalled();
  });

  it('says when nothing new would be handed over', async () => {
    const resumed = switching({ preview: vi.fn(async () => ({ ...summary, turns: 0, resumesSession: true })) });
    await render({ source: { switching: resumed } });
    await click(tab('Claude Agent'));
    await settle();
    expect(document.querySelector('.model-picker-note-line')!.textContent).toBe('Resumes its session · nothing new to hand over');
    expect(document.querySelector('.model-picker-link')).toBeNull();
  });

  it('says a new thread has no history to hand over', async () => {
    const fresh = switching({ preview: vi.fn(async () => ({ ...summary, turns: 0, estimatedTokens: 40 })) });
    await render({ source: { switching: fresh } });
    await click(tab('Claude Agent'));
    await settle();
    expect(document.querySelector('.model-picker-note-line')!.textContent).toBe('No history to hand over yet');
  });

  it('shows Stop and switch for a pick from search results while a turn runs', async () => {
    const source = switching();
    await render({ running: true, source: { switching: source } });
    const search = document.querySelector<HTMLInputElement>('.model-picker-search')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'haiku');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
    await click(rows()[0]!);
    await settle();
    expect(search.value).toBe('');
    expect(tab('Claude Agent').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.model-picker-stop')!.textContent).toContain('Claude Agent · Haiku 5.5');
    expect(source.switchTo).not.toHaveBeenCalled();
  });

  it('applies the effort chosen for another agent with the switch', async () => {
    const source = switching();
    await render({ source: { switching: source } });
    await click(tab('Claude Agent'));
    await settle();
    await click([...document.querySelectorAll('.model-picker-effort-chip')].find((chip) => chip.textContent === 'low')!);
    expect(document.querySelector('.model-picker-effort-chip[aria-checked="true"]')!.textContent).toBe('low');
    await click(rows()[0]!);
    await settle();
    expect(source.switchTo).toHaveBeenCalledWith({ agentId: 'claude', model: 'opus', reasoningEffort: 'low', stop: false });
  });

  it('changes the current effort with the arrow keys on its chips', async () => {
    const props = await render();
    const chip = document.querySelector<HTMLButtonElement>('.model-picker-effort-chip[aria-checked="true"]')!;
    await act(async () => { chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(props.onUpdateSettings).toHaveBeenCalledWith({ reasoningEffort: 'high' });
  });

  it('keeps the column header out of the scrolling list', async () => {
    await render({ source: { facts: () => ({ contextWindow: 200_000 }) } });
    const head = document.querySelector('.model-picker-head')!;
    expect(head.closest('.model-picker-list')).toBeNull();
    expect(head.textContent).toContain('Context');
  });

  it('shows the Git state in a preview as a summary, and copies the exact text', async () => {
    const git = JSON.stringify({ ahead: 2, behind: 0, branch: 'master', conflicted: [], files: [{ path: 'a.txt' }, { path: 'src/b.rs' }], head: 'abc', operation: null, stashCount: 0, truncated: false, upstream: 'origin/master' });
    const text = `[Pockymoe portable history]\nCurrent Git state:\n${git}\nTurn 1`;
    await render({ source: { switching: switching({ preview: vi.fn(async () => ({ ...summary, text })) }) } });
    await click(tab('Claude Agent'));
    await settle();
    await click(document.querySelector('.model-picker-link')!);
    const shown = document.querySelector('.model-picker-preview')!.textContent!;
    expect(shown).toContain('Branch master → origin/master · ahead 2 · behind 0');
    expect(shown).toContain('2 changed files: a.txt, src/b.rs');
    expect(shown).not.toContain('"files"');
    expect(shown).toContain('Turn 1');
  });
});
