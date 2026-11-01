import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Native scrolling with the application's themed, independent overlay thumb. */
export function MapScrollList({ children, label }: { children: ReactNode; label: string }) {
  const viewport = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ height: 0, top: 0 });
  const frame = useRef<number | null>(null);
  const measure = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = viewport.current;
      if (!el) return;
      const height = el.clientHeight, full = el.scrollHeight;
      const size = full > height ? Math.max(28, height * height / full) : 0;
      setThumb({ height: size, top: full > height ? el.scrollTop / (full - height) * (height - size) : 0 });
    });
  };
  useEffect(() => {
    measure();
    const el = viewport.current;
    if (!el) return;
    const resize = new ResizeObserver(measure); resize.observe(el);
    const changes = new MutationObserver(measure); changes.observe(el, { childList: true, subtree: true });
    return () => { resize.disconnect(); changes.disconnect(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  return <div className="thread-map-scroll-list">
    <div ref={viewport} className="thread-map-list-scroll" role="region" aria-label={label} onScroll={measure} onFocusCapture={event => {
      (event.target as HTMLElement).closest('.thread-map-list-row')?.scrollIntoView?.({ block: 'nearest' });
    }}>{children}</div>
    {thumb.height > 0 && <div ref={track} className="thread-map-scroll-track" aria-hidden="true">
      <div className="thread-map-scroll-thumb" style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }} onPointerDown={event => {
        event.preventDefault(); const el = viewport.current!;
        const start = event.clientY, at = el.scrollTop, range = el.scrollHeight - el.clientHeight;
        const travel = el.clientHeight - thumb.height;
        const target = event.currentTarget; target.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => { el.scrollTop = at + (next.clientY - start) * range / Math.max(1, travel); };
        const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
        target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
      }} />
    </div>}
  </div>;
}
