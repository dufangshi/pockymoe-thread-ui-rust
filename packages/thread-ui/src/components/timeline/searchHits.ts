/** Marks every occurrence of `query` in `root` with the `thread-search-hit` CSS
    highlight, which paints text without touching the DOM React owns. The marks
    stay until the reader next presses, types or scrolls. Browsers without the
    Highlight API keep only the landing flash. */
export function markSearchHits(root: HTMLElement, query: string, onFound?: (first: Range) => void, attempt = 0) {
  const needle = query.trim().toLocaleLowerCase();
  const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
  if (!needle || !registry || typeof Highlight === 'undefined') return;
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.toLocaleLowerCase() ?? '';
    for (let index = text.indexOf(needle); index >= 0; index = text.indexOf(needle, index + needle.length)) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      ranges.push(range);
    }
  }
  clearSearchHits();
  if (!ranges.length) {
    // The message's text may render a moment after the landing; look again briefly.
    if (attempt < RETRY_DELAYS.length && root.isConnected) window.setTimeout(() => markSearchHits(root, query, onFound, attempt + 1), RETRY_DELAYS[attempt]);
    return;
  }
  registry.set('thread-search-hit', new Highlight(...ranges));
  onFound?.(ranges[0]!);
  // The landing scroll has already happened; the next one is the reader's.
  window.setTimeout(() => {
    for (const type of CLEAR_EVENTS) window.addEventListener(type, clearSearchHits, { capture: true, once: true, passive: true });
  }, 0);
}

const CLEAR_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;
const RETRY_DELAYS = [100, 250, 600, 1200];

export function clearSearchHits() {
  if (typeof CSS !== 'undefined') CSS.highlights?.delete('thread-search-hit');
  for (const type of CLEAR_EVENTS) window.removeEventListener(type, clearSearchHits, { capture: true });
}
