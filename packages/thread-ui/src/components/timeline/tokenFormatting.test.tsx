import { describe, expect, it } from 'vitest';

import {
  buildTurnPriceBadge,
  buildTurnTokenBadges,
  buildTurnTokenDetails,
  formatCompactTokenCount,
  formatCompactUsd,
  formatDetailedUsd,
} from './tokenFormatting';
import type { TimelineTurn } from './timelineItems';

function turn(
  extra: Partial<TimelineTurn> = {},
): TimelineTurn {
  return {
    id: 'turn-1',
    startedAt: null,
    status: 'completed',
    error: null,
    model: 'gpt',
    reasoningEffort: 'medium',
    reasoningEffortAvailable: true,
    tokenUsage: null,
    priceEstimate: null,
    items: [],
    ...extra,
  };
}

describe('timeline token formatting', () => {
  it('formats token counts compactly', () => {
    expect(formatCompactTokenCount(0)).toBe('0');
    expect(formatCompactTokenCount(999.4)).toBe('999');
    expect(formatCompactTokenCount(1_250)).toBe('1.3k');
    expect(formatCompactTokenCount(12_500)).toBe('13k');
    expect(formatCompactTokenCount(1_250_000)).toBe('1.3m');
    expect(formatCompactTokenCount(4_207_000_000)).toBe('4.2b');
    expect(formatCompactTokenCount(12_500_000)).toBe('13m');
  });

  it('formats compact and detailed USD values', () => {
    expect(formatCompactUsd(0)).toBe('$0');
    expect(formatCompactUsd(0.0004)).toBe('<$0.001');
    expect(formatCompactUsd(0.0123)).toBe('$0.012');
    expect(formatCompactUsd(0.12)).toBe('$0.12');
    expect(formatCompactUsd(1.2)).toBe('$1.2');
    expect(formatCompactUsd(12)).toBe('$12');
    expect(formatCompactUsd(125)).toBe('$125');
    expect(formatDetailedUsd(0.12345)).toBe('$0.1235');
  });

  it('splits input, cached input, output, and reasoning token details', () => {
    const details = buildTurnTokenDetails(
      turn({
        tokenUsage: {
          total: {
            inputTokens: 1_500,
            cachedInputTokens: 500,
            outputTokens: 2_000,
            reasoningOutputTokens: 800,
            totalTokens: 3_500,
          },
          last: {
            inputTokens: 1_500,
            cachedInputTokens: 500,
            outputTokens: 2_000,
            reasoningOutputTokens: 800,
            totalTokens: 3_500,
          },
          modelContextWindow: 128_000,
        },
        priceEstimate: {
          pricingModelKey: 'gpt',
          pricingTierKey: 'standard',
          currency: 'USD',
          inputUsd: 0.03,
          cachedInputUsd: 0.002,
          outputUsd: 0.2,
          totalUsd: 0.232,
        },
      }),
    );

    const presentableDetails = details.map((detail) => ({
      id: detail.id,
      label: detail.label,
      tokenCompactValue: detail.tokenCompactValue,
      tokenRawValue: detail.tokenRawValue,
      usdCompactValue: detail.usdCompactValue,
      className: detail.className,
      hasIcon: Boolean(detail.icon),
    }));

    expect(presentableDetails).toEqual([
      {
        id: 'in',
        label: 'Uncached input',
        tokenCompactValue: '1k',
        tokenRawValue: 1_000,
        usdCompactValue: '$0.0300',
        className: 'token-badge-in',
        hasIcon: true,
      },
      {
        id: 'cache',
        label: 'Cache read',
        tokenCompactValue: '500',
        tokenRawValue: 500,
        usdCompactValue: '$0.0020',
        className: 'token-badge-cache',
        hasIcon: true,
      },
      {
        id: 'out',
        label: 'Output',
        tokenCompactValue: '1.2k',
        tokenRawValue: 1_200,
        usdCompactValue: '$0.1200',
        className: 'token-badge-out',
        hasIcon: true,
      },
      {
        id: 'reason',
        label: 'Reasoning',
        tokenCompactValue: '800',
        tokenRawValue: 800,
        usdCompactValue: '$0.0800',
        className: 'token-badge-reason',
        hasIcon: true,
      },
    ]);
    expect(details[0]?.usdRawValue).toBeCloseTo(0.03);
    expect(details[1]?.usdRawValue).toBeCloseTo(0.002);
    expect(details[2]?.usdRawValue).toBeCloseTo(0.12);
    expect(details[3]?.usdRawValue).toBeCloseTo(0.08);
  });

  it('clamps malformed token breakdowns instead of emitting negative badges', () => {
    const details = buildTurnTokenDetails(
      turn({
        tokenUsage: {
          total: {
            inputTokens: 100,
            cachedInputTokens: 250,
            outputTokens: 50,
            reasoningOutputTokens: 80,
            totalTokens: 150,
          },
          last: {
            inputTokens: 100,
            cachedInputTokens: 250,
            outputTokens: 50,
            reasoningOutputTokens: 80,
            totalTokens: 150,
          },
          modelContextWindow: null,
        },
      }),
    );

    expect(details.map((detail) => [detail.id, detail.tokenRawValue])).toEqual([
      ['cache', 250],
      ['reason', 80],
    ]);
  });

  it('shows cache writes separately from uncached and cached input', () => {
    const details = buildTurnTokenDetails(
      turn({
        tokenUsage: {
          total: {
            inputTokens: 1_500,
            cachedInputTokens: 500,
            cacheWriteInputTokens: 200,
            outputTokens: 0,
            reasoningOutputTokens: 0,
            totalTokens: 1_500,
          },
          last: {
            inputTokens: 1_500,
            cachedInputTokens: 500,
            cacheWriteInputTokens: 200,
            outputTokens: 0,
            reasoningOutputTokens: 0,
            totalTokens: 1_500,
          },
          modelContextWindow: 1_050_000,
        },
        priceEstimate: {
          pricingModelKey: 'gpt-5.6-sol',
          pricingTierKey: 'standard',
          currency: 'USD',
          inputUsd: 0.004,
          cachedInputUsd: 0.00025,
          cacheWriteInputUsd: 0.00125,
          outputUsd: 0,
          totalUsd: 0.0055,
        },
      }),
    );

    expect(details.map((detail) => ({
      id: detail.id,
      tokens: detail.tokenRawValue,
      usd: detail.usdRawValue,
    }))).toEqual([
      { id: 'in', tokens: 800, usd: 0.004 },
      { id: 'cache', tokens: 500, usd: 0.00025 },
      { id: 'cache-write', tokens: 200, usd: 0.00125 },
    ]);
  });

  it('builds compact header badges and unavailable price labels', () => {
    const currentTurn = turn({
      tokenUsage: {
        total: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 1,
        },
        last: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 1,
        },
        modelContextWindow: null,
      },
    });

    expect(buildTurnTokenBadges(currentTurn).map((badge) => badge.title)).toEqual([
      'Uncached input: 1 tokens',
    ]);
    expect(buildTurnPriceBadge(currentTurn)).toEqual({
      label: '--',
      title: 'Price estimate unavailable for this model.',
      className: 'token-badge-empty',
    });
  });

  it('builds total price badges when estimates are available', () => {
    expect(
      buildTurnPriceBadge(
        turn({
          priceEstimate: {
            pricingModelKey: 'gpt',
            pricingTierKey: 'standard',
            currency: 'USD',
            inputUsd: 0.01,
            cachedInputUsd: 0,
            outputUsd: 0.02,
            totalUsd: 0.03,
          },
        }),
      ),
    ).toEqual({
      label: '$0.030',
      title: 'Estimated cost: $0.0300',
      className: 'token-badge-total',
    });
  });
});
