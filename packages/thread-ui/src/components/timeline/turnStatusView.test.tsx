import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimelineTurn } from './timelineItems';
import { TurnStatusBar } from './turnStatus';

function activeTurn(overrides: Partial<TimelineTurn> = {}): TimelineTurn {
  return {
    id: 'turn-1',
    status: 'inProgress',
    startedAt: '2026-09-02T15:20:00.000Z',
    error: null,
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    reasoningEffortAvailable: true,
    tokenUsage: null,
    priceEstimate: null,
    items: [],
    ...overrides,
  };
}

describe('TurnStatusBar footer', () => {
  afterEach(() => vi.useRealTimers());
  it('keeps the turn subscription control inside the active footer and removes it after completion or recovery', () => {
    const slot = <button aria-pressed="true">Notify on completion</button>;
    const render = (status: TimelineTurn['status'], variant: 'header' | 'footer' = 'footer') => renderToStaticMarkup(<TurnStatusBar turn={activeTurn({ status })} variant={variant} notificationControl={slot} />);
    expect(render('inProgress')).toContain('aria-pressed="true"');
    expect(render('inProgress', 'header')).not.toContain('Notify on completion');
    expect(render('completed')).not.toContain('Notify on completion');
    expect(render('interrupted')).not.toContain('Notify on completion');
    expect(render('recovering')).not.toContain('Notify on completion');
  });
  it('merges progress into accessible dots with precise freshness boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T18:00:00Z'));
    const render = (props = {}) => renderToStaticMarkup(<TurnStatusBar turn={activeTurn()}
      variant="footer" lastActivityAt={new Date(Date.now() - 20_000).toISOString()} {...props} />);
    expect(render()).toContain('aria-label="Last progress 20s ago');
    expect(render()).not.toContain('thread-progress-age');
    for (const [age, freshness] of [[0, 'recent'], [5, 'recent'], [6, 'quiet'], [20, 'quiet'], [21, 'stale']] as const) {
      expect(render({ lastActivityAt: new Date(Date.now() - age * 1000).toISOString() })).toContain(`data-progress-freshness="${freshness}"`);
    }
    expect(render({ lastActivityAt: 'invalid' })).toContain('data-progress-freshness="unknown"');
    expect(render()).not.toContain('animate-');
    expect(render()).not.toContain('Waiting for turn to finish');
    expect(render({ lastActivityAt: new Date().toISOString() })).toContain('Last progress 0s ago');
    expect(render({ lastActivityAt: new Date(Date.now() - 174_000).toISOString() })).toContain('2 min without new output');
    expect(render({ lastActivityAt: new Date(Date.now() - 174_000).toISOString() })).not.toContain('background-color');
    expect(render({ backgroundAgentCount: 1 })).toContain('1 background agent running');
    expect(render({ turn: activeTurn({ status: 'completed' }) })).not.toContain('Last progress');
    expect(render({ turn: activeTurn({ status: 'recovering' }) })).not.toContain('Last progress');
  });
  it('explains background work after a reply and clears the label when the turn ends', () => {
    const html = renderToStaticMarkup(
      <TurnStatusBar turn={activeTurn()} variant="footer" backgroundAgentCount={1} />,
    );
    expect(html).toContain('1 background agent running');
    expect(html).not.toContain('animate-pulse');
    expect(html).toContain('gpt-5.4 · medium');
    const done = renderToStaticMarkup(
      <TurnStatusBar turn={activeTurn({ status: 'completed' })} variant="footer" backgroundAgentCount={1} />,
    );
    expect(done).not.toContain('background agent');
    const confirming = renderToStaticMarkup(
      <TurnStatusBar turn={activeTurn({ status: 'recovering' })} variant="footer" backgroundAgentCount={1} />,
    );
    expect(confirming).not.toContain('background agent');
  });

  it('renders a compact transparent summary without unavailable cost or tokens', () => {
    const now = Date.now();
    const html = renderToStaticMarkup(
      <TurnStatusBar
        turn={activeTurn({
          startedAt: new Date(now - 72_000).toISOString(),
        })}
        variant="footer"
        lastActivityAt="2026-09-02T15:20:48.000Z"
      />,
    );

    expect(html).toContain('thread-graph-turn-footer');
    expect(html).toContain('gpt-5.4 · medium');
    expect(html).toContain('1m 12s');
    expect(html).not.toContain('animate-');
    expect(html).not.toContain('token-badge');
    expect(html).not.toContain('>--<');
  });

  it('shows reported cost, including a real zero estimate', () => {
    const priceEstimate: NonNullable<TimelineTurn['priceEstimate']> = {
      pricingModelKey: 'gpt-5.4',
      pricingTierKey: 'standard',
      currency: 'USD',
      inputUsd: 0.01,
      cachedInputUsd: 0,
      outputUsd: 0.02,
      totalUsd: 0.03,
    };
    const pricedHtml = renderToStaticMarkup(
      <TurnStatusBar
        turn={activeTurn({ priceEstimate })}
        variant="footer"
      />,
    );
    const zeroHtml = renderToStaticMarkup(
      <TurnStatusBar
        turn={activeTurn({
          priceEstimate: { ...priceEstimate, totalUsd: 0 },
        })}
        variant="footer"
      />,
    );

    expect(pricedHtml).toContain('$0.030');
    expect(zeroHtml).toContain('$0');
  });

  it('shows a compact live total and model effort without inline token breakdowns', () => {
    const total = { totalTokens: 3500, inputTokens: 1500, outputTokens: 2000, cachedInputTokens: 500, reasoningOutputTokens: 800 };
    const html = renderToStaticMarkup(
      <TurnStatusBar
        turn={activeTurn({
          reasoningEffortAvailable: null,
          tokenUsage: { total, last: total, modelContextWindow: 128000 },
        })}
        variant="footer"
      />,
    );
    expect(html).toContain('gpt-5.4 · medium');
    // No price: the cost button shows the total once, and says the price is unknown.
    expect(html).toContain('3.5K tokens, API price unknown');
    expect(html).not.toContain('1K in');
    expect(html).not.toContain('2K out');
    expect(html).not.toContain('500 cached');
    expect(html).not.toContain('$0');
  });
});
