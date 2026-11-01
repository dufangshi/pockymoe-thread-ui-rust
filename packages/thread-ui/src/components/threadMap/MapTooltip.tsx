import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MapRect } from './squarify';

/** A tip must fit outside its entire source block, not over the first child tile. */
export function placeMapTooltip(anchor: MapRect, tip: { width: number; height: number }, viewport: MapRect) {
  const gap = 8, left = viewport.x + gap, top = viewport.y + gap;
  const right = viewport.x + viewport.width - gap, bottom = viewport.y + viewport.height - gap;
  const x = Math.max(left, Math.min(right - tip.width, anchor.x));
  const y = Math.max(top, Math.min(bottom - tip.height, anchor.y));
  const candidates = [
    { x, y: anchor.y + anchor.height + gap },
    { x: anchor.x + anchor.width + gap, y },
    { x: anchor.x - tip.width - gap, y },
    { x, y: anchor.y - tip.height - gap },
  ];
  return candidates.find(p => p.x >= left && p.y >= top && p.x + tip.width <= right && p.y + tip.height <= bottom
    && (p.x >= anchor.x + anchor.width || p.x + tip.width <= anchor.x || p.y >= anchor.y + anchor.height || p.y + tip.height <= anchor.y)) ?? null;
}

export function MapTooltip({ anchor, lines, onClose }: { anchor: HTMLElement; lines: string[]; onClose: () => void }) {
  const element = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose;
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      if (!anchor.isConnected || !anchor.getClientRects().length || !element.current) { close.current(); return; }
      const a = anchor.getBoundingClientRect(), t = element.current.getBoundingClientRect(), view = window.visualViewport;
      const next = placeMapTooltip({ x: a.left, y: a.top, width: a.width, height: a.height }, t,
        { x: view?.offsetLeft ?? 0, y: view?.offsetTop ?? 0, width: view?.width ?? innerWidth, height: view?.height ?? innerHeight });
      setPosition(next);
    };
    update();
    const resize = new ResizeObserver(update); resize.observe(anchor); if (element.current) resize.observe(element.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update); window.visualViewport?.addEventListener('scroll', update);
    return () => {
      resize.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchor, lines]);
  return createPortal(<div ref={element} role="tooltip" className="thread-graph-dialog thread-map-tip"
    data-theme-effective={document.documentElement.dataset.themeEffective}
    style={{ position: 'fixed', left: position?.x ?? 0, top: position?.y ?? 0, visibility: position ? 'visible' : 'hidden', width: 'min(300px, calc(100vw - 16px))' }}>
    {lines.map((line, index) => index ? <span key={index}>{line}</span> : <b key={index}>{line}</b>)}
  </div>, document.body);
}
