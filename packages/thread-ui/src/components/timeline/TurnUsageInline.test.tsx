/** @vitest-environment jsdom */
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { ThreadTimeline } from '../ThreadTimeline';
import { TurnStatusBar } from './turnStatus';
import { TurnUsageInline } from './TurnUsageInline';

const total = {
  totalTokens: 3500,
  inputTokens: 1500,
  outputTokens: 2000,
  cachedInputTokens: 500,
  reasoningOutputTokens: 800,
};
const turn: ThreadTurnDto = {
  id: 'turn-usage',
  startedAt: '2026-09-05T10:00:00.000Z',
  completedAt: '2026-09-05T10:01:12.000Z',
  status: 'completed',
  error: null,
  model: 'gpt-6-astra',
  reasoningEffort: 'high',
  tokenUsage: { total, last: total, modelContextWindow: 1050000, generationSpeed: {
    outputTokens: 2000, llmTimeMs: 20000, averageTokensPerSecond: 100,
    recentTokensPerSecond: 80, windowSeconds: 60, active: false, state: 'llm',
    measurement: 'usageIntervals', updatedAt: '2026-09-05T10:01:12.000Z',
  } },
  priceEstimate: {
    pricingModelKey: 'gpt-6-astra',
    pricingTierKey: 'standard',
    currency: 'USD',
    inputUsd: 0.01,
    cachedInputUsd: 0.0005,
    outputUsd: 0.1,
    totalUsd: 0.1105,
  },
  items: [
    { id: 'user-1', kind: 'userMessage', text: 'Check the fix.' },
    {
      id: 'command-1',
      kind: 'commandExecution',
      text: 'cargo test',
      status: 'completed',
    },
    { id: 'agent-1', kind: 'agentMessage', text: 'Fixed.' },
  ],
};

describe('turn usage in the visible timeline', () => {
  it.each([true, false])('keeps live usage only in the footer with recent speed (measured=%s)', measured => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const liveTurn: ThreadTurnDto = { ...turn, status: 'inProgress', completedAt: null, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, active: true,
      ...(measured ? { averageOutputTokensPerSecond: 120, latestOutputTokensPerSecond: 150, latestOutputTimeMs: 10000 } : {}),
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[liveTurn]} activeTurnId={turn.id} liveOutput="Working..." />));
      const summary = container.querySelector('.thread-graph-worked-summary [data-testid="turn-token-speed"]');
      const footer = container.querySelector('.thread-graph-turn-footer [data-testid="turn-token-speed"]');
      expect(summary).toBeNull();
      // The head says it is running; speed and cost wait for the turn to end.
      expect(container.querySelector('.thread-turn-head-live')?.getAttribute('aria-label')).toMatch(/^running \d.*s$/);
      expect(container.querySelector('.thread-turn-head-speed')).toBeNull();
      expect(footer?.textContent).toBe(`${measured ? '150.0' : '80.0'}`);
    } finally { flushSync(() => root.unmount()); }
  });

  it('uses the trailing-minute speed live, rather than the completed whole-turn speed', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={{...turn,status:'inProgress'}} />));
      expect(container.querySelector('[data-testid="turn-token-speed"]')?.textContent).toBe('80.0');
    } finally { flushSync(() => root.unmount()); }
  });
  it('uses the latest confirmed response speed without diluting it with pending reply time', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={{...turn,status:'inProgress', tokenUsage:{...turn.tokenUsage!,generationSpeed:{...turn.tokenUsage!.generationSpeed!,
        latestOutputTokensPerSecond:150, latestOutputTimeMs:10000, latestOutputMeasuredAt:'2026-09-05T10:01:00Z'}}}} />));
      const speed = container.querySelector('[data-testid="turn-token-speed"]');
      expect(speed?.textContent).toBe('150.0');
      expect(speed?.getAttribute('title')).toContain('Latest confirmed response, 10 seconds');
      expect(speed?.getAttribute('title')).toContain('not on each text chunk');
    } finally { flushSync(() => root.unmount()); }
  });
  it('retains the full token breakdown behind the price button', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={turn} />));
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-usage-price')!.click());
      expect(document.querySelector('[aria-label="Uncached input: 1,000 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Cache read: 500 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Output: 1,200 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Reasoning: 800 tokens"]')).not.toBeNull();
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });
  it('opens on the first touch even when focus arrives before click, then closes on the next press', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={turn} />));
      const button = container.querySelector<HTMLButtonElement>('.thread-turn-usage-price')!;
      flushSync(() => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      flushSync(() => button.focus());
      expect(button.getAttribute('aria-expanded')).toBe('true');
      flushSync(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(button.getAttribute('aria-expanded')).toBe('true');
      flushSync(() => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      flushSync(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(button.getAttribute('aria-expanded')).toBe('false');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });
  it.each([true, false])(
    'opens the turn with its time, model, cost and speed above the prompt when collapsed=%s',
    (collapsed) => {
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      try {
        flushSync(() =>
          root.render(
            <ThreadTimeline
              turns={[turn]}
              liveOutput=""
              autoCollapseCompletedTurns={collapsed}
            />,
          ),
        );
        const summary = container.querySelector('.thread-graph-worked-summary');
        expect(summary?.textContent).toContain('Worked for 1m 12s');
        expect(summary?.querySelector('.thread-turn-usage')).toBeNull();
        expect(container.querySelector('.thread-turn-receipt')).toBeNull();
        const head = container.querySelector('.thread-turn-head')!;
        expect(head.compareDocumentPosition(container.querySelector('[data-role="user"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(head.querySelector('time')?.getAttribute('dateTime')).toBe(turn.startedAt);
        expect(head.textContent).toContain('gpt-6-astra · high');
        expect(head.textContent).toContain('$0.11');
        expect(head.querySelector('.thread-turn-head-speed')?.textContent).toBe('100.0 tok/s');
        expect(head.querySelector('button button')).toBeNull();
        // Tapping the line shows when it started and ended, the time taken and the tokens.
        const main = head.querySelector<HTMLButtonElement>('.thread-turn-head-main')!;
        expect(main.getAttribute('aria-expanded')).toBe('false');
        flushSync(() => main.click());
        expect(main.getAttribute('aria-expanded')).toBe('true');
        const rows = [...container.querySelectorAll('.thread-turn-head-detail dt')].map(node => node.textContent);
        expect(rows).toEqual(['Started', 'Finished', 'Took', 'Model', 'Tokens', 'Speed']);
        expect(container.querySelector('.thread-turn-head-detail')?.textContent).toContain('1m 12s');
        expect(container.querySelector('.thread-turn-head-detail')?.textContent).toContain('3.5k');
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  );

  it('breaks the combined speed into first token, prefill and decode when tapped', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const split: ThreadTurnDto = { ...turn, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, averageOutputTokensPerSecond: 100, outputTimeMs: 20000,
      firstTokenMs: 1500, firstTokenRequests: 2, prefillTokens: 5000, prefillCachedTokens: 18000, prefillTokensPerSecond: 1666.7,
      decodeTokens: 1800, decodeMs: 12000, decodeTokensPerSecond: 150,
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[split]} liveOutput="" />));
      const speed = container.querySelector<HTMLButtonElement>('button.thread-turn-head-speed')!;
      expect(speed.textContent).toBe('100.0 tok/s');
      await act(async () => speed.click());
      const details = document.querySelector('.thread-speed-details')!;
      expect(details.textContent).toContain('First token');
      expect(details.textContent).toContain('1.5 s average · 2 requests');
      expect(details.textContent).toContain('Prefill');
      expect(details.textContent).toContain('1,667 tok/s · 5k uncached');
      expect(details.textContent).toContain('Decode');
      expect(details.textContent).toContain('150.0 tok/s · 1.8k in 12 s');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });

  it.each(['failed', 'interrupted'] as const)('opens %s turns with the same head', status => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[{ ...turn, status }]} liveOutput="" />));
      const head = container.querySelector('.thread-turn-head');
      expect(head?.textContent).toContain('gpt-6-astra · high');
      expect(head?.querySelector('.thread-turn-head-speed')?.textContent).toBe('100.0 tok/s');
      expect(container.querySelector('.thread-graph-worked-summary [data-testid="turn-token-speed"]')).toBeNull();
    } finally { flushSync(() => root.unmount()); }
  });

  it('shows duration without a date in the compact footer', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnStatusBar turn={turn} variant="footer" />));
      expect(container.querySelector('time')).toBeNull();
      expect(container.querySelector('.thread-graph-turn-footer-meta')?.textContent).toBe('1m 12s');
    } finally { flushSync(() => root.unmount()); }
  });

  it('shows a completed summary even with no hidden tool activities', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() =>
        root.render(
          <ThreadTimeline
            turns={[
              {
                ...turn,
                items: turn.items.filter(
                  (item) => item.kind !== 'commandExecution',
                ),
              },
            ]}
            liveOutput=""
          />,
        ),
      );
      expect(
        container.querySelector('.thread-turn-head')?.textContent,
      ).toContain('gpt-6-astra · high');
    } finally {
      flushSync(() => root.unmount());
    }
  });
});
