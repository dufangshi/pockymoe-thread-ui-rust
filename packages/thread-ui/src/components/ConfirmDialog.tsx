import { translate, useI18n } from '../i18n';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './menu/useModalFocus';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  /** A third, non-destructive way out (e.g. "Save and close"). */
  secondaryLabel?: string;
  onSecondary?: () => void | Promise<void>;
  /** The cancel button's label, "Cancel" by default. */
  cancelLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = translate("workbench.delete"),
  busyLabel = translate("workbench.deleting"),
  busy = false,
  error,
  onCancel,
  onConfirm,
  secondaryLabel,
  onSecondary,
  cancelLabel,
}: ConfirmDialogProps) {
  useI18n();
  const windowRef = useRef<HTMLDivElement>(null);
  // Focus starts on Cancel; Esc cancels unless the action is running.
  useModalFocus(windowRef, open, busy ? undefined : onCancel, '[data-initial-focus]');

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={translate("workbench.closeConfirmationDialog")}
        onClick={onCancel}
        disabled={busy}
        className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
      />
      <div
        ref={windowRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-[1] w-full max-w-md rounded-t-2xl border border-b-0 border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:rounded-xl sm:border-b sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-fg-muted)]">{description}</p>
            {error ? <p role="alert" className="mt-2 text-sm text-rose-500">{error}</p> : null}
          </div>
          <button
            type="button"
            aria-label={translate("workbench.closeDialog")}
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border)] text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
              <path d="M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            data-initial-focus=""
            onClick={onCancel}
            disabled={busy}
            className="min-h-10 rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel ?? translate("workbench.cancel")}</button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={() => void onSecondary()}
              disabled={busy}
              className="min-h-10 rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {secondaryLabel}</button>
          ) : null}
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="ui-action-danger min-h-10 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
