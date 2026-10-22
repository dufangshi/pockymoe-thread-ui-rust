/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { installTouchTextInput } from './touchTextInput';

let host: HTMLDivElement;
let textarea: HTMLTextAreaElement;
let sent: string[];
let xterm: ReturnType<typeof vi.fn>;
let input: ReturnType<typeof installTouchTextInput>;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  textarea = document.createElement('textarea');
  host.append(textarea);
  document.body.append(host);
  sent = [];
  // xterm's own listeners sit on the textarea and must not see what is handled.
  xterm = vi.fn();
  for (const type of ['keydown', 'keypress', 'input', 'compositionstart', 'compositionend']) textarea.addEventListener(type, xterm, true);
  input = installTouchTextInput(host, textarea, (data) => sent.push(data));
});
afterEach(() => { input.dispose(); host.remove(); vi.useRealTimers(); });

// The keyboard changes the field, as a browser does, with the events around it.
const type = (value: string, init: InputEventInit = {}) => {
  textarea.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, ...init }));
  textarea.value = value;
  textarea.dispatchEvent(new InputEvent('input', { bubbles: true, ...init }));
};
const key = (keyName: string, keyCode = 0) =>
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, keyCode, bubbles: true, cancelable: true }));

it('sends typed text and backspaces as the field changes', () => {
  key('l'); type('l', { inputType: 'insertText', data: 'l' });
  key('s'); type('ls', { inputType: 'insertText', data: 's' });
  key('Backspace'); type('l', { inputType: 'deleteContentBackward' });
  expect(sent).toEqual(['l', 's', '\x7f']);
  expect(xterm).not.toHaveBeenCalled();
});

it('sends a pinyin composition once a candidate is chosen', () => {
  textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  key('Unidentified', 229); type('n', { isComposing: true });
  key('Unidentified', 229); type('ni', { isComposing: true });
  textarea.value = '你';
  textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你' }));
  expect(sent).toEqual([]);
  vi.runAllTimers();
  expect(sent).toEqual(['你']);
  expect(xterm).not.toHaveBeenCalled();
});

it('turns a prediction that replaces a word into backspaces and the new word', () => {
  type('hel', { inputType: 'insertText' });
  type('hello ', { inputType: 'insertReplacementText' });
  type('help ', { inputType: 'insertReplacementText' });
  expect(sent).toEqual(['hel', 'lo ', '\x7f\x7f\x7fp ']);
});

it('leaves Enter and arrows to xterm and starts the field over', () => {
  type('pwd', { inputType: 'insertText' });
  key('Enter');
  expect(xterm).toHaveBeenCalledTimes(1);
  // xterm empties the field on Enter; the next word is sent whole.
  textarea.value = '';
  type('l', { inputType: 'insertText' });
  expect(sent).toEqual(['pwd', 'l']);
  // A key from the key bar moves the line away from the field.
  input.forget();
  type('x', { inputType: 'insertText' });
  expect(sent.at(-1)).toBe('x');
});
