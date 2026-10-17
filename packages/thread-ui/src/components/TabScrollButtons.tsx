import type { RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { translate, useI18n } from '../i18n';

/** ‹ and › at the edges of a scrolling tab strip, shown where tabs are hidden;
    each moves the strip by most of its width. Swipes and the wheel still scroll. */
export function TabScrollButtons({ targetRef, edges }: {
  targetRef: RefObject<HTMLElement | null>;
  edges: { 'data-overflow-start': boolean; 'data-overflow-end': boolean };
}) {
  useI18n();
  const page = (direction: -1 | 1) => {
    const strip = targetRef.current;
    if (!strip) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    strip.scrollBy({ left: direction * Math.max(80, strip.clientWidth * 0.8), behavior: smooth ? 'smooth' : 'auto' });
  };
  return (
    <>
      {edges['data-overflow-start'] ? (
        <button type="button" className="tab-scroll-button" data-edge="start" tabIndex={-1}
          aria-label={translate('workbench.scrollTabsBack')} title={translate('workbench.scrollTabsBack')} onClick={() => page(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : null}
      {edges['data-overflow-end'] ? (
        <button type="button" className="tab-scroll-button" data-edge="end" tabIndex={-1}
          aria-label={translate('workbench.scrollTabsForward')} title={translate('workbench.scrollTabsForward')} onClick={() => page(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}
