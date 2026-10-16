/** Clipboard access for the terminal. The async API needs a secure page (https
    or localhost); over plain http, copying falls back to a hidden textarea and
    reading is not possible, so callers offer a paste field instead. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Denied or no user activation: try the fallback. */ }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  Object.assign(field.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
  document.body.append(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  active?.focus({ preventScroll: true });
  return copied;
}

/** The clipboard's text, or null when the browser does not allow reading it. */
export async function readClipboardText(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.readText) return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** A paste a shell without bracketed paste could run line by line. */
export function isRiskyPaste(text: string, bracketed: boolean) {
  return !bracketed && /[\r\n]/.test(text.replace(/[\r\n]+$/, ''));
}

export function pastedLineCount(text: string) {
  return text.replace(/[\r\n]+$/, '').split(/\r\n|\r|\n/).length;
}
