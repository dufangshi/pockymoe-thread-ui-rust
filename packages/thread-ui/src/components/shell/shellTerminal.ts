import type { Terminal } from 'xterm';

// Terminals redrawing a snapshot. A snapshot is recorded output, so the queries
// in it (cursor position, colours, device attributes) were answered when they
// first ran; xterm answers them again as it redraws, and those answers must not
// reach the shell as typed input ("1R1R…;rgb:0f0f/1313/1717").
const replaying = new WeakMap<Terminal, number>();

/** Whether xterm is redrawing a snapshot: its data events are replies, not keys. */
export function isReplayingShellSnapshot(terminal: Terminal) {
  return (replaying.get(terminal) ?? 0) > 0;
}

/** Writes recorded output (an attach's replay) without answering its queries. */
export function writeShellReplay(terminal: Terminal, data: string) {
  replaying.set(terminal, (replaying.get(terminal) ?? 0) + 1);
  terminal.write(data, () => {
    replaying.set(terminal, Math.max(0, (replaying.get(terminal) ?? 1) - 1));
  });
}

export function renderShellSnapshot(
  terminal: Terminal,
  snapshot: string,
  cursorX?: number,
  cursorY?: number,
  paneHeight?: number,
) {
  const normalizedSnapshot = snapshot.replace(/\r\n/g, '\n');
  const lines = normalizedSnapshot.split('\n');
  if (normalizedSnapshot.endsWith('\n') && lines.at(-1) === '') {
    lines.pop();
  }
  const serializedSnapshot = lines.join('\r\n');
  let frame = serializedSnapshot;

  if (cursorX !== undefined && cursorY !== undefined) {
    const historyOffset =
      paneHeight !== undefined ? Math.max(0, lines.length - paneHeight) : 0;
    const cursorLineIndex = historyOffset + cursorY;
    const linesBelowCursor = Math.max(0, lines.length - cursorLineIndex - 1);

    if (linesBelowCursor > 0) {
      frame += `\x1b[${linesBelowCursor}A`;
    }

    frame += `\r\x1b[${cursorX + 1}G`;
  }

  terminal.reset();
  replaying.set(terminal, (replaying.get(terminal) ?? 0) + 1);
  terminal.write(frame, () => {
    replaying.set(terminal, Math.max(0, (replaying.get(terminal) ?? 1) - 1));
    terminal.scrollToBottom();
  });
}

export function getVisibleTerminalText(hostNode: HTMLDivElement | null) {
  if (!hostNode) {
    return '';
  }

  const rows = Array.from(hostNode.querySelectorAll('.xterm-rows > div'))
    .map((row) => row.textContent ?? '')
    .filter((line, index, items) => line.length > 0 || index < items.length - 1);

  return rows.join('\n').trimEnd();
}
