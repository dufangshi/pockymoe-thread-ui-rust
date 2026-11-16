import { useEffect, useState } from 'react';

type Clock = { timer: ReturnType<typeof setInterval>; listeners: Set<(now: number) => void> };
const clocks = new Map<number, Clock>();
function subscribe(interval: number, listener: (now: number) => void) {
  let clock = clocks.get(interval);
  if (!clock) {
    const listeners = new Set<(now: number) => void>();
    clock = { listeners, timer: setInterval(() => {
      const now = Date.now();
      listeners.forEach(update => update(now));
    }, interval) };
    clocks.set(interval, clock);
  }
  clock.listeners.add(listener);
  return () => {
    clock.listeners.delete(listener);
    if (!clock.listeners.size) { clearInterval(clock.timer); clocks.delete(interval); }
  };
}

/** One clock per cadence. Offscreen readouts stop and catch up when revealed;
 * Electron's rendering gate is separate from visibility so activity stays live. */
export function useVisibleClock(enabled: boolean, interval = 1000, element?: Element | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    let onScreen = element === undefined || (element !== null && typeof IntersectionObserver === 'undefined');
    let stop: (() => void) | undefined;
    let disposed = false;
    const sync = () => {
      if (disposed) return;
      const visible = !document.hidden && document.documentElement.dataset.pockymoeRendering !== 'paused' && onScreen;
      if (!visible) { stop?.(); stop = undefined; }
      else if (!stop) { setNow(Date.now()); stop = subscribe(interval, setNow); }
    };
    const observer = element && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      onScreen = entries.some(entry => entry.isIntersecting);
      sync();
    }) : undefined;
    if (element) observer?.observe(element);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pockymoe-rendering-change', sync);
    sync();
    return () => {
      disposed = true;
      stop?.(); observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pockymoe-rendering-change', sync);
    };
  }, [enabled, interval, element]);
  return now;
}
