import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { shellThemeProps } from '../themeHooks';
import { useSheetViewport } from '../useSheetViewport';

const PHONE = '(max-width: 639px)';
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia?.(PHONE);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
/** Phone width (docs/ui-principles.md §4): the composer's windows rise from the bottom. */
export const useIsPhone = () => useSyncExternalStore(subscribePhone, () => Boolean(window.matchMedia?.(PHONE).matches), () => false);

/**
 * A composer window as a phone bottom sheet: rendered at the page's root
 * (docs/ui-principles.md §4) with a blurred scrim that closes it, on the visible
 * part of the page so a software keyboard does not cover it. The hidden marker
 * keeps what the composer does while one of its menus is open: it stays
 * unfolded and the trigger keeps its place to return focus to. The window
 * itself manages focus (`useModalFocus`).
 */
export function ComposerSheet({ label, closeLabel, trigger, onClose, className = '', children }: {
  label: string;
  closeLabel: string;
  trigger: HTMLElement | null;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const theme = shellThemeProps(trigger);
  const viewport = useSheetViewport();
  return (
    <>
      <span hidden data-composer-menu-surface="true" />
      {createPortal(
        <div className={`thread-ui-shell thread-context-sheet-layer ${theme.themeClass}`.trim()} data-composer-menu-surface="true"
          data-theme-effective={theme['data-theme-effective']} data-theme-mode={theme['data-theme-mode']} style={viewport}>
          <button type="button" className="thread-context-scrim" aria-label={closeLabel} onClick={onClose} />
          <section className={`thread-context-surface is-sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label}>
            {children}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
