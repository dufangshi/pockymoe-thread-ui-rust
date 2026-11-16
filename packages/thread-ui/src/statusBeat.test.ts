// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStatusBeat } from './statusBeat';

describe('document status beat', () => {
  let hidden = false;
  let reduced = false;
  let motionChanged: () => void;
  let release: (() => void) | undefined;
  const flush = async () => { await Promise.resolve(); vi.advanceTimersByTime(16); await Promise.resolve(); };
  const beats = () => [...document.querySelectorAll('i')].map(el => el.getAttribute('data-beat'));
  beforeEach(() => {
    vi.useFakeTimers(); hidden = false; reduced = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return reduced; },
      addEventListener: (_: string, listener: () => void) => { motionChanged = listener; },
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => {
    release?.(); release = undefined; document.body.innerHTML = '';
    vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
  it('shares one timer, writes only indicators, and follows mount/status/removal changes', async () => {
    release = installStatusBeat();
    expect(vi.getTimerCount()).toBe(0);
    document.body.innerHTML = '<i class="matter-status-dot" data-status="running"></i>'.repeat(12);
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    expect(beats()).toEqual(Array(12).fill('0'));
    expect(document.documentElement.hasAttribute('data-status-beat')).toBe(false);
    expect(document.body.hasAttribute('data-beat')).toBe(false);
    document.documentElement.classList.add('animate-spin');
    document.body.classList.add('animate-spin');
    await flush();
    expect(document.documentElement.hasAttribute('data-beat')).toBe(false);
    expect(document.body.hasAttribute('data-beat')).toBe(false);
    document.documentElement.classList.remove('animate-spin');
    document.body.classList.remove('animate-spin');
    await flush();
    vi.advanceTimersByTime(400);
    expect(beats()).toEqual(Array(12).fill('1'));
    const added = document.createElement('i'); added.className = 'animate-spin'; document.body.append(added);
    await flush();
    expect(added.getAttribute('data-beat')).toBe('1');
    added.remove(); await flush();
    expect(added.hasAttribute('data-beat')).toBe(false);
    vi.advanceTimersByTime(3200);
    expect(beats()).toEqual(Array(12).fill('1'));
    document.querySelectorAll('i').forEach(mark => { mark.dataset.status = 'idle'; });
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    expect(beats()).toEqual(Array(12).fill(null));
  });
  it('stops while hidden or reduced, resumes in phase, and tears down its listeners', async () => {
    document.body.innerHTML = '<i class="animate-spin"></i>';
    release = installStatusBeat();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0); expect(beats()).toEqual([null]);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(1);
    reduced = true; motionChanged();
    expect(vi.getTimerCount()).toBe(0); expect(beats()).toEqual([null]);
    reduced = false; motionChanged();
    expect(beats()).toEqual(['0']);
    release(); release = undefined;
    document.body.innerHTML += '<i class="animate-spin"></i>';
    await flush();
    expect(vi.getTimerCount()).toBe(0); expect(beats()).toEqual([null, null]);
  });
  it('keeps a single document clock when hosts install it more than once', () => {
    document.body.innerHTML = '<i class="host-spinner"></i>';
    release = installStatusBeat();
    const second = installStatusBeat(document, ['.host-spinner']);
    expect(vi.getTimerCount()).toBe(1); expect(beats()).toEqual(['0']);
    second();
    expect(vi.getTimerCount()).toBe(1);
    release(); release = undefined;
    expect(vi.getTimerCount()).toBe(0); expect(beats()).toEqual([null]);
  });
  it('updates descendant and sibling avatar membership when ancestor status changes', async () => {
    document.body.innerHTML = '<div class="matter-group-tab"><span class="matter-thread-avatar"></span><i class="matter-status-dot" data-status="idle"></i></div><div class="thread-turn-head"><i class="thread-turn-head-dot"></i></div>';
    release = installStatusBeat();
    const avatar = document.querySelector('.matter-thread-avatar')!;
    const status = document.querySelector<HTMLElement>('.matter-status-dot')!;
    status.dataset.status = 'running';
    document.querySelector('.thread-turn-head')!.setAttribute('data-active', '');
    await flush();
    expect(avatar.getAttribute('data-beat')).toBe('0'); expect(beats()).toEqual(['0', '0']);
    status.dataset.status = 'idle';
    document.querySelector('.thread-turn-head')!.removeAttribute('data-active');
    await flush();
    expect(avatar.hasAttribute('data-beat')).toBe(false); expect(beats()).toEqual([null, null]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('coalesces streaming mutations, ignores unrelated classes/text, and never searches the document on ticks', async () => {
    document.body.innerHTML = '<i class="animate-spin"></i><section><p>stream</p></section>';
    release = installStatusBeat();
    const documentQuery = vi.spyOn(document, 'querySelectorAll');
    const subtreeQuery = vi.spyOn(Element.prototype, 'querySelectorAll');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const section = document.querySelector('section')!;
    for (let i = 0; i < 100; i++) {
      section.className = `stream-${i}`;
      section.firstChild!.firstChild!.textContent = String(i);
      section.setAttribute('data-state', String(i));
    }
    await flush();
    expect(raf).not.toHaveBeenCalled(); expect(subtreeQuery).not.toHaveBeenCalled();
    for (let i = 0; i < 50; i++) { section.append(document.createElement('div')); await Promise.resolve(); }
    expect(raf).toHaveBeenCalledTimes(1);
    await flush();
    expect(subtreeQuery).not.toHaveBeenCalled(); // Added leaves need only a matches check.
    subtreeQuery.mockClear();
    vi.advanceTimersByTime(3200); await Promise.resolve();
    expect(documentQuery).not.toHaveBeenCalled(); expect(subtreeQuery).not.toHaveBeenCalled();
    expect(raf).toHaveBeenCalledTimes(1);
  });
});
