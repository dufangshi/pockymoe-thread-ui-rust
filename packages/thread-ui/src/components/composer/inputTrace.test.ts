// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { attachInputTrace, clearInputTrace, inputTraceCount, inputTraceEnabled, inputTraceReport, traceInput } from './inputTrace';

let editor: HTMLDivElement;
beforeEach(() => {
  editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.textContent = 'secret words';
  document.body.append(editor);
  clearInputTrace();
});
afterEach(() => { editor.remove(); sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

it('records nothing unless the page asked for it', () => {
  expect(inputTraceEnabled()).toBe(false);
  const detach = attachInputTrace(editor);
  editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'x' }));
  traceInput(editor, 'sync-replace', 'state=3');
  expect(inputTraceCount()).toBe(0);
  detach();
});

it('records what the keyboard did by position and length, never the text, and stays on for the session', () => {
  window.history.replaceState(null, '', '/threads/t?inputtrace=1');
  expect(inputTraceEnabled()).toBe(true);
  window.history.replaceState(null, '', '/threads/other');
  expect(inputTraceEnabled()).toBe(true);
  const detach = attachInputTrace(editor);
  editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward' }));
  editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'tidied text' }));
  editor.dispatchEvent(new CompositionEvent('compositionend', { data: 'four' }));
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  traceInput(editor, 'sync-replace', 'state=3:focused=true');
  const report = inputTraceReport();
  expect(report).toContain('beforeinput deleteContentBackward:0');
  expect(report).toContain('input insertText:11');
  expect(report).toContain('compositionend 4');
  expect(report).toContain('keydown Backspace');
  expect(report).toContain('sync-replace state=3:focused=true 12');
  expect(report).not.toMatch(/secret|tidied|four|keydown a/);
  expect(inputTraceCount()).toBe(5);
  detach();
  window.history.replaceState(null, '', '/threads/t?inputtrace=0');
  expect(inputTraceEnabled()).toBe(false);
});
