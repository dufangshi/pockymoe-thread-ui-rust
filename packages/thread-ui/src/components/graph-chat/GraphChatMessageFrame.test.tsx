// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { GraphChatMessageFrame } from './GraphChatMessageFrame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { act(() => cleanup?.()); cleanup = undefined; });

function pointer(target: Element, type: string, pointerType: string) {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => { target.dispatchEvent(event); });
}

it('only touch/pen taps latch actions; mouse clicks and keyboard activation never do', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { root.unmount(); container.remove(); };
  act(() => root.render(<GraphChatMessageFrame kind="agentMessage" copyButton={<button>Copy</button>}><p>Message</p></GraphChatMessageFrame>));
  const bubble = container.querySelector('.thread-graph-message-bubble')!;
  const content = container.querySelector('p')!;
  const button = container.querySelector('button')!;

  pointer(content, 'pointerup', 'mouse');
  act(() => { content.click(); });
  expect(bubble.getAttribute('data-touch-actions')).toBe('false');
  act(() => { button.focus(); button.click(); });
  expect(bubble.getAttribute('data-touch-actions')).toBe('false');

  pointer(content, 'pointerup', 'touch');
  expect(bubble.getAttribute('data-touch-actions')).toBe('true');
  pointer(button, 'pointerup', 'touch');
  act(() => { button.click(); });
  expect(bubble.getAttribute('data-touch-actions')).toBe('true');
  pointer(content, 'pointerup', 'touch');
  expect(bubble.getAttribute('data-touch-actions')).toBe('false');
  pointer(content, 'pointerup', 'pen');
  expect(bubble.getAttribute('data-touch-actions')).toBe('true');
  // A hybrid device switches back to a mouse without leaving touch residue.
  pointer(bubble, 'pointerover', 'mouse');
  pointer(bubble, 'pointerout', 'mouse');
  expect(bubble.getAttribute('data-touch-actions')).toBe('false');
});
