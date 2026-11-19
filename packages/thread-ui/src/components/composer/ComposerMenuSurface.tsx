import { useCallback, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';

type ComposerMenuSurfaceProps = ComponentPropsWithoutRef<'div'> & {
  align?: 'start' | 'end';
  /** Optional surrounding surface to keep a detail panel clear of the controls. */
  anchorSelector?: string;
  /** A real menu (docs/ui-principles.md §3): role=menu, the first item takes
      focus, arrows move, Esc closes and returns focus to the trigger. Leave it
      out for forms (hooks, MCP) and for the list typed `/` opens, where focus
      stays in the prompt. */
  menu?: { onClose: () => void; itemSelector?: string };
};

const MENU_ITEMS = '[role^="menuitem"]:not([disabled])';

// Keep the menu in its themed DOM subtree, but paint it above the composer,
// stop button and timeline navigation using the browser's top layer.
export function ComposerMenuSurface({
  align = 'start',
  anchorSelector,
  children,
  className = '',
  menu: menuBehaviour,
  ...props
}: ComposerMenuSurfaceProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onMenuClose = menuBehaviour?.onClose;
  const closeMenu = useCallback((restoreFocus: boolean) => {
    if (restoreFocus) {
      menuRef.current?.parentElement
        ?.querySelector<HTMLElement>('[data-composer-menu-trigger="true"]')
        ?.focus({ preventScroll: true });
    }
    onMenuClose?.();
  }, [onMenuClose]);
  useMenuKeyboard(menuRef, Boolean(menuBehaviour), closeMenu, menuBehaviour?.itemSelector ?? MENU_ITEMS);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = menu?.parentElement?.querySelector<HTMLElement>(
      '[data-composer-menu-trigger="true"]',
    );
    if (!menu || !trigger) return;

    const topLayer = typeof menu.showPopover === 'function';
    if (topLayer) {
      menu.showPopover();
    } else {
      menu.removeAttribute('popover');
      // A blurred composer is a containing block for fixed descendants.
      // Older WebViews without the top layer therefore need local coordinates.
      menu.style.position = 'absolute';
    }

    const updatePosition = () => {
      const viewport = window.visualViewport;
      const gutter = 8;
      const left = (viewport?.offsetLeft ?? 0) + gutter;
      const top = (viewport?.offsetTop ?? 0) + gutter;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? window.innerHeight;
      const right = left + width - gutter * 2;
      const bottom = top + height - gutter * 2;
      const anchor = (anchorSelector ? trigger.closest(anchorSelector) ?? trigger : trigger).getBoundingClientRect();
      // Open above or below the whole composer frame, not the toolbar key:
      // a menu anchored on the key covers the line being typed (§12).
      const composerFrame = anchorSelector ? null : trigger.closest('.thread-graph-composer-shell');
      const vertical = composerFrame ? composerFrame.getBoundingClientRect() : anchor;

      menu.style.maxWidth = `${Math.max(0, right - left)}px`;
      const above = Math.max(0, vertical.top - gutter - top);
      const below = Math.max(0, bottom - vertical.bottom - gutter);
      const naturalHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
      const openAbove = naturalHeight <= above || above >= below;
      menu.style.maxHeight = `${Math.min(bottom - top, openAbove ? above : below)}px`;

      const bounds = menu.getBoundingClientRect();
      const preferredLeft = align === 'end' ? anchor.right - bounds.width : anchor.left;
      const preferredTop = openAbove ? vertical.top - gutter - bounds.height : vertical.bottom + gutter;
      const parent = !topLayer ? menu.offsetParent as HTMLElement | null : null;
      const origin = parent?.getBoundingClientRect();
      menu.style.left = `${Math.max(left, Math.min(preferredLeft, right - bounds.width)) - (origin?.left ?? 0) - (parent?.clientLeft ?? 0) + (parent?.scrollLeft ?? 0)}px`;
      menu.style.top = `${Math.max(top, Math.min(preferredTop, bottom - bounds.height)) - (origin?.top ?? 0) - (parent?.clientTop ?? 0) + (parent?.scrollTop ?? 0)}px`;
    };

    let frame = 0;
    const schedulePosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    updatePosition();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePosition);
    resizeObserver?.observe(menu);
    resizeObserver?.observe(trigger);
    const form = trigger.closest('form');
    if (form) resizeObserver?.observe(form);
    const mutationObserver = new MutationObserver(schedulePosition);
    mutationObserver.observe(menu, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
      menu.hidePopover?.();
    };
  }, [align, anchorSelector]);

  return (
    <div
      {...(menuBehaviour ? { role: 'menu' } : {})}
      {...props}
      ref={menuRef}
      popover="manual"
      data-composer-menu-surface="true"
      className={`thread-composer-menu-surface ${className}`}
    >
      {children}
    </div>
  );
}
