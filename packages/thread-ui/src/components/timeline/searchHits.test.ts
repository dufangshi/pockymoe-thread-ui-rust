/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markSearchHits } from './searchHits';

class FakeHighlight { ranges: Range[]; constructor(...ranges: Range[]) { this.ranges = ranges; } }

describe('markSearchHits', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks every occurrence in the message until the reader presses', async () => {
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });
    const root = document.createElement('div');
    root.innerHTML = '<p>Check the <b>check</b>list, then CHECK again.</p>';
    document.body.append(root);
    markSearchHits(root, 'check');
    expect(highlights.get('thread-search-hit')?.ranges.map(range => range.toString())).toEqual(['Check', 'check', 'CHECK']);
    await new Promise(resolve => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('pointerdown'));
    expect(highlights.has('thread-search-hit')).toBe(false);
    root.remove();
  });
});
