/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

import { getVisibleTerminalText, keepTerminalCursorStatic, isReplayingShellSnapshot, renderShellSnapshot, writeShellReplay } from './shellTerminal';

describe('shell terminal helpers', () => {
  it('keeps an application-requested cursor blink static after parsed input and disposes its listener', () => {
    let parsed: (() => void) | undefined;
    const dispose = vi.fn(() => { parsed = undefined; });
    const terminal = { options: { cursorBlink: true, cursorStyle: 'underline' }, onWriteParsed(callback: () => void) { parsed = callback; return { dispose }; } };
    const subscription = keepTerminalCursorStatic(terminal as unknown as Parameters<typeof keepTerminalCursorStatic>[0]);
    expect(terminal.options.cursorBlink).toBe(false);
    terminal.options.cursorBlink = true;
    parsed!();
    expect(terminal.options).toEqual({ cursorBlink: false, cursorStyle: 'underline' });
    subscription.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(parsed).toBeUndefined();
  });

  it('reads visible xterm row text and trims trailing blank rows', () => {
    const host = document.createElement('div');
    host.innerHTML = [
      '<div class="xterm-rows">',
      '<div>first</div>',
      '<div></div>',
      '<div>third</div>',
      '<div></div>',
      '</div>',
    ].join('');

    expect(getVisibleTerminalText(host)).toBe('first\n\nthird');
    expect(getVisibleTerminalText(null)).toBe('');
  });

  it('renders normalized snapshots and positions the cursor', () => {
    const writes: string[] = [];
    const terminal = {
      reset() {
        writes.push('reset');
      },
      write(value: string, callback?: () => void) {
        writes.push(value);
        callback?.();
      },
      scrollToBottom() {
        writes.push('bottom');
      },
    };

    renderShellSnapshot(
      terminal as Parameters<typeof renderShellSnapshot>[0],
      'one\r\ntwo\r\nthree\n',
      2,
      1,
      2,
    );

    expect(writes).toEqual(['reset', 'one\r\ntwo\r\nthree\r\x1b[3G', 'bottom']);
  });

  it('marks a replay or a snapshot as replaying until xterm has written it', () => {
    const pending: Array<() => void> = [];
    const terminal = {
      reset() {},
      write(_value: string, callback?: () => void) { if (callback) pending.push(callback); },
      scrollToBottom() {},
    } as unknown as Parameters<typeof renderShellSnapshot>[0];
    // Queries in recorded output (cursor position, background colour) get
    // answered while it is written; those answers are not keys.
    writeShellReplay(terminal, '\x1b[6n\x1b]11;?\x1b\\');
    renderShellSnapshot(terminal, 'prompt$ ');
    expect(isReplayingShellSnapshot(terminal)).toBe(true);
    pending.shift()!();
    expect(isReplayingShellSnapshot(terminal)).toBe(true);
    pending.shift()!();
    expect(isReplayingShellSnapshot(terminal)).toBe(false);
  });
});
