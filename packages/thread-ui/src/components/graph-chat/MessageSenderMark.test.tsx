/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { GraphChatMessageFrame } from './GraphChatMessageFrame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(sender?: { userId: string; name?: string | null }) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<GraphChatMessageFrame kind="userMessage" sender={sender}>hello</GraphChatMessageFrame>));
  return { host, unmount: () => { act(() => root.unmount()); host.remove(); } };
}

describe('MessageSenderMark', () => {
  it('marks a prompt from someone else and names them in a small card', () => {
    const view = render({ userId: 'user-42', name: 'alice' });
    try {
      const mark = view.host.querySelector<HTMLButtonElement>('button.thread-graph-message-sender')!;
      expect(mark.textContent).toBe('A');
      expect(mark.getAttribute('aria-label')).toBe('Sent by alice');
      expect(document.querySelector('.thread-message-sender-card')).toBeNull();
      act(() => mark.click());
      const card = document.querySelector('.thread-message-sender-card')!;
      expect(card.textContent).toContain('alice');
      expect(card.textContent).toContain('Sent with shared access');
      expect(card.querySelector('code')?.textContent).toBe('user-42');
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
      expect(document.querySelector('.thread-message-sender-card')).toBeNull();
      act(() => mark.click());
      act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
      expect(document.querySelector('.thread-message-sender-card')).toBeNull();
    } finally { view.unmount(); }
  });

  it('falls back to the account ID without repeating it', () => {
    const view = render({ userId: 'user-42' });
    try {
      const mark = view.host.querySelector<HTMLButtonElement>('button.thread-graph-message-sender')!;
      expect(mark.textContent).toBe('U');
      act(() => mark.click());
      const card = document.querySelector('.thread-message-sender-card')!;
      expect(card.textContent).toContain('user-42');
      expect(card.querySelector('code')).toBeNull();
    } finally { view.unmount(); }
  });

  it('leaves the owner\'s own prompts unmarked', () => {
    const view = render();
    try {
      expect(view.host.querySelector('.thread-graph-message-sender')).toBeNull();
    } finally { view.unmount(); }
  });
});
