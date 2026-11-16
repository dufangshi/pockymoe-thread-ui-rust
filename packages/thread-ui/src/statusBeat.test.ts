// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStatusBeat } from './statusBeat';

describe('document status beat', () => {
  let hidden = false;
  let reduced = false;
  let motionChanged: () => void;
  let release: (() => void) | undefined;
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
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
    vi.useRealTimers(); vi.unstubAllGlobals();
  });
  it('shares one timer across indicators, follows mount/status changes, and stops after the last one', async () => {
    release = installStatusBeat();
    expect(vi.getTimerCount()).toBe(0);
    document.body.innerHTML = '<i class="matter-status-dot" data-status="running"></i>'.repeat(12);
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    expect(document.documentElement.dataset.statusBeat).toBe('0');
    vi.advanceTimersByTime(400);
    expect(document.documentElement.dataset.statusBeat).toBe('1');
    vi.advanceTimersByTime(2800);
    expect(document.documentElement.dataset.statusBeat).toBe('0');
    document.querySelectorAll('i').forEach(mark => { mark.dataset.status = 'idle'; });
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.documentElement.hasAttribute('data-status-beat')).toBe(false);
  });
  it('stops while hidden or reduced, resumes in phase, and tears down its listeners', async () => {
    document.body.innerHTML = '<i class="animate-spin"></i>';
    release = installStatusBeat();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(1);
    reduced = true; motionChanged();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.documentElement.hasAttribute('data-status-beat')).toBe(false);
    reduced = false; motionChanged();
    expect(document.documentElement.dataset.statusBeat).toBe('0');
    release(); release = undefined;
    document.body.innerHTML += '<i class="animate-spin"></i>';
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps a single document clock when hosts install it more than once', () => {
    document.body.innerHTML = '<i class="host-spinner"></i>';
    release = installStatusBeat();
    const second = installStatusBeat(document, ['.host-spinner']);
    expect(vi.getTimerCount()).toBe(1);
    second();
    expect(vi.getTimerCount()).toBe(1);
    release(); release = undefined;
    expect(vi.getTimerCount()).toBe(0);
  });
});
