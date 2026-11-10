import type { ThreadContextStepDto, ThreadContextStepsDto } from '@pockymoe/shared';
import { describe, expect, it } from 'vitest';

import { changeLimit, contextStatistics, formatDuration, formatRatio, groupTokens, niceCeiling, trendDelta, trendPoints } from './contextStepsModel';

const step = (turn: number, index: number, over: Partial<ThreadContextStepDto> = {}): ThreadContextStepDto => ({
  seq: turn * 10 + index, turnId: `t${turn}`, turn, step: index, at: '2026-11-10T10:00:00Z',
  inputTokens: 1000, cachedInputTokens: 800, cacheWriteInputTokens: 0, outputTokens: 50, reasoningOutputTokens: 0,
  modelMs: 2000, toolMs: 500, ...over,
});

describe('context steps', () => {
  it('groups categories by palette slot and leaves an undescribed request unsplit', () => {
    const described = groupTokens(step(1, 1, { categories: { system_prompt: 100, mcp_instructions: 20, system_tools: 300, user_messages: 40, assistant_messages: 10, reasoning: 5, tool_calls: 15, tool_results: 60, injected: 7, unattributed: 3, something_new: 2 } }));
    expect(described).toEqual({ split: true, groups: { 1: 120, 2: 300, 5: 40, 6: 30, 7: 60, 8: 7, 0: 5 } });
    expect(groupTokens(step(1, 2))).toEqual({ split: false, groups: { 0: 1000 } });
  });

  it('draws a point per request, or per turn with the turn added up', () => {
    const steps = [
      step(1, 1, { categories: { system_prompt: 100, user_messages: 10 } }),
      step(1, 2, { categories: { system_prompt: 100, user_messages: 10, tool_results: 50 }, inputTokens: 1200 }),
      step(2, 1, { categories: { system_prompt: 100, user_messages: 30, tool_results: 50 } }),
    ];
    const bySteps = trendPoints(steps, 'step');
    expect(bySteps.map((point) => [point.key, point.total])).toEqual([['1:1', 110], ['1:2', 160], ['2:1', 180]]);
    const byTurns = trendPoints(steps, 'turn');
    expect(byTurns.map((point) => [point.key, point.total, point.step, point.inputTokens, point.modelMs])).toEqual([
      ['turn:1', 160, 2, 2200, 4000],
      ['turn:2', 180, 1, 1000, 2000],
    ]);
    // What changed: only the groups that did.
    expect(trendDelta(bySteps[1]!, bySteps[0])).toEqual({ 7: 50 });
    expect(trendDelta(bySteps[2]!, bySteps[1])).toEqual({ 5: 20 });
    expect(trendDelta(bySteps[0]!, undefined)).toEqual({ 1: 100, 5: 10 });
    // Beside an unsplit request only the totals compare.
    const unsplit = trendPoints([step(3, 1, { inputTokens: 500 })], 'step')[0]!;
    expect(trendDelta(unsplit, bySteps[2])).toEqual({ 0: 320 });
  });

  it('computes cache hits, the cumulative makeup and time from the thread totals', () => {
    const data: ThreadContextStepsDto = {
      turnCount: 2,
      totals: { usageTurns: 2, inputTokens: 10_000, cachedInputTokens: 6_304, cacheWriteInputTokens: 100, outputTokens: 500, reasoningOutputTokens: 20, modelTimeMs: 30_000, wallTimeMs: 45_000, outputTimeMs: 10_000, timedOutputTokens: 490 },
      steps: [step(1, 1, { categories: { system_prompt: 100, tool_results: 10 } }), step(1, 2), step(2, 1, { categories: { system_prompt: 100, tool_results: 40 } })],
    };
    const stats = contextStatistics(data);
    expect(formatRatio(stats.cacheHit!)).toBe('63.0%');
    expect(stats.cumulative).toEqual({ 1: 200, 7: 50 });
    expect([stats.cumulativeTotal, stats.cumulativeSteps, stats.recordedSteps]).toEqual([250, 2, 3]);
    expect([stats.modelMs, stats.otherMs, stats.outputTokensPerSecond]).toEqual([30_000, 15_000, 49]);
    const empty = contextStatistics({ turnCount: 0, steps: [], totals: { ...data.totals, inputTokens: 0, cachedInputTokens: 0, outputTimeMs: 0 } });
    expect([empty.cacheHit, empty.outputTokensPerSecond]).toEqual([null, null]);
  });

  it('keeps one huge change from flattening the scale of the usual ones', () => {
    // A first request among ordinary steps is cut; a spread of sizes is not.
    expect(changeLimit([45_000, ...Array.from({ length: 20 }, (_, index) => 900 + index * 50)])).toBe(3_600);
    expect(changeLimit([50_000, 15_000, 6_000, 14_000, 13_000, 9_000, 13_000])).toBe(50_000);
    expect([changeLimit([]), changeLimit([0, 700])]).toEqual([0, 700]);
  });

  it('formats axes, durations and small shares', () => {
    expect([0, 7, 14_900, 59_600, 100_000].map(niceCeiling)).toEqual([1, 10, 20_000, 100_000, 100_000]);
    expect([850, 12_340, 245_000, 3_720_000].map(formatDuration)).toEqual(['850ms', '12.3s', '4m05s', '1h02m']);
    expect([0, 0.0004, 0.5].map(formatRatio)).toEqual(['0.0%', '<0.1%', '50.0%']);
  });
});
