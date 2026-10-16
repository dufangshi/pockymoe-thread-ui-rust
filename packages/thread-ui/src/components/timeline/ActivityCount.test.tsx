/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n';
import { ActivityCount } from './ActivityCount';

let root: Root;
let shell: HTMLDivElement;
let count: HTMLElement;
function pointer(type: string, pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => count.dispatchEvent(event));
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('ActivityCount hints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    shell = document.createElement('div');
    shell.className = 'thread-ui-shell';
    document.body.append(shell);
    const host = document.createElement('div');
    shell.append(host);
    root = createRoot(host);
    act(() => root.render(<ActivityCount part={{ key: 'commands', count: 2, text: '2 commands' }} />));
    count = host.querySelector('.tlog-count')!;
  });
  afterEach(() => {
    act(() => root.unmount());
    shell.remove();
    vi.useRealTimers();
  });

  it('waits a full second and portals the phrase, explanation and example into the shell', () => {
    expect(count.getAttribute('role')).toBe('img');
    expect(count.getAttribute('aria-label')).toBe('2 commands');
    expect(count.getAttribute('data-kind')).toBe('commands');
    pointer('pointerover');
    advance(999);
    expect(shell.querySelector('[role=tooltip]')).toBeNull();
    advance(1);
    const hint = shell.querySelector('[role=tooltip]')!;
    expect(hint.parentElement).toBe(shell);
    expect(hint.querySelector('.tlog-hint-title')?.textContent).toBe('2 commands');
    expect(hint.querySelector('.tlog-hint-body')?.textContent).toBe(translate('chat.hint.commands'));
    expect(hint.querySelector('.tlog-hint-example')?.textContent).toBe(translate('chat.hint.commandsExample'));
  });

  it.each(['leave', 'pointerdown', 'scroll', 'resize'])('closes on %s and can open again', (event) => {
    pointer('pointerover');
    advance(1000);
    expect(shell.querySelector('[role=tooltip]')).not.toBeNull();
    if (event === 'leave') pointer('pointerout');
    else if (event === 'pointerdown') pointer('pointerdown');
    else act(() => (event === 'scroll' ? shell : window).dispatchEvent(new Event(event)));
    expect(shell.querySelector('[role=tooltip]')).toBeNull();
    pointer('pointerout');
    pointer('pointerover');
    advance(1000);
    expect(shell.querySelector('[role=tooltip]')).not.toBeNull();
  });

  it('cancels a pending hint when the pointer leaves before the delay', () => {
    pointer('pointerover');
    advance(999);
    pointer('pointerout');
    advance(1000);
    expect(shell.querySelector('[role=tooltip]')).toBeNull();
  });

  it('never opens for a touch pointer', () => {
    pointer('pointerover', 'touch');
    advance(3000);
    expect(shell.querySelector('[role=tooltip]')).toBeNull();
  });
});
