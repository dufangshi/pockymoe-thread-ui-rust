/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { GraphChatLivePlanCard } from './GraphChatTurnBody';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it('renders a compact live checklist with progress and normalized step statuses', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<GraphChatLivePlanCard livePlan={{ turnId: 'turn', explanation: 'Verify the change', plan: [
      { step: 'Inspect', status: 'done' }, { step: 'Implement', status: 'running' },
      { step: 'Test', status: 'todo' }, { step: 'Publish', status: 'error' },
    ] }} />));
    expect(container.querySelector('.tlog-plan-head')?.textContent).toBe('Plan1/4');
    expect(container.querySelector('.tlog-plan-note')?.textContent).toBe('Verify the change');
    expect([...container.querySelectorAll('.tlog-plan-step')].map(node => node.getAttribute('data-status'))).toEqual(['completed', 'in_progress', 'pending', 'failed']);
    expect([...container.querySelectorAll('.thread-graph-plan-step-text')].map(node => node.textContent)).toEqual(['Inspect', 'Implement', 'Test', 'Publish']);
    expect(container.querySelector('button')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});
