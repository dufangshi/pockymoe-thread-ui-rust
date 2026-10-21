/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { GraphChatCompactMessageItem } from './GraphChatCompactMessageItem';
import { TurnPromptContext } from './turnPrompts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;
afterEach(() => { act(() => cleanup?.()); cleanup = null; });

function mount(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanup = () => { root.unmount(); container.remove(); };
  act(() => root.render(node));
  return container;
}

const reply = (id: string) => ({ id, kind: 'agentMessage' as const, text: 'Done.' });
const turn = { firstPromptId: 'p', error: null, turnId: 'turn-2', forkReplyId: 'last' };
const fork = () => document.querySelector<HTMLButtonElement>('button[aria-label="Fork from this turn"]');

it('offers fork beside copy on a finished turn\'s last reply, and forks after confirming', async () => {
  const onForkTurn = vi.fn().mockResolvedValue(undefined);
  mount(<TurnPromptContext.Provider value={turn}>
    <GraphChatCompactMessageItem item={reply('earlier')} scrollRootRef={{ current: null }} adapter={{ onForkTurn }} />
    <GraphChatCompactMessageItem item={reply('last')} scrollRootRef={{ current: null }} adapter={{ onForkTurn }} />
  </TurnPromptContext.Provider>);
  const buttons = document.querySelectorAll('button[aria-label="Fork from this turn"]');
  expect(buttons).toHaveLength(1);
  // It shares the copy control's look and its place in the reply's action layer.
  expect(fork()!.className).toContain('thread-graph-message-copy');
  expect(fork()!.nextElementSibling?.getAttribute('aria-label')).toMatch(/^Copy /);

  await act(async () => { fork()!.click(); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute('aria-label')).toBe('Fork from this turn?');
  const cancel = [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Cancel')!;
  await act(async () => { cancel.click(); });
  expect(onForkTurn).not.toHaveBeenCalled();

  await act(async () => { fork()!.click(); });
  const confirm = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Fork')!;
  expect(confirm.className).toContain('ui-action-primary');
  await act(async () => { (confirm as HTMLButtonElement).click(); });
  expect(onForkTurn).toHaveBeenCalledWith('turn-2');
});

it('keeps a failed fork on the button with its reason, and hides fork where the harness cannot', async () => {
  const onForkTurn = vi.fn().mockRejectedValue(new Error('This backend supports latest-session fork only.'));
  mount(<TurnPromptContext.Provider value={turn}>
    <GraphChatCompactMessageItem item={reply('last')} scrollRootRef={{ current: null }} adapter={{ onForkTurn }} />
  </TurnPromptContext.Provider>);
  await act(async () => { fork()!.click(); });
  const confirm = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Fork')!;
  await act(async () => { (confirm as HTMLButtonElement).click(); });
  expect(fork()!.dataset.state).toBe('failed');
  expect(fork()!.textContent).toContain('latest-session fork only');
  act(() => cleanup?.()); cleanup = null;

  mount(<TurnPromptContext.Provider value={turn}>
    <GraphChatCompactMessageItem item={reply('last')} scrollRootRef={{ current: null }} adapter={{}} />
  </TurnPromptContext.Provider>);
  expect(fork()).toBeNull();
});
