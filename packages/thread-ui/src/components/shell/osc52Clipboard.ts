import type { Terminal } from 'xterm';
import { copyText } from './terminalClipboard';
import { isReplayingShellSnapshot } from './shellTerminal';

export const MAX_OSC52_BYTES = 1024 * 1024;

/** OSC 52 is write-only: never answer queries or expose clipboard contents. */
export function decodeOsc52(data: string): string | null {
  const separator = data.indexOf(';');
  if (separator < 0 || !['', 'c', 'p'].includes(data.slice(0, separator))) return null;
  const payload = data.slice(separator + 1);
  if (!payload || payload === '?' || payload.length > Math.ceil(MAX_OSC52_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return null;
  try {
    const binary = atob(payload);
    if (!binary.length || binary.length > MAX_OSC52_BYTES || btoa(binary).replace(/=+$/, '') !== payload.replace(/=+$/, '')) return null;
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
  } catch { return null; }
}

export function installOsc52Clipboard(terminal: Terminal, host: HTMLElement, options: {
  enabled: () => boolean;
  interactive: () => boolean;
  /** An attach's unique viewer id; pending writes cannot survive a new attach. */
  connection: () => string | null;
  feedback: (copied: boolean) => void;
}) {
  let pending: { text: string; connection: string } | null = null;
  let generation = 0;
  let disposed = false;
  const clear = () => { pending = null; generation += 1; };
  const eligible = () => !disposed && options.enabled() && options.interactive();
  const write = async (text: string, connection: string, retry: boolean) => {
    const version = ++generation;
    pending = { text, connection };
    let copied = false;
    try { copied = document.hasFocus() && await copyText(text); } catch { /* Retry within the next gesture. */ }
    if (disposed || version !== generation) return;
    if (!eligible() || options.connection() !== connection) { clear(); return; }
    if (copied) { pending = null; options.feedback(true); }
    else if (retry) options.feedback(false);
  };
  const handler = terminal.parser.registerOscHandler(52, data => {
    // This check runs when xterm parses the bytes, including asynchronous replay.
    if (!eligible() || isReplayingShellSnapshot(terminal)) return true;
    const connection = options.connection();
    const text = decodeOsc52(data);
    if (connection && text !== null) void write(text, connection, false);
    return true;
  });
  const retry = () => {
    const next = pending;
    if (!next) return;
    if (!eligible() || options.connection() !== next.connection) { clear(); return; }
    if (!isReplayingShellSnapshot(terminal)) void write(next.text, next.connection, true);
  };
  // Capture before terminal handlers cancel keys or change the selection. Start
  // the clipboard request within the gesture so WebKit can grant the write.
  host.addEventListener('pointerdown', retry, true);
  host.addEventListener('keydown', retry, true);
  return {
    clear,
    dispose() {
      disposed = true;
      clear();
      handler.dispose();
      host.removeEventListener('pointerdown', retry, true);
      host.removeEventListener('keydown', retry, true);
    },
  };
}
