import type { ComponentProps } from 'react';
import { X } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../graph-ui/Dialog';
import { ThreadMap } from './ThreadMap';

/** The thread map in a dialog: full screen on a phone, a large panel elsewhere. */
export function ThreadMapDialog({ open, onOpenChange, themeMode, effectiveTheme, ...map }: Omit<ComponentProps<typeof ThreadMap>, 'heading' | 'actions'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeMode?: string | undefined;
  effectiveTheme?: 'light' | 'dark' | undefined;
}) {
  useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}
        data-theme-effective={effectiveTheme} data-theme-mode={themeMode}
        className="thread-graph-dialog matter-settings-dialog thread-map-dialog" overlayClassName="matter-settings-overlay">
        <ThreadMap {...map} onDismiss={() => onOpenChange(false)}
          heading={<DialogTitle className="thread-map-title">{translate('workbench.threadMap')}</DialogTitle>}
          actions={<DialogClose className="thread-map-icon-button thread-map-close" aria-label={translate('workbench.close')}><X aria-hidden="true" /></DialogClose>} />
      </DialogContent>
    </Dialog>
  );
}
