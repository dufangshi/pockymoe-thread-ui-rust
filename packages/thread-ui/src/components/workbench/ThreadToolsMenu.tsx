import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Star } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { CopyButton } from '../copy/CopyButton';
import { splitPath } from '../copy/PathChip';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { homeRelativePath } from '../WorkbenchPath';

/** The thread tools: a dropdown under their toggle. Its head is the workspace
    path (with copy) and the thread it belongs to, beside that thread's shortcut
    star; below are the host's thread actions (share, permissions, download,
    port mappings), each an icon with its accessible name as the label. */
export function ThreadToolsMenu({ id, open, anchorRef, path, title, favorite, favoriteBusy, onToggleFavorite, onClose, children }: {
  id: string;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  path: string;
  title: string;
  favorite: boolean;
  favoriteBusy?: boolean;
  onToggleFavorite: () => void;
  onClose: (restoreFocus: boolean) => void;
  children: ReactNode;
}) {
  useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Keyboard once it is placed and rendered: focus moves in, arrows move, Esc closes.
  useMenuKeyboard(menuRef, open && place !== null, (restore) => close.current(restore), 'button:not([disabled]), a[href]');

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (anchor) setPlace({ top: anchor.bottom + 6, right: Math.max(8, window.innerWidth - anchor.right) });
    };
    update();
    // It belongs to its toggle: a press outside closes it, a resize moves it.
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      // A window an action opened lives in a portal of its own; leave it alone.
      if (target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]')) return;
      close.current(false);
    };
    window.addEventListener('resize', update);
    document.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside, true); };
  }, [open, anchorRef]);

  if (!open || !place) return null;
  const host = anchorRef.current?.closest('.thread-ui-shell') ?? document.body;
  return createPortal(
    <div ref={menuRef} id={id} role="menu" aria-label={translate('workbench.threadTools')} className="matter-thread-tools-menu"
      style={{ top: place.top, right: place.right }}
      onClick={(event) => {
        // An action opens its window; the menu steps aside. The head's controls keep it open.
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.matter-thread-tools-items') && target.closest('button, a')) window.setTimeout(() => close.current(false), 0);
      }}>
      <div className="matter-thread-tools-head">
        <div className="matter-thread-tools-path" title={path}>
          <Folder aria-hidden="true" />
          {/* Shortened in the middle: the start and the last folder stay. */}
          <span className="matter-thread-tools-path-head">{splitPath(homeRelativePath(path)).head}</span>
          <span className="matter-thread-tools-path-tail">{splitPath(homeRelativePath(path)).tail}</span>
          <CopyButton value={path} label={translate('common.copyPath')} className="matter-thread-tools-copy" />
        </div>
        <button type="button" className="matter-thread-tools-star" aria-pressed={favorite} disabled={favoriteBusy}
          aria-label={favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}
          title={favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}
          onClick={onToggleFavorite}>
          <Star data-icon="shortcut" fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <div className="matter-thread-tools-title" title={title}>{title}</div>
      </div>
      <div className="matter-thread-tools-items">{children}</div>
    </div>,
    host,
  );
}
