import { describe, expect, it } from 'vitest';
import { describeTurnError } from './turnErrors';
import { formatDurationSeconds } from './durationFormatting';
import { setLocale } from '../../i18n';

describe('describeTurnError', () => {
  it('names common harness failures in one readable sentence and keeps the raw error as detail', () => {
    setLocale('en', false);
    const raw = 'ACP session/prompt failed: {"code":-32603,"data":{"errorKind":"rate_limit"},"message":"Internal error: You\'ve hit your monthly spend limit."}';
    expect(describeTurnError(raw)).toEqual({ message: expect.stringContaining('usage limit'), detail: raw });
    expect(describeTurnError('Backend connection lost before completion was confirmed: ACP reader failed').message).toContain('connection to the harness ended');
    expect(describeTurnError('something odd')).toEqual({ message: 'This turn did not finish: something odd', detail: null });
  });
});

describe('formatDurationSeconds', () => {
  it('writes one duration format per language; hours drop the seconds', () => {
    setLocale('en', false);
    expect(formatDurationSeconds(72)).toBe('1m 12s');
    expect(formatDurationSeconds(65)).toBe('1m 05s');
    expect(formatDurationSeconds(65, { pad: false })).toBe('1m 5s');
    expect(formatDurationSeconds(3 * 3600 + 6 * 60 + 9, { pad: false })).toBe('3h 6m');
    setLocale('zh-CN', false);
    expect(formatDurationSeconds(39 * 60 + 24)).toBe('39 分 24 秒');
    expect(formatDurationSeconds(5)).toBe('5 秒');
    setLocale('en', false);
  });
});
