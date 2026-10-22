/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { ThreadPendingSteerDto, ThreadTurnDto } from '@pockymoe/shared';

import { setLocale } from '../../i18n';
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

const running: ThreadTurnDto = {
  id: 'turn-1',
  startedAt: '2026-10-21T20:00:00Z',
  completedAt: null,
  status: 'inProgress',
  error: null,
  items: [{ id: 'prompt', kind: 'userMessage', text: 'Inspect this repository', status: 'completed', createdAt: '2026-10-21T20:00:00Z' }],
} as ThreadTurnDto;
const steer = { id: 'p1', turnId: 'turn-1', prompt: 'Also check the tests', delivery: 'steer', createdAt: '2026-10-21T20:00:05Z', clientRequestId: 'r1' } as ThreadPendingSteerDto;

it('shows a delivered steer in its turn at once, never as a bubble below the conversation', async () => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<ThreadTimeline turns={[running]} activeTurnId="turn-1" pendingSteers={[steer]} liveOutput="" />));
  const turn = container.querySelector('[data-timeline-turn]')!;
  expect(turn.textContent).toContain('Also check the tests');
  expect(container.querySelector('.thread-graph-message-section')).toBeNull();
  expect(container.textContent?.match(/Also check the tests/g)).toHaveLength(1);
});
