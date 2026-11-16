/** One document clock; only the retained indicators receive beat writes. */
export const STATUS_BEAT_MS = 400;
export const STATUS_BEAT_SELECTOR = [
  '.matter-status-dot:is([data-status="running"], [data-status="agents-running"])',
  '.thread-map [data-running]', '.thread-map-running-dot',
  '.thread-turn-head[data-active] .thread-turn-head-dot',
  '.thread-wait-mark svg', '.thread-background-agent-status svg',
  '.tlog-spinner', '.thread-room-running', '.matter-running-icon > i',
  '.matter-group-toggle.is-badge[data-running] > svg',
  ...['matter-thread-row', 'matter-group-tab', 'matter-agent-threads-item'].flatMap(row =>
    ['running', 'agents-running'].map(status => `.${row}:has(> .matter-status-dot[data-status="${status}"]) > .matter-thread-avatar`)),
  '.thread-graph-turn[data-turn-active="true"] .thread-transcript-agent .matter-thread-avatar',
  '.tlog-current.is-thought .tlog-title',
  '.is-running-batch .thread-graph-history-group-verb',
  '.is-running-batch .thread-graph-history-group-description',
  '.animate-spin', '.animate-pulse',
].join(',');

const clocks = new WeakMap<Document, { release(): void; retain(selectors: readonly string[]): void }>();

/** Hosts install once at startup. Membership follows DOM/status changes; ticks
 * never search the document. Extra selectors share the same clock. */
export function installStatusBeat(doc: Document = document, extraSelectors: readonly string[] = []): () => void {
  const existing = clocks.get(doc);
  if (existing) {
    existing.retain(extraSelectors);
    return existing.release;
  }
  const win = doc.defaultView;
  if (!win) return () => undefined;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const selectors = new Set([STATUS_BEAT_SELECTOR, ...extraSelectors]);
  const indicators = new Set<Element>();
  const pending = new Set<Element>();
  let selector = '';
  let classes = new Set<string>();
  let users = 1;
  let timer: number | undefined;
  let frame: number | undefined;
  let step = 0;
  let prune = false;
  const paint = () => {
    const value = String(step);
    for (const el of indicators) el.setAttribute('data-beat', value);
  };
  const stop = () => {
    if (timer !== undefined) win.clearInterval(timer);
    timer = undefined;
    for (const el of indicators) el.removeAttribute('data-beat');
  };
  const syncClock = () => {
    if (doc.hidden || reduced.matches || !indicators.size) { stop(); return; }
    if (timer !== undefined) return;
    step = 0;
    paint();
    timer = win.setInterval(() => {
      step = (step + 1) % 8;
      paint();
    }, STATUS_BEAT_MS);
  };
  const add = (el: Element) => {
    if (el === doc.documentElement || el === doc.body || indicators.has(el)) return;
    indicators.add(el);
    if (timer !== undefined) el.setAttribute('data-beat', String(step));
  };
  const reconcile = () => {
    frame = undefined;
    // Pruning the small retained set also handles removals and ancestor changes.
    if (prune) for (const el of indicators) {
      if (el.ownerDocument !== doc || !el.isConnected || !el.matches(selector)) {
        el.removeAttribute('data-beat');
        indicators.delete(el);
      }
    }
    prune = false;
    // Collapse overlapping changed subtrees. Streaming text never enters here.
    for (const el of pending) {
      if (!el.isConnected || el.ownerDocument !== doc) continue;
      let ancestor = el.parentElement;
      while (ancestor && !pending.has(ancestor)) ancestor = ancestor.parentElement;
      if (ancestor) continue;
      if (el.matches(selector)) add(el);
      if (el.firstElementChild) for (const match of el.querySelectorAll(selector)) add(match);
    }
    pending.clear();
    syncClock();
  };
  const schedule = () => {
    if (frame === undefined) frame = win.requestAnimationFrame(reconcile);
  };
  const observer = new win.MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      const target = record.target as Element;
      if (record.type === 'attributes') {
        if (record.attributeName === 'class') {
          const before = new Set((record.oldValue ?? '').split(/\s+/));
          const after = new Set((target.getAttribute('class') ?? '').split(/\s+/));
          if (![...before, ...after].some(name => classes.has(name) && before.has(name) !== after.has(name))) continue;
        }
        prune = true;
        // Status-dot changes can change a sibling avatar's :has() membership.
        pending.add(target.matches('.matter-status-dot') ? target.parentElement ?? target : target);
        changed = true;
      } else {
        if ([...record.removedNodes].some(node => node.nodeType === 1)) prune = true;
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.isConnected) pending.add(el);
          if (el.matches('.matter-status-dot')) pending.add(target);
          changed = true;
        }
      }
    }
    if (changed) schedule();
  });
  const observe = () => {
    selector = [...selectors].join(',');
    classes = new Set([...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]!));
    const attributes = new Set(['class', ...[...selector.matchAll(/\[([\w-]+)/g)].map(match => match[1]!)]);
    if (selector.includes('#')) attributes.add('id');
    attributes.delete('data-beat'); // Our writes must never feed the observer.
    observer.observe(doc.documentElement, {
      subtree: true, childList: true, attributes: true, attributeOldValue: true,
      attributeFilter: [...attributes],
    });
  };
  const resume = () => {
    if (frame !== undefined) { win.cancelAnimationFrame(frame); frame = undefined; }
    reconcile();
  };
  doc.addEventListener('visibilitychange', resume);
  reduced.addEventListener('change', resume);
  const clock = {
    retain(extra: readonly string[]) {
      users++;
      extra.forEach(value => selectors.add(value));
      observe();
      pending.add(doc.documentElement);
      resume();
    },
    release() {
      if (--users > 0) return;
      stop(); observer.disconnect();
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      pending.clear(); indicators.clear();
      doc.removeEventListener('visibilitychange', resume);
      reduced.removeEventListener('change', resume);
      clocks.delete(doc);
    },
  };
  clocks.set(doc, clock);
  observe();
  pending.add(doc.documentElement);
  reconcile();
  return clock.release;
}
