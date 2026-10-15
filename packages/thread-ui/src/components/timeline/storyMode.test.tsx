/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreadHistoryItemDto, ThreadTurnDto } from '@pockymoe/shared';

import { ThreadTimeline } from '../ThreadTimeline';

vi.mock('../graph-chat/graphChatShiki', () => ({ getGraphChatHighlighter: async () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

const message = (id: string, kind: 'userMessage' | 'agentMessage', text: string, extra: Partial<ThreadHistoryItemDto> = {}): ThreadHistoryItemDto =>
  ({ id, kind, text, status: 'completed', createdAt: '2026-10-10T10:00:00Z', ...extra });
const command = (id: string, text: string, status = 'completed'): ThreadHistoryItemDto =>
  ({ id, kind: 'commandExecution', text, status, createdAt: '2026-10-10T10:00:00Z' });

/** A folded summary with narration (`narration=1`) and two stretches of work. */
const summary: ThreadTurnDto = {
  id: 'turn-1',
  startedAt: '2026-10-10T10:00:00Z',
  completedAt: '2026-10-10T10:05:00Z',
  status: 'completed',
  error: null,
  hasDeferredItems: true,
  deferredItemCount: 3,
  activity: {
    commands: 3, failed: 1,
    segments: [
      { before: 'say', commands: 1, startedAt: '2026-10-10T10:00:01Z', endedAt: '2026-10-10T10:00:21Z' },
      { before: 'final', commands: 2, failed: 1 },
    ],
  },
  items: [
    message('prompt', 'userMessage', 'Fix the queue'),
    message('say', 'agentMessage', 'Reading the queue first.'),
    message('final', 'agentMessage', 'The queue is fixed.', { responsePhase: 'final' }),
  ],
};

const detail: ThreadTurnDto = {
  ...summary,
  hasDeferredItems: false,
  deferredItemCount: 0,
  activity: null,
  items: [
    summary.items[0]!,
    command('rg', 'rg PromptQueue src'),
    summary.items[1]!,
    command('test', 'node --test', 'failed'),
    command('fix', 'node --test again'),
    summary.items[2]!,
  ],
};

async function render(turn: ThreadTurnDto, onLoadTurnDetail: () => Promise<ThreadTurnDto>, autoCollapse = false) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(
    <ThreadTimeline turns={[turn]} liveOutput="" autoCollapseCompletedTurns={autoCollapse} onLoadTurnDetail={onLoadTurnDetail} />,
  ));
}

const text = (selector: string) => [...container.querySelectorAll(selector)].map((node) => node.textContent?.replace(/\s*·\s*/g, ' · ').trim());

describe('story mode', () => {
  it('shows narration between folded runs without loading the turn', async () => {
    const load = vi.fn(async () => detail);
    await render(summary, load);
    const timeline = container.querySelector('.thread-execution-timeline.is-story')!;
    expect(timeline).not.toBeNull();
    const order = [...timeline.querySelectorAll('[data-message-id], .tlog-run[data-placeholder]')].map((node) =>
      node.getAttribute('data-message-id') ?? `run:${node.textContent?.replace(/\s*·\s*/g, ' · ').trim()}`);
    expect(container.querySelector('[data-message-id="final"]')).not.toBeNull();
    expect(timeline.compareDocumentPosition(container.querySelector('[data-message-id="final"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order).toEqual(['run:1 command · 20s', 'say', 'run:2 commands · 1 failed']);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the turn when a run opens and opens that run in place', async () => {
    const load = vi.fn(async () => detail);
    await render(summary, load);
    const runs = container.querySelectorAll<HTMLButtonElement>('.tlog-run[data-placeholder] .tlog-run-head');
    await act(async () => runs[1]!.click());
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.tlog-run[data-placeholder]')).toBeNull();
    const open = container.querySelectorAll('.tlog-run[data-open]');
    expect(open).toHaveLength(1);
    expect(text('.tlog-run[data-open] .tlog-title')).toEqual(['node --test', 'node --test again']);
    // The first stretch is a lone command: one line, no run around it.
    expect(text('.tlog-single .tlog-title')).toEqual(['rg PromptQueue src']);
  });

  it('folds and reopens the narration from the work line without loading', async () => {
    const load = vi.fn(async () => detail);
    await render(summary, load);
    const toggle = () => container.querySelector<HTMLButtonElement>('.thread-graph-worked-summary > button.group')!;
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await act(async () => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-message-id="say"]')).toBeNull();
    await act(async () => toggle().click());
    expect(container.querySelector('[data-message-id="say"]')).not.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps a turn folded when auto-collapse is on or the narration is missing', async () => {
    const load = vi.fn(async () => detail);
    await render(summary, load, true);
    expect(container.querySelector('.is-story')).toBeNull();
    await act(async () => root!.unmount());
    container.remove();
    await render({ ...summary, items: [summary.items[0]!, summary.items[2]!] }, load);
    expect(container.querySelector('.is-story')).toBeNull();
    expect(container.querySelector('.thread-graph-worked-summary > button.group')?.getAttribute('aria-expanded')).toBe('false');
    expect(load).not.toHaveBeenCalled();
  });

  it('uses the loaded log rather than narration placeholders when auto-collapse is on and the reader expands', async () => {
    const load = vi.fn(async () => detail);
    await render(summary, load, true);
    await act(async () => container.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.is-story, .tlog-run[data-placeholder]')).toBeNull();
    expect(text('.tlog-single .tlog-title')).toEqual(['rg PromptQueue src']);
    expect(container.querySelector('[data-message-id="say"]')).not.toBeNull();
  });
});
