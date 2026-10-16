import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Terminal } from 'xterm';
import { translate, useI18n } from '../../i18n';

/** The terminal's lines as text, wrapped rows joined, and the line at the top
    of the viewport. */
function bufferText(terminal: Terminal) {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  let topLine = 0;
  for (let row = 0; row < buffer.length; row += 1) {
    const line = buffer.getLine(row);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
    if (row === buffer.viewportY) topLine = lines.length - 1;
  }
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return { lines, topLine: Math.min(topLine, lines.length - 1) };
}

/** Touch screens cannot drag-select inside xterm. This shows its lines as plain
    text over the terminal, where the phone's own long-press selection, handles
    and copy menu work; Copy, Select all and Done sit above it. */
export function TerminalSelection({ terminal, host, point, onCopy, onClose }: {
  terminal: Terminal;
  /** xterm's element: its row height and text offset place every line where
      xterm drew it, so a long press selects the word that was under it. */
  host: HTMLElement | null;
  /** Where a long press opened it: the word there starts selected. */
  point?: { x: number; y: number } | undefined;
  onCopy: (text: string) => void;
  onClose: () => void;
}) {
  useI18n();
  const { lines, topLine } = useMemo(() => bufferText(terminal), [terminal]);
  const metrics = useMemo(() => {
    const frame = host?.getBoundingClientRect();
    const row = host?.querySelector('.xterm-rows > div')?.getBoundingClientRect();
    if (!frame || !row || !row.height) return null;
    return { rowHeight: row.height, top: Math.max(0, row.top - frame.top), left: Math.max(0, row.left - frame.left) };
  }, [host]);
  const body = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState('');

  useLayoutEffect(() => {
    const node = body.current;
    const top = node?.children[topLine] as HTMLElement | undefined;
    if (node && top) node.scrollTop = top.offsetTop - (metrics?.top ?? 0);
    if (!point || !node) return;
    // Start from the word under the finger, as a native long press would.
    const range = document.caretRangeFromPoint?.(point.x, point.y);
    if (!range || !node.contains(range.startContainer)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    selection?.modify?.('move', 'backward', 'word');
    selection?.modify?.('extend', 'forward', 'word');
  }, [metrics, point, topLine]);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      const inside = selection && selection.rangeCount > 0 && body.current?.contains(selection.anchorNode);
      setSelected(inside ? selection.toString() : '');
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  const selectAll = () => {
    if (!body.current) return;
    const range = document.createRange();
    range.selectNodeContents(body.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  return (
    <div className="terminal-selection" role="dialog" aria-label={translate('files.terminalSelectText')}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <div className="terminal-selection-bar">
        <span>{translate('files.terminalSelectHint')}</span>
        <button type="button" onPointerDown={event => event.preventDefault()} onClick={selectAll}>{translate('files.terminalSelectAll')}</button>
        <button type="button" disabled={!selected} onPointerDown={event => event.preventDefault()}
          onClick={() => { onCopy(selected); window.getSelection()?.removeAllRanges(); onClose(); }}>{translate('files.terminalCopy')}</button>
        <button type="button" className="is-primary" onClick={onClose}>{translate('files.terminalSelectDone')}</button>
      </div>
      <div ref={body} className="terminal-selection-text"
        style={metrics ? { lineHeight: `${metrics.rowHeight}px`, paddingTop: metrics.top, paddingLeft: metrics.left } : undefined}>
        {lines.map((line, index) => <div key={index}>{line || ' '}</div>)}
      </div>
    </div>
  );
}
