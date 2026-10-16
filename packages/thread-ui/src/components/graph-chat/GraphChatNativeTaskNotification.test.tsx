/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { GraphChatGenericHistoryItem } from './GraphChatHistoryItems';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { act(() => cleanup?.()); cleanup = undefined; });

async function renderNotice(taskStatus: string, status = 'interrupted') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanup = () => { root.unmount(); container.remove(); };
  await act(async () => root.render(<GraphChatGenericHistoryItem
    item={{id:'notice',kind:'other',origin:'nativeTaskNotification',taskStatus,status,
      text:'Rerun desktop E2E after edit-step fix',createdAt:'2026-10-10T18:35:11.482Z'}}
    timeMeta={<span>23s</span>}
  />));
  return container;
}

it('uses the task result rather than its interrupted parent and lazily expands details', async () => {
  const container = await renderNotice('completed');
  expect(container.textContent).toContain('Awakened');
  expect(container.textContent).not.toContain('Noted');
  expect(container.querySelector('.thread-graph-task-notice-detail')).toBeNull();
  expect(container.querySelector('pre')).toBeNull();
  const toggle = container.querySelector('button')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('.thread-graph-task-notice-detail')?.textContent).toContain('Rerun desktop E2E after edit-step fix');
  expect(container.querySelector('time')?.dateTime).toBe('2026-10-10T18:35:11.482Z');
  await act(async () => toggle.click());
  expect(container.querySelector('.thread-graph-task-notice-detail')).toBeNull();
});

it.each([
  ['failed', 'Background task failed'],
  ['cancelled', 'Background task stopped'],
  ['running', 'Awakened'],
])('keeps %s task results explicit', async (status, label) => {
  const container = await renderNotice(status, 'completed');
  expect(container.textContent).toContain(label);
  expect(container.querySelector('.is-failed') !== null).toBe(status === 'failed');
});

it('replaces waiting with the wake cause using the same timeline anchor', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanup = () => { root.unmount(); container.remove(); };
  const item = {id:'wait',kind:'other' as const,text:'',origin:'nativeBackgroundWait',status:'waiting'};
  await act(async () => root.render(<GraphChatGenericHistoryItem item={item} />));
  expect(container.textContent).toContain('Waiting for wake');
  expect(container.querySelectorAll('.thread-graph-task-notice')).toHaveLength(1);
  const toggle=container.querySelector('button')!;
  await act(async () => toggle.click());
  expect(container.textContent).toContain('Updates will continue here');
  await act(async () => root.render(<GraphChatGenericHistoryItem item={{...item,origin:'nativeTaskNotification',status:'completed',taskStatus:'completed',text:'Release finished',detailText:'All checks passed',createdAt:'2026-10-10T18:30:00Z',awakenedAt:'2026-10-10T18:31:00Z'}} />));
  expect(container.querySelector('button')).toBe(toggle);
  expect(container.textContent).toContain('Awakened');
  expect(container.textContent).toContain('All checks passed');
  expect(container.querySelector('time')?.dateTime).toBe('2026-10-10T18:31:00Z');
  expect(container.textContent).not.toContain('Waiting for wake');
  expect(container.querySelectorAll('.thread-graph-task-notice')).toHaveLength(1);
});

it.each([['final', true], ['commentary', false], [undefined, false]] as const)('keeps notices top-level in the expanded chronological log and exposes only confirmed final replies when folded (%s)', async (responsePhase, hasFinalReply) => {
  const { ThreadTimeline } = await import('../ThreadTimeline');
  const container=document.createElement('div');
  document.body.appendChild(container);
  const root=createRoot(container);
  cleanup=()=>{root.unmount();container.remove();};
  await act(async()=>root.render(<ThreadTimeline autoCollapseCompletedTurns liveOutput="" turns={[{
    id:'turn',status:'completed',error:null,startedAt:'2026-10-10T18:30:00Z',completedAt:'2026-10-10T18:31:00Z',items:[
      {id:'prompt',kind:'userMessage',text:'Check after the build'},
      {id:'foreground',kind:'agentMessage',text:'Waiting for the build'},
      {id:'previous-wake',kind:'other',text:'Earlier task finished',origin:'nativeTaskNotification',taskStatus:'completed'},
      {id:'progress',kind:'agentMessage',text:'Checking intermediate results'},
      {id:'wait',kind:'other',text:'Build finished',origin:'nativeTaskNotification',taskStatus:'completed'},
      {id:'command',kind:'commandExecution',text:'verify command',status:'completed'},
      {id:'final',kind:'agentMessage',text:'Verified report', ...(responsePhase ? { responsePhase } : {})},
    ],
  }]} />));
  expect(container.textContent).not.toContain('Waiting for the build');
  expect(container.textContent).not.toContain('Checking intermediate results');
  expect(container.querySelectorAll('.thread-graph-task-notice')).toHaveLength(0);
  expect(container.textContent).not.toContain('Awakened');
  expect(container.textContent?.includes('Verified report')).toBe(hasFinalReply);
  expect(container.textContent).not.toContain('verify command');
  expect(container.querySelectorAll('[data-role="user"]')).toHaveLength(1);
  expect(container.querySelectorAll('.thread-graph-worked-summary')).toHaveLength(1);
  const toggle = container.querySelector<HTMLButtonElement>('.thread-graph-worked-summary button')!;
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Waiting for the build');
    expect(container.textContent).toContain('Checking intermediate results');
    expect(container.textContent).toContain('Verified report');
    expect(container.querySelectorAll('.thread-graph-task-notice')).toHaveLength(2);
    expect(container.querySelectorAll('.tlog-single')).toHaveLength(1);
    expect(container.querySelector('.tlog-single')?.textContent).toContain('verify command');
    expect(container.querySelector('.thread-graph-history-group')).toBeNull();
    const notices = [...container.querySelectorAll('.thread-graph-task-notice')];
    expect(notices[0]!.compareDocumentPosition(notices[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => toggle.click());
    expect(container.textContent).not.toContain('Waiting for the build');
    expect(container.textContent).not.toContain('Checking intermediate results');
    expect(container.textContent).not.toContain('verify command');
    expect(container.textContent?.includes('Verified report')).toBe(hasFinalReply);
    expect(container.querySelectorAll('.thread-graph-task-notice')).toHaveLength(0);
  }
});
