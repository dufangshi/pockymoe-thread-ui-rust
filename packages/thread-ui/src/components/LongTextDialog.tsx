import { translate, useI18n } from '../i18n';
import { X } from 'lucide-react';
import { DiffDetail } from './DiffDetail';
import { CopyButton } from './copy/CopyButton';
import { Dialog, DialogClose, DialogContent, DialogTitle } from './graph-ui/Dialog';

interface LongTextDialogProps {
  open: boolean;
  title: string;
  text: string;
  kind?: string | undefined;
  onClose: () => void;
}

/** A command's whole output or a whole diff. A modal window: focus moves in and
    stays there, Esc closes it, and focus returns to what opened it. */
export function LongTextDialog({
  open,
  title,
  text,
  kind,
  onClose,
}: LongTextDialogProps) {
  useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="z-[90] bg-[var(--overlay-scrim)] backdrop-blur-sm"
        className="thread-detail-dialog long-text-dialog z-[91] flex max-h-[min(82vh,52rem)] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-0 text-[var(--theme-fg)] shadow-2xl sm:max-w-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--theme-border)] px-4 py-3 sm:px-5">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{title}</DialogTitle>
          <CopyButton value={text} label={translate('chat.copyAll')} className="h-9 w-9" />
          <DialogClose
            aria-label={translate('workbench.closeDialog')}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
          {kind === 'fileChange' && /^@@ /m.test(text) ? <DiffDetail text={text} /> : <pre className="whitespace-pre-wrap break-words text-sm leading-6">
            {text}
          </pre>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
