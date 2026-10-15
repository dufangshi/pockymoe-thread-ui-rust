import { describe, expect, it } from 'vitest';

import { normalizePlanStepStatus } from './turnStatus';

describe('turn status helpers', () => {
  it('normalizes common plan step statuses', () => {
    expect(normalizePlanStepStatus('done')).toBe('completed');
    expect(normalizePlanStepStatus('in progress')).toBe('in_progress');
    expect(normalizePlanStepStatus('queued')).toBe('pending');
    expect(normalizePlanStepStatus('error')).toBe('failed');
    expect(normalizePlanStepStatus('custom')).toBe('other');
  });
});
