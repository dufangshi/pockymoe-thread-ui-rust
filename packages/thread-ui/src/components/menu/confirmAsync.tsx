import { createRoot } from 'react-dom/client';
import { ConfirmDialog } from '../ConfirmDialog';

/** The app's own confirmation in place of `window.confirm` (see
    docs/ui-principles.md §11): resolves true when confirmed. */
export function confirmAsync({ title, description, confirmLabel, cancelLabel, tone, signal }: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** Cancel a native preflight that was aborted in another window. */
  signal?: AbortSignal;
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(false); return; }
    let settled = false;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      root.unmount();
      host.remove();
      resolve(value);
    };
    const abort = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    root.render(
      <ConfirmDialog open title={title} description={description} confirmLabel={confirmLabel}
        {...(cancelLabel ? { cancelLabel } : {})}
        {...(tone ? { tone } : {})}
        onCancel={() => finish(false)} onConfirm={() => finish(true)} />,
    );
  });
}
