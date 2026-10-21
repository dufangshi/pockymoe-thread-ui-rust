import { createRoot } from 'react-dom/client';
import { ConfirmDialog } from '../ConfirmDialog';

/** The app's own confirmation in place of `window.confirm` (see
    docs/ui-principles.md §11): resolves true when confirmed. */
export function confirmAsync({ title, description, confirmLabel, cancelLabel, tone }: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const finish = (value: boolean) => {
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(
      <ConfirmDialog open title={title} description={description} confirmLabel={confirmLabel}
        {...(cancelLabel ? { cancelLabel } : {})}
        {...(tone ? { tone } : {})}
        onCancel={() => finish(false)} onConfirm={() => finish(true)} />,
    );
  });
}
