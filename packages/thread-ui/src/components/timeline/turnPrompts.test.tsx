/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ThreadHistoryItemDto, ThreadTurnDto } from '@pockymoe/shared';

import { setLocale } from '../../i18n';
import { failureMessage } from '../graph-chat/turnPrompts';
import { ThreadTimeline } from '../ThreadTimeline';

vi.mock('../graph-chat/graphChatShiki', () => ({ getGraphChatHighlighter: async () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => setLocale('en'));
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

const reason = 'Failed to refresh OAuth token: another Claude Code process is refreshing it';
const error = `ACP session/prompt failed: {"code":-32603,"data":{"errorKind":"server_error"},"message":"Internal error: ${reason}"}`;
const message = (id: string, kind: 'userMessage' | 'agentMessage', text: string): ThreadHistoryItemDto =>
  ({ id, kind, text, status: 'completed', createdAt: '2026-10-16T20:51:55Z' });
const failed: ThreadTurnDto = {
  id: 'turn-1',
  startedAt: '2026-10-16T20:51:54Z',
  completedAt: '2026-10-16T20:52:02Z',
  status: 'failed',
  error,
  model: '<synthetic>',
  items: [message('prompt', 'userMessage', 'Keep going'), { ...message('echo', 'agentMessage', reason), status: 'failed' }],
};

async function render(turn: ThreadTurnDto) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<ThreadTimeline turns={[turn]} liveOutput="" />));
}

describe('a failed turn', () => {
  it('marks its prompt and opens the error there, without echoing it as a reply', async () => {
    await render(failed);
    expect(container.querySelector('[data-message-id="echo"]')).toBeNull();
    expect(container.textContent).not.toContain('<synthetic>');
    const mark = container.querySelector<HTMLButtonElement>('[data-message-id="prompt"] .thread-graph-message-failure')!;
    expect(mark.getAttribute('aria-label')).toBe('Why this turn failed');
    expect(container.querySelector('.thread-graph-message-failure-detail')).toBeNull();
    await act(async () => mark.click());
    const detail = container.querySelector('[data-message-id="prompt"] .thread-graph-message-failure-detail')!;
    expect(detail.querySelector('p')?.textContent).toBe(reason);
    expect(detail.querySelector('pre')?.textContent).toBe(error);
    await act(async () => mark.click());
    expect(container.querySelector('.thread-graph-message-failure-detail')).toBeNull();
  });

  it('keeps a reply that says more than the error', async () => {
    await render({ ...failed, items: [failed.items[0]!, message('answer', 'agentMessage', 'I changed the queue before the connection dropped.')] });
    expect(container.querySelector('[data-message-id="answer"]')).not.toBeNull();
  });

  it('marks nothing on a turn that finished', async () => {
    await render({ ...failed, status: 'completed', error: null, items: [failed.items[0]!] });
    expect(container.querySelector('.thread-graph-message-failure')).toBeNull();
  });
});

describe('a prompt added while the turn worked', () => {
  it('says so with its own time, and the head counts it', async () => {
    const added = { ...message('steer', 'userMessage', 'Also check the queue'), createdAt: '2026-10-16T20:53:30Z' };
    await render({ ...failed, status: 'completed', error: null, model: 'gpt-6-astra', completedAt: '2026-10-16T20:55:00Z',
      items: [failed.items[0]!, added, message('answer', 'agentMessage', 'Both are fine now.')] });
    expect(container.querySelector('[data-message-id="prompt"] .thread-graph-message-kicker')).toBeNull();
    expect(container.querySelector('[data-message-id="steer"] .thread-graph-message-kicker')?.textContent).toMatch(/^Added · /);
    await act(async () => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
    expect(container.querySelector('.thread-turn-head-detail')?.textContent).toContain('1 message while working');
  });
});

describe('failureMessage', () => {
  it('reads the message out of a JSON-RPC error and leaves plain text alone', () => {
    expect(failureMessage(error)).toBe(reason);
    expect(failureMessage(' Agent unavailable ')).toBe('Agent unavailable');
  });
});
