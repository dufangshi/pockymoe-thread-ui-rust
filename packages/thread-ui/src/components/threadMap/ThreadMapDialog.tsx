import { useSyncExternalStore, type ComponentProps } from 'react';
import { mapPresentation } from './phone';
import { X } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../graph-ui/Dialog';
import { ThreadMap } from './ThreadMap';

/** Phones retain the zoomable tile map; desktops retain the dense page map. */
export function ThreadMapDialog({ open, onOpenChange, themeMode, effectiveTheme, hostSurface, ...map }: Omit<ComponentProps<typeof ThreadMap>, 'heading' | 'actions'> & {
  hostSurface?: 'mobile' | 'desktop' | 'browser';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeMode?: string | undefined;
  effectiveTheme?: 'light' | 'dark' | undefined;
}) {
  useI18n();
  const narrow = useSyncExternalStore(callback => {
    const media = window.matchMedia('(max-width: 639px)');
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  }, () => window.matchMedia('(max-width: 639px)').matches, () => false);
  const presentation = mapPresentation(narrow ? 639 : 640, hostSurface);
  const phone = presentation === 'dialog';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Focus the panel, not its first button, whose tooltip would otherwise cover the map on opening. */}
      <DialogContent showCloseButton={false} aria-describedby={undefined} tabIndex={-1}
        onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement).focus(); }}
        data-theme-effective={effectiveTheme} data-theme-mode={themeMode}
        className="thread-graph-dialog matter-settings-dialog thread-map-dialog" overlayClassName="matter-settings-overlay">
        <DialogTitle className="sr-only">{translate('workbench.threadMap')}</DialogTitle>
        <ThreadMap {...map} presentation={presentation} phone={phone} heading={phone ? <span className="thread-map-title">{translate('workbench.threadMap')}</span> : undefined} onDismiss={() => onOpenChange(false)}
          actions={<DialogClose className="thread-map-icon-button thread-map-close" aria-label={translate('workbench.close')}><X aria-hidden="true" /></DialogClose>} />
      </DialogContent>
    </Dialog>
  );
}
