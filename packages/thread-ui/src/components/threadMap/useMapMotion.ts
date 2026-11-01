import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { MapRect } from './squarify';

type Frame = { rect: MapRect; element: HTMLElement; parent: string | undefined };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** FLIP from computed map geometry, with no layout reads during live updates. */
export function useMapMotion(stage: RefObject<HTMLDivElement | null>, enabled: boolean, revision: unknown, tree: unknown, size: unknown, groups: unknown) {
  const previous = useRef(new Map<string, Frame>());
  const level = useRef<unknown>(revision);
  useLayoutEffect(() => {
    if (!enabled || !stage.current) return;
    const next = new Map<string, Frame>();
    for (const element of stage.current.querySelectorAll<HTMLElement>('[data-map-id]')) {
      const rect = { x: parseFloat(element.style.left) || 0, y: parseFloat(element.style.top) || 0,
        width: parseFloat(element.style.width) || 0, height: parseFloat(element.style.height) || 0 };
      next.set(element.dataset.mapId!, { rect, element, parent: element.parentElement?.closest<HTMLElement>('[data-map-id]')?.dataset.mapId });
    }
    if (!reduced() && level.current === revision) {
      for (const [id, frame] of next) {
        const old = previous.current.get(id);
        if (old && old.parent === frame.parent && frame.rect.width && frame.rect.height) {
          const a = old.rect, b = frame.rect;
          if (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height) continue;
          frame.element.animate?.([
            { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${a.width / b.width}, ${a.height / b.height})`, transformOrigin: '0 0' },
            { transform: 'none', transformOrigin: '0 0' },
          ], { duration: 200, easing: 'cubic-bezier(.2,.75,.25,1)' });
        } else if (!old) frame.element.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      }
      for (const [id, old] of previous.current) if (!next.has(id) && (!old.parent || next.has(old.parent))) {
        const ghost = old.element.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-map-id');
        for (const child of ghost.querySelectorAll('[data-map-id]')) child.removeAttribute('data-map-id');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        ghost.style.pointerEvents = 'none';
        const parent = old.parent ? next.get(old.parent)?.element.querySelector(':scope > .thread-map-preview') : stage.current;
        (parent ?? stage.current).append(ghost);
        const exit = ghost.animate?.([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.92)', opacity: 0 }], { duration: 160 });
        if (exit) exit.onfinish = () => ghost.remove(); else ghost.remove();
      }
    }
    previous.current = next;
    level.current = revision;
  }, [stage, enabled, revision, tree, size, groups]);
}
