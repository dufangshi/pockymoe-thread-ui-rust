/** One document clock for perpetual indicators. No CSS animation/compositor loop,
 * React renders, per-element timers or inherited root custom properties. */
export const STATUS_BEAT_MS = 400;
export const STATUS_BEAT_SELECTOR = [
  '.matter-status-dot:is([data-status="running"], [data-status="agents-running"])',
  '.thread-map [data-running]', '.thread-map-running-dot',
  '.thread-turn-head[data-active] .thread-turn-head-dot',
  '.thread-wait-mark svg', '.thread-background-agent-status svg',
  '.tlog-spinner', '.thread-room-running', '.matter-running-icon > i',
  '.matter-group-toggle.is-badge[data-running] > svg',
  '.thread-graph-turn[data-turn-active="true"] .thread-transcript-agent .matter-thread-avatar',
  '.tlog-current.is-thought .tlog-title',
  '.is-running-batch .thread-graph-history-group-verb',
  '.is-running-batch .thread-graph-history-group-description',
  '.animate-spin', '.animate-pulse',
].join(',');

const clocks = new WeakMap<Document, { release(): void; retain(selectors: readonly string[]): void }>();

/** Hosts install once at startup. Extra selectors let host-only indicators share
 * the same beat. Mount/status changes are observed, never polled. */
export function installStatusBeat(doc: Document = document, extraSelectors: readonly string[] = []): () => void {
  const existing = clocks.get(doc);
  if (existing) {
    existing.retain(extraSelectors);
    return existing.release;
  }
  const win = doc.defaultView;
  if (!win) return () => undefined;
  const root = doc.documentElement;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const selectors = new Set([STATUS_BEAT_SELECTOR, ...extraSelectors]);
  let users = 1;
  let timer: number | undefined;
  let step = 0;
  const stop = () => {
    if (timer !== undefined) win.clearInterval(timer);
    timer = undefined;
    root.removeAttribute('data-status-beat');
  };
  const reconcile = () => {
    const active = !doc.hidden && !reduced.matches && doc.querySelector([...selectors].join(','));
    if (!active) { stop(); return; }
    if (timer !== undefined) return;
    step = 0;
    root.dataset.statusBeat = '0';
    timer = win.setInterval(() => {
      step = (step + 1) % 8;
      root.dataset.statusBeat = String(step);
    }, STATUS_BEAT_MS);
  };
  const observer = new win.MutationObserver(reconcile);
  observer.observe(root, {
    subtree: true, childList: true, attributes: true,
    // Deliberately exclude our own root attribute. Streaming text and beat
    // changes cannot feed another observer pass.
    attributeFilter: ['class', 'data-status', 'data-running', 'data-active', 'data-turn-active', 'data-state'],
  });
  doc.addEventListener('visibilitychange', reconcile);
  reduced.addEventListener('change', reconcile);
  const clock = {
    retain(extra: readonly string[]) { users++; extra.forEach(selector => selectors.add(selector)); reconcile(); },
    release() {
      if (--users > 0) return;
      stop(); observer.disconnect();
      doc.removeEventListener('visibilitychange', reconcile);
      reduced.removeEventListener('change', reconcile);
      clocks.delete(doc);
    },
  };
  clocks.set(doc, clock);
  reconcile();
  return clock.release;
}
