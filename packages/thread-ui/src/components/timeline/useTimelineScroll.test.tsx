/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { WheelEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INITIAL_VISIBLE_TURNS,
  LOAD_STEP,
} from './timelineScroll';
import { useTimelineScroll } from './useTimelineScroll';

type TimelineScrollResult = ReturnType<typeof useTimelineScroll>;

let latestResult: TimelineScrollResult | null = null;

function HookHarness(
  props: Parameters<typeof useTimelineScroll>[0] & {
    renderNodes?: boolean;
  },
) {
  latestResult = useTimelineScroll(props);

  if (!props.renderNodes) {
    return null;
  }

  return (
    <div
      ref={latestResult.scrollContainerRef}
      data-testid="scroll-container"
      onScroll={latestResult.handleScroll}
      onWheel={latestResult.handleWheel}
      onTouchStart={latestResult.handleTouchStart}
      onTouchMove={latestResult.handleTouchMove}
    >
      <div ref={latestResult.scrollContentRef}>
        <button data-anchor>Toggle</button>
        <div ref={latestResult.topSentinelRef} />
        <div ref={latestResult.tailSentinelRef} />
      </div>
    </div>
  );
}

function renderHookHarness(
  input: Parameters<typeof useTimelineScroll>[0] & {
    renderNodes?: boolean;
  },
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<HookHarness {...input} />);
  });

  return {
    container,
    rerender(
      nextInput: Parameters<typeof useTimelineScroll>[0] & {
        renderNodes?: boolean;
      },
    ) {
      flushSync(() => {
        root.render(<HookHarness {...nextInput} />);
      });
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function baseInput(
  overrides: Partial<Parameters<typeof useTimelineScroll>[0]> = {},
): Parameters<typeof useTimelineScroll>[0] {
  return {
    threadId: 'thread-1',
    turnsLength: 25,
    loadingEarlier: false,
    scrollRequestKey: 0,
    bottomSpacer: 0,
    contentRevisionInputs: [],
    ...overrides,
  };
}

describe('useTimelineScroll', () => {
  beforeEach(() => {
    latestResult = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestResult = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('derives local hidden counts and loads earlier turns in fixed steps', () => {
    const harness = renderHookHarness(baseInput({ turnsLength: 35 }));

    expect(latestResult?.serverManagedHistory).toBe(false);
    expect(latestResult?.startIndex).toBe(35 - INITIAL_VISIBLE_TURNS);
    expect(latestResult?.hiddenCount).toBe(35 - INITIAL_VISIBLE_TURNS);
    expect(latestResult?.showLoadAll).toBe(false);

    flushSync(() => {
      latestResult?.handleLoadEarlierClick();
    });
    expect(latestResult?.startIndex).toBe(
      35 - (INITIAL_VISIBLE_TURNS + LOAD_STEP),
    );

    flushSync(() => {
      latestResult?.handleLoadEarlierClick();
    });
    expect(latestResult?.showLoadAll).toBe(true);

    flushSync(() => {
      latestResult?.handleLoadAllClick();
    });
    expect(latestResult?.startIndex).toBe(0);
    expect(latestResult?.hiddenCount).toBe(0);
    harness.unmount();
  });

  it('delegates earlier loading to the server when history is server-managed', () => {
    const onLoadEarlier = vi.fn();
    const harness = renderHookHarness(
      baseInput({
        turnsLength: 10,
        totalTurnCount: 30,
        onLoadEarlier,
      }),
    );

    expect(latestResult?.serverManagedHistory).toBe(true);
    expect(latestResult?.hiddenCount).toBe(20);
    expect(latestResult?.unloadedHiddenCount).toBe(20);

    flushSync(() => {
      latestResult?.handleLoadEarlierClick();
    });

    expect(onLoadEarlier).toHaveBeenCalledTimes(1);
    expect(latestResult?.startIndex).toBe(0);
    harness.unmount();
  });

  it('requires a second upward gesture at the top before server-managed earlier loading', () => {
    const onLoadEarlier = vi.fn();
    const harness = renderHookHarness({
      ...baseInput({
        turnsLength: 3,
        totalTurnCount: 9,
        onLoadEarlier,
      }),
      renderNodes: true,
    });
    const scrollContainer = harness.container.querySelector<HTMLDivElement>(
      '[data-testid="scroll-container"]',
    );
    if (!scrollContainer) {
      throw new Error('Expected scroll container to render.');
    }

    Object.defineProperties(scrollContainer, {
      scrollTop: {
        configurable: true,
        writable: true,
        value: 0,
      },
    });

    flushSync(() => {
      latestResult?.handleWheel({
        deltaY: -24,
      } as unknown as WheelEvent<HTMLDivElement>);
    });
    expect(onLoadEarlier).not.toHaveBeenCalled();

    flushSync(() => {
      latestResult?.handleWheel({
        deltaY: -24,
      } as unknown as WheelEvent<HTMLDivElement>);
    });
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);
    harness.unmount();
  });

  it('preserves the viewport when server-managed earlier turns are prepended', () => {
    const onLoadEarlier = vi.fn();
    let scrollHeight = 900;
    let scrollTop = 0;
    const harness = renderHookHarness({
      ...baseInput({
        turnsLength: 3,
        totalTurnCount: 9,
        onLoadEarlier,
      }),
      renderNodes: true,
    });
    const scrollContainer = harness.container.querySelector<HTMLDivElement>(
      '[data-testid="scroll-container"]',
    );
    if (!scrollContainer) {
      throw new Error('Expected scroll container to render.');
    }

    Object.defineProperties(scrollContainer, {
      scrollHeight: {
        configurable: true,
        get: () => scrollHeight,
      },
      clientHeight: {
        configurable: true,
        value: 300,
      },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
    });

    flushSync(() => {
      latestResult?.handleScroll();
      latestResult?.handleWheel({
        deltaY: -24,
      } as unknown as WheelEvent<HTMLDivElement>);
    });
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);

    harness.rerender({
      ...baseInput({
        turnsLength: 3,
        totalTurnCount: 9,
        loadingEarlier: true,
        onLoadEarlier,
      }),
      renderNodes: true,
    });
    scrollHeight = 1200;
    harness.rerender({
      ...baseInput({
        turnsLength: 6,
        totalTurnCount: 9,
        loadingEarlier: false,
        onLoadEarlier,
      }),
      renderNodes: true,
    });

    expect(scrollTop).toBe(300);
    harness.unmount();
  });

  it('notifies tail visibility changes from scroll geometry', async () => {
    const onTailVisibilityChange = vi.fn();
    const harness = renderHookHarness({
      ...baseInput({
        onTailVisibilityChange,
      }),
      renderNodes: true,
    });
    const scrollContainer = harness.container.querySelector<HTMLDivElement>(
      '[data-testid="scroll-container"]',
    );
    if (!scrollContainer) {
      throw new Error('Expected scroll container to render.');
    }

    Object.defineProperties(scrollContainer, {
      scrollHeight: {
        configurable: true,
        value: 1000,
      },
      clientHeight: {
        configurable: true,
        value: 100,
      },
      scrollTop: {
        configurable: true,
        writable: true,
        value: 900,
      },
    });

    flushSync(() => {
      latestResult?.handleScroll();
    });

    await vi.waitFor(() => {
      expect(onTailVisibilityChange).toHaveBeenCalledWith(true);
    });

    scrollContainer.scrollTop = 100;
    flushSync(() => {
      latestResult?.handleScroll();
    });

    await vi.waitFor(() => {
      expect(onTailVisibilityChange).toHaveBeenCalledWith(false);
    });
    harness.unmount();
  });

  function anchoredHarness() {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    let now = 0;
    let resize!: ResizeObserverCallback;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => { frames.delete(key); });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize ??= callback; }
      observe() {} disconnect() {}
    });
    const input = { ...baseInput(), renderNodes: true };
    const harness = renderHookHarness(input);
    frames.clear();
    const scroller = harness.container.querySelector<HTMLElement>('[data-testid=scroll-container]')!;
    const anchor = harness.container.querySelector<HTMLElement>('[data-anchor]')!;
    let layoutTop = 400;
    let scrollTop = 200;
    let scrollHeight = 1000;
    Object.defineProperties(scroller, {
      scrollTop: { configurable: true, get: () => scrollTop, set: value => { scrollTop = Math.max(0, value); } },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, value: 800 },
    });
    vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({ top: layoutTop - scrollTop }) as DOMRect);
    const frame = (time: number) => {
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      flushSync(() => pending.forEach(callback => callback(time)));
    };
    return { ...harness, scroller, anchor, frame,
      move: (delta: number) => { layoutTop += delta; scrollHeight += delta; },
      resize: () => resize([], {} as ResizeObserver),
      revise: () => harness.rerender({ ...input, contentRevisionInputs: ['changed'] }),
    };
  }

  it('holds the anchor through expansion, collapse and content revisions even when initially at the tail', () => {
    const h = anchoredHarness();
    try {
      latestResult!.preserveScrollPositionForResize(h.anchor);
      h.move(150); h.revise(); h.resize(); h.frame(16);
      expect(h.scroller.scrollTop).toBe(350);
      expect(h.anchor.getBoundingClientRect().top).toBe(200);
      h.move(-100); h.frame(32);
      expect(h.scroller.scrollTop).toBe(250);
      expect(h.anchor.getBoundingClientRect().top).toBe(200);
      h.frame(901);
      h.move(50); h.frame(920);
      expect(h.scroller.scrollTop).toBe(250);
    } finally { h.unmount(); }
  });

  it('extends the hold by 500 ms when deferred content resizes', () => {
    const h = anchoredHarness();
    try {
      latestResult!.preserveScrollPositionForResize(h.anchor);
      h.frame(800); h.resize();
      h.move(40); h.frame(1000);
      expect(h.anchor.getBoundingClientRect().top).toBe(200);
      h.frame(1301); h.move(40); h.frame(1320);
      expect(h.anchor.getBoundingClientRect().top).toBe(240);
    } finally { h.unmount(); }
  });

  it('stops at the top of the history instead of leaving a blank above it', () => {
    const h = anchoredHarness();
    try {
      latestResult!.preserveScrollPositionForResize(h.anchor);
      h.move(-300); h.frame(16);
      expect(h.scroller.scrollTop).toBe(0);
      expect(h.container.querySelector('.thread-scroll-slack')).toBeNull();
      expect(h.anchor.getBoundingClientRect().top).toBe(100);
    } finally { h.unmount(); }
  });

  const touch = (type: string, clientY: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'touches', { value: { item: () => ({ clientY }) } });
    return event;
  };

  it.each(['wheel', 'touch drag'])('releases the anchor on %s', (gesture) => {
    const h = anchoredHarness();
    try {
      latestResult!.preserveScrollPositionForResize(h.anchor);
      if (gesture === 'wheel') flushSync(() => h.scroller.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, deltaY: 20 })));
      else flushSync(() => { h.scroller.dispatchEvent(touch('touchstart', 10)); h.scroller.dispatchEvent(touch('touchmove', 30)); });
      h.move(100); h.frame(16);
      expect(h.scroller.scrollTop).toBe(200);
    } finally { h.unmount(); }
  });

  it('keeps holding through a tap: a touch that does not move is not a scroll', () => {
    const h = anchoredHarness();
    try {
      latestResult!.preserveScrollPositionForResize(h.anchor);
      flushSync(() => { h.scroller.dispatchEvent(touch('touchstart', 10)); h.scroller.dispatchEvent(touch('touchmove', 13)); });
      h.move(100); h.frame(16);
      expect(h.anchor.getBoundingClientRect().top).toBe(200);
    } finally { h.unmount(); }
  });
});
