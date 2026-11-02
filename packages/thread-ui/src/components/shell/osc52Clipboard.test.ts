/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Terminal } from 'xterm';
import { copyText } from './terminalClipboard';
import { decodeOsc52, installOsc52Clipboard, MAX_OSC52_BYTES } from './osc52Clipboard';
import { renderShellSnapshot, writeShellReplay } from './shellTerminal';
vi.mock('./terminalClipboard', () => ({ copyText: vi.fn() }));
const encoded = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('OSC 52 decoding', () => {
  it.each(['', 'c', 'p'])('decodes UTF-8 for target %s', target => {
    expect(decodeOsc52(`${target};${encoded('中文😀')}`)).toBe('中文😀');
  });
  it.each(['c;?', 'c;', ';', 's;aGk=', 'c;%%%%', 'c;Zg===', 'c;Zh==', 'c;a', 'c;/w==', 'missing separator'])('ignores %s', data => {
    expect(decodeOsc52(data)).toBeNull();
  });
  it('caps decoded bytes, not characters', () => {
    expect(decodeOsc52(`c;${btoa('x'.repeat(MAX_OSC52_BYTES))}`)).toHaveLength(MAX_OSC52_BYTES);
    expect(decodeOsc52(`c;${btoa('x'.repeat(MAX_OSC52_BYTES + 1))}`)).toBeNull();
  });
});

describe('OSC 52 clipboard lifecycle', () => {
  let handler: (data: string) => boolean | Promise<boolean>;
  let enabled: boolean;
  let interactive: boolean;
  let connection: string | null;
  let terminal: Terminal;
  let host: HTMLElement;
  let callbacks: Array<() => void>;
  let controller: ReturnType<typeof installOsc52Clipboard>;
  const feedback = vi.fn();
  const disposeHandler = vi.fn();
  beforeEach(() => {
    vi.mocked(copyText).mockReset().mockResolvedValue(true);
    feedback.mockClear(); disposeHandler.mockClear();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    enabled = true; interactive = true; connection = 'viewer-1'; callbacks = [];
    host = document.createElement('div'); document.body.append(host);
    terminal = {
      parser: { registerOscHandler: vi.fn((code, callback) => { expect(code).toBe(52); handler = callback; return { dispose: disposeHandler }; }) },
      write: vi.fn((_data, callback) => { if (callback) callbacks.push(callback); }), reset: vi.fn(), scrollToBottom: vi.fn(),
    } as unknown as Terminal;
    controller = installOsc52Clipboard(terminal, host, { enabled: () => enabled, interactive: () => interactive, connection: () => connection, feedback });
  });
  afterEach(() => { controller.dispose(); host.remove(); vi.restoreAllMocks(); });
  it('writes and reports success without answering queries', async () => {
    expect(handler(`c;${encoded('hello')}`)).toBe(true);
    await settle();
    expect(copyText).toHaveBeenCalledExactlyOnceWith('hello');
    expect(feedback).toHaveBeenCalledExactlyOnceWith(true);
    handler('c;?'); handler('c;'); await settle();
    expect(copyText).toHaveBeenCalledTimes(1);
  });
  it('retries only the latest failed write within a terminal gesture', async () => {
    vi.mocked(copyText).mockResolvedValue(false);
    handler(`c;${encoded('old')}`); await settle();
    handler(`p;${encoded('latest')}`); await settle();
    expect(feedback).not.toHaveBeenCalled();
    host.dispatchEvent(new Event('pointerdown')); await settle();
    expect(copyText).toHaveBeenLastCalledWith('latest');
    expect(feedback).toHaveBeenLastCalledWith(false);
    vi.mocked(copyText).mockResolvedValue(true);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })); await settle();
    expect(feedback).toHaveBeenLastCalledWith(true);
  });
  it('defers an unfocused write and ignores late results for an older payload', async () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    handler(`c;${encoded('unfocused')}`); await settle();
    expect(copyText).not.toHaveBeenCalled();
    vi.mocked(document.hasFocus).mockReturnValue(true);
    let resolveOld!: (value: boolean) => void;
    vi.mocked(copyText).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    host.dispatchEvent(new Event('pointerdown'));
    handler(`c;${encoded('new')}`); await settle();
    resolveOld(false); await settle();
    expect(feedback.mock.calls).toEqual([[true]]);
    host.dispatchEvent(new Event('pointerdown')); await settle();
    expect(copyText).toHaveBeenCalledTimes(2);
  });
  it('ignores replay and snapshot parsing, then accepts live output', async () => {
    writeShellReplay(terminal, 'recorded'); handler(`c;${encoded('old replay')}`);
    callbacks.shift()!();
    renderShellSnapshot(terminal, 'snapshot'); handler(`c;${encoded('old snapshot')}`);
    expect(copyText).not.toHaveBeenCalled();
    callbacks.shift()!(); handler(`c;${encoded('live')}`); await settle();
    expect(copyText).toHaveBeenCalledExactlyOnceWith('live');
  });
  it('requires an enabled attached interactive terminal and drops pending work on detach', async () => {
    enabled = false; handler(`c;${encoded('off')}`);
    enabled = true; interactive = false; handler(`c;${encoded('read only')}`);
    interactive = true; connection = null; handler(`c;${encoded('detached')}`);
    expect(copyText).not.toHaveBeenCalled();
    connection = 'viewer-1'; vi.mocked(copyText).mockResolvedValue(false);
    handler(`c;${encoded('pending')}`); await settle();
    connection = 'viewer-2'; host.dispatchEvent(new Event('pointerdown')); await settle();
    expect(copyText).toHaveBeenCalledTimes(1);
    controller.clear(); controller.dispose();
    host.dispatchEvent(new Event('pointerdown')); await settle();
    expect(copyText).toHaveBeenCalledTimes(1);
    expect(disposeHandler).toHaveBeenCalled();
  });
});
