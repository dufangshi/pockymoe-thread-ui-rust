import { measureSelectionOffset, serializeEditorPrompt } from './contentEditablePrompt';

/**
 * A recording of what a keyboard does to the prompt, for input problems that
 * only happen on one phone with one keyboard (voice keyboards rewriting what
 * they wrote, for example). It is off unless the page was opened with
 * `?inputtrace=1` (kept for the browser session), and it records positions and
 * lengths only, never the text.
 */
const FLAG = 'pockymoe-input-trace';
const LIMIT = 600;

export type InputTraceEntry = [ms: number, event: string, detail: string, textLength: number, caret: string, nodes: number];

let entries: InputTraceEntry[] = [];
let started = 0;
const listeners = new Set<() => void>();

export function inputTraceEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (/[?&]inputtrace=1(?:&|$)/.test(window.location.search)) sessionStorage.setItem(FLAG, '1');
    else if (/[?&]inputtrace=0(?:&|$)/.test(window.location.search)) sessionStorage.removeItem(FLAG);
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function caretOf(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 'none';
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return 'outside';
  const start = measureSelectionOffset(editor, range.startContainer, range.startOffset);
  const end = range.collapsed ? start : measureSelectionOffset(editor, range.endContainer, range.endOffset);
  return start === end ? String(start) : `${start}-${end}`;
}

/** Adds one line to the recording. `detail` must not contain prompt text. */
export function traceInput(editor: HTMLDivElement | null, event: string, detail = '') {
  if (!editor || !inputTraceEnabled()) return;
  const now = performance.now();
  if (!entries.length) started = now;
  const entry: InputTraceEntry = [Math.round(now - started), event, detail, serializeEditorPrompt(editor).length, caretOf(editor), editor.childNodes.length];
  const last = entries.at(-1);
  // A caret that did not move is not news.
  if (event === 'selectionchange' && last && last[1] === event && last[3] === entry[3] && last[4] === entry[4]) return;
  entries.push(entry);
  if (entries.length > LIMIT) entries = entries.slice(-LIMIT);
  listeners.forEach((listener) => listener());
}

export function inputTraceCount() { return entries.length; }
export function subscribeInputTrace(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function clearInputTrace() { entries = []; listeners.forEach((listener) => listener()); }

/** The recording as text to paste into a report: one event per line. */
export function inputTraceReport() {
  const head = `pockymoe input trace · ${navigator.userAgent}\nms event detail textLength caret childNodes`;
  return [head, ...entries.map((entry) => entry.map((value) => (value === '' ? '-' : value)).join(' '))].join('\n');
}

/** Records the editor's own events while tracing is on. */
export function attachInputTrace(editor: HTMLDivElement) {
  if (!inputTraceEnabled()) return () => {};
  const input = (event: Event) => {
    const e = event as InputEvent;
    const ranges = event.type === 'beforeinput' && typeof e.getTargetRanges === 'function'
      ? e.getTargetRanges().map((range) => {
        try {
          return `${measureSelectionOffset(editor, range.startContainer, range.startOffset)}-${measureSelectionOffset(editor, range.endContainer, range.endOffset)}`;
        } catch { return '?'; }
      }).join(',')
      : '';
    traceInput(editor, event.type, `${e.inputType || '?'}:${e.data?.length ?? 0}${e.isComposing ? ':composing' : ''}${ranges ? `:range=${ranges}` : ''}`);
  };
  const composition = (event: Event) => traceInput(editor, event.type, String((event as CompositionEvent).data?.length ?? 0));
  const plain = (event: Event) => traceInput(editor, event.type);
  // Only keys that edit or submit; a printable key would say what was typed.
  const key = (event: Event) => {
    const e = event as KeyboardEvent;
    if (['Backspace', 'Delete', 'Enter', 'Unidentified', 'Process'].includes(e.key)) traceInput(editor, 'keydown', `${e.key}${e.isComposing ? ':composing' : ''}`);
  };
  const selection = () => { if (document.activeElement === editor) traceInput(editor, 'selectionchange'); };
  const handlers: [string, (event: Event) => void][] = [
    ['beforeinput', input], ['input', input], ['compositionstart', composition], ['compositionupdate', composition],
    ['compositionend', composition], ['focus', plain], ['blur', plain], ['keydown', key],
  ];
  for (const [type, handler] of handlers) editor.addEventListener(type, handler, true);
  document.addEventListener('selectionchange', selection);
  return () => {
    for (const [type, handler] of handlers) editor.removeEventListener(type, handler, true);
    document.removeEventListener('selectionchange', selection);
  };
}
