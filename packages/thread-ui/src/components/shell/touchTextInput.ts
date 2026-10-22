/**
 * Typing into the terminal from a touch keyboard. xterm cancels each key it
 * understands, so iOS input methods lose track of the text they work on: pinyin
 * and other candidates, predictions and autocorrect never reached the shell.
 * Here the keyboard writes into xterm's own textarea as into any field, and the
 * shell receives the difference: new text as typed, removed characters as
 * backspaces. A composition is sent once it is committed. Enter, arrows, Tab,
 * Esc, a backspace on an empty field and modified keys stay with xterm.
 */
export function installTouchTextInput(
  host: HTMLElement,
  textarea: HTMLTextAreaElement,
  send: (data: string) => void,
) {
  // What the shell already has of the textarea's text.
  let sent = '';
  let composing = false;
  const ours = (event: Event) => event.target === textarea;
  const sync = () => {
    const value = textarea.value;
    const before = Array.from(sent), after = Array.from(value);
    let common = 0;
    while (common < before.length && common < after.length && before[common] === after[common]) common += 1;
    const data = '\x7f'.repeat(before.length - common) + after.slice(common).join('');
    sent = value;
    if (data) send(data);
    // A long run of typing starts over; the shell has it all.
    if (value.length > 400) { textarea.value = ''; sent = ''; }
  };
  const forget = () => { textarea.value = ''; sent = ''; };
  const keydown = (event: KeyboardEvent) => {
    if (!ours(event)) return;
    // Keys of a composition belong to the input method; its text comes with input.
    if (event.isComposing || event.keyCode === 229) { event.stopImmediatePropagation(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 || (event.key === 'Backspace' && textarea.value.length > 0)) {
      // Let the field take it, as the keyboard expects; input sends it.
      event.stopImmediatePropagation();
      return;
    }
    // Enter, arrows, Tab, Esc: xterm sends them, and the shell's line no longer
    // ends where the field does.
    if (event.key !== 'Shift' && event.key !== 'CapsLock') forget();
  };
  const keypress = (event: KeyboardEvent) => {
    if (ours(event) && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) event.stopImmediatePropagation();
  };
  // Something else emptied the field (xterm on Enter, Ctrl+C or blur): what is
  // there now is what the shell has.
  const beforeinput = (event: Event) => {
    if (ours(event) && !composing && textarea.value !== sent) sent = textarea.value;
  };
  const input = (event: Event) => {
    if (!ours(event)) return;
    event.stopImmediatePropagation();
    if (composing || (event as InputEvent).isComposing) return;
    sync();
  };
  const compositionstart = (event: Event) => {
    if (!ours(event)) return;
    event.stopImmediatePropagation();
    if (!composing && textarea.value !== sent) sent = textarea.value;
    composing = true;
  };
  const compositionupdate = (event: Event) => { if (ours(event)) event.stopImmediatePropagation(); };
  const compositionend = (event: Event) => {
    if (!ours(event)) return;
    event.stopImmediatePropagation();
    composing = false;
    // WebKit updates the field after compositionend.
    window.setTimeout(() => { if (!composing) sync(); }, 0);
  };
  const listeners: Array<[string, (event: never) => void]> = [
    ['keydown', keydown], ['keypress', keypress], ['beforeinput', beforeinput], ['input', input],
    ['compositionstart', compositionstart], ['compositionupdate', compositionupdate], ['compositionend', compositionend],
  ];
  // On the host, capturing: ahead of xterm's own listeners on the textarea.
  for (const [type, listener] of listeners) host.addEventListener(type, listener as EventListener, true);
  return {
    /** The shell's line changed without the field (a key from the key bar). */
    forget,
    dispose: () => {
      for (const [type, listener] of listeners) host.removeEventListener(type, listener as EventListener, true);
    },
  };
}
