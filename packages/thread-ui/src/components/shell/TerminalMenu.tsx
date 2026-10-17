import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Small fixed-position menu used by the terminal title bar and tab list. */
export function TerminalMenu({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: DOMRect | { x: number; y: number };
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewWidth = viewport?.width ?? window.innerWidth;
    const viewHeight = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0);
    const rect = 'width' in anchor ? anchor : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    // The terminal sits at the bottom of the screen: open upwards when needed.
    const below = rect.bottom + 4;
    const top = below + height <= viewHeight - 8 ? below : Math.max(8, rect.top - height - 4);
    const left = Math.max(8, Math.min(viewWidth - width - 8, 'width' in anchor ? rect.right - width : rect.left));
    setPosition({ left, top });
    menu.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled), input')?.focus();
  }, [anchor]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close.current();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="terminal-menu"
      style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      {children}
    </div>
  );
}
