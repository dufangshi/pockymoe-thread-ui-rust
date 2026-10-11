/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreadHistoryItemDetailDto, ThreadTurnDto } from '@pockymoe/shared';

import { ThreadTimeline } from '../ThreadTimeline';

vi.mock('../../app-shell/AppShellNavContext', () => ({ useAppShellNav: () => ({ showReasoningSummaries: true }) }));

// Compact Supervisor responses (`compact=1`) omit detailText for every tool
// kind, previewText when it equals text, and sourceTurnId equal to the turn.
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root?.render(node));
  return container;
}

afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.innerHTML = '';
});

function turn(items: ThreadTurnDto['items']): ThreadTurnDto {
  return {
    id: 'turn-1',
    startedAt: '2026-07-03T20:10:00Z',
    completedAt: '2026-07-03T20:11:00Z',
    status: 'completed',
    error: null,
    items: [
      { id: 'user', kind: 'userMessage', text: 'Look things up' },
      ...items,
      { id: 'reply', kind: 'agentMessage', text: 'Done.' },
    ],
  };
}


function button(element: ParentNode, label: string) {
  const found = Array.from(element.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (!found) throw new Error(`missing button ${label}`);
  return found;
}

function expandActivity(element: HTMLElement) {
  // Batches nest (activity > commands); open each level as it appears.
  for (let pass = 0; pass < 4; pass += 1) {
    const toggles = Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'))
      .filter((toggle) => toggle.closest('.thread-graph-history-group'));
    if (!toggles.length) return;
    for (const toggle of toggles) flushSync(() => toggle.click());
  }
}

describe('compact history items', () => {
  it('loads deferred detail for grouped web searches and single tool calls', async () => {
    const pending: Array<(detail: ThreadHistoryItemDetailDto) => void> = [];
    const loader = vi.fn((itemId: string) => new Promise<ThreadHistoryItemDetailDto>((resolve) => {
      pending.push(resolve);
      void itemId;
    }));
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        adapter={{ onLoadHistoryItemDetail: loader }}
        turns={[turn([
          { id: 'search-1', kind: 'webSearch', text: 'rust gzip', status: 'completed', hasDeferredDetail: true },
          { id: 'search-2', kind: 'webSearch', text: 'axum compression', status: 'completed', hasDeferredDetail: true },
        ])]}
      />,
    );
    expandActivity(element);
    expect(element.textContent).toContain('rust gzip');
    flushSync(() => button(element, 'Open grouped web search 1').click());
    expect(loader).toHaveBeenCalledWith('search-1');
    expect(document.body.textContent).toContain('Loading full web search details');
    pending[0]!({ id: 'search-1', kind: 'webSearch', title: 'rust gzip', text: 'Result: flate2 docs' });
    await vi.waitFor(() => expect(document.body.textContent).toContain('Result: flate2 docs'));
  });

  it('opens a deferred tool call through the item-detail loader', async () => {
    const loader = vi.fn(async (itemId: string): Promise<ThreadHistoryItemDetailDto> => ({ id: itemId, kind: 'toolCall', title: 'mcp lookup', text: 'Tool output body' }));
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        adapter={{ onLoadHistoryItemDetail: loader }}
        turns={[turn([{ id: 'tool-1', kind: 'toolCall', text: 'mcp lookup', status: 'completed', hasDeferredDetail: true }])]}
      />,
    );
    expandActivity(element);
    flushSync(() => button(element, 'Open full tool call').click());
    expect(loader).toHaveBeenCalledWith('tool-1');
    await vi.waitFor(() => expect(document.body.textContent).toContain('Tool output body'));
  });

  it('falls back to text when previewText and sourceTurnId are omitted', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[turn([
          { id: 'cmd-1', kind: 'commandExecution', text: 'cargo test -p runtime', status: 'completed', hasDeferredDetail: true },
          { id: 'cmd-2', kind: 'commandExecution', text: 'cargo fmt', status: 'completed', hasDeferredDetail: true },
          { id: 'read-1', kind: 'fileRead', text: 'crates/runtime/src/history.rs', status: 'completed', hasDeferredDetail: true },
          { id: 'search-1', kind: 'webSearch', text: 'gzip DecompressionStream', status: 'completed', hasDeferredDetail: true },
        ])]}
      />,
    );
    expandActivity(element);
    expect(element.textContent).toContain('cargo test -p runtime');
    expect(element.textContent).toContain('cargo fmt');
    expect(element.textContent).toContain('crates/runtime/src/history.rs');
    expect(element.textContent).toContain('gzip DecompressionStream');
  });
});
