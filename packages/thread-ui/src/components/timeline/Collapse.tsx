import { useEffect, useRef, useState, type ReactNode } from 'react';

const DURATION = 260;

type Phase = 'closed' | 'opening' | 'growing' | 'open' | 'closing';

/** Without motion (a reader's preference, or no media queries at all) it switches at once. */
function animates() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Folds its content up into the line above it, and unfolds it again. Closed
    content is not rendered; while folding, it keeps showing what it last had. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const previous = useRef(open);
  const last = useRef<ReactNode>(children);
  if (open) last.current = children;

  useEffect(() => {
    if (previous.current === open) return;
    previous.current = open;
    if (!animates()) {
      setPhase(open ? 'open' : 'closed');
      return;
    }
    if (open) {
      // Paint at zero height first so the height can grow.
      setPhase('opening');
      let inner = 0;
      const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setPhase('growing')); });
      const timer = window.setTimeout(() => setPhase('open'), DURATION + 40);
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); window.clearTimeout(timer); };
    }
    setPhase('closing');
    const timer = window.setTimeout(() => setPhase('closed'), DURATION);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Without motion, content follows `open` in the same render.
  const shown = animates() ? phase : open ? 'open' : 'closed';
  if (shown === 'closed') return null;
  return (
    <div className="tlog-collapse" data-state={shown === 'growing' || shown === 'open' ? 'open' : 'closed'}
      // Content may overflow (outlines, menus) only once the height has settled.
      data-settled={shown === 'open' || undefined}>
      <div className="tlog-collapse-inner">{open ? children : last.current}</div>
    </div>
  );
}
