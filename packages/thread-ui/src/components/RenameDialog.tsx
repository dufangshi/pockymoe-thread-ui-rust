import { translate, useI18n } from '../i18n';
import { FormEvent, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './menu/useModalFocus';

interface RenameDialogProps {
  open: boolean;
  title: string;
  label: string;
  value: string;
  busy?: boolean;
  error?: string | null;
  description?: string;
  submitLabel?: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}

export function RenameDialog({
  open,
  title,
  label,
  value,
  busy = false,
  error,
  description,
  submitLabel,
  onChange,
  onCancel,
  onSubmit,
}: RenameDialogProps) {
  useI18n();
  const windowRef = useRef<HTMLFormElement>(null);
  // Focus starts in the name field and stays in the window; Esc cancels.
  useModalFocus(windowRef, open, busy ? undefined : onCancel, 'input');

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={translate("workbench.closeRenameDialog")}
        onClick={onCancel}
        disabled={busy}
        className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
      />
      <form
        ref={windowRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            if (!busy) onCancel();
          }
        }}
        className="relative z-[1] w-full max-w-md rounded-t-2xl border border-b-0 border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:rounded-xl sm:border-b sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm text-[var(--theme-fg-muted)]">
              {description ?? translate("workbench.changesAreSavedOnlyAfterConfirmation")}</p>
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

        <div className="mt-5">
          <label htmlFor="rename-dialog-input" className="text-sm font-medium">
            {label}
          </label>
          <input
            id="rename-dialog-input"
            aria-label={label}
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-[var(--theme-fg)] outline-none transition focus:border-[var(--theme-accent-solid)]"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {error ? <p role="alert" className="text-sm text-rose-500">{error}</p> : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translate("workbench.cancel")}</button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="ui-action-success rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed"
          >
            {submitLabel ?? translate("workbench.save")}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
