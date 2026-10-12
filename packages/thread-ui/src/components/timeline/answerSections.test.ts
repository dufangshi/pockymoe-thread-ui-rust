import { describe, expect, it } from 'vitest';
import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { isSubstantiveAnswer } from './answerSections';

const message = (text: string): ThreadHistoryItemDto => ({ id: 'answer', kind: 'agentMessage', text });
describe('substantive answers', () => {
  it('uses Unicode characters rather than UTF-16 units or UTF-8 bytes', () => {
    expect(isSubstantiveAnswer(message('中'.repeat(599)))).toBe(false);
    expect(isSubstantiveAnswer(message('中'.repeat(600)))).toBe(true);
    expect(isSubstantiveAnswer(message('😀'.repeat(300)))).toBe(false);
  });
  it('keeps medium structured explanations, but not ordinary checkpoints', () => {
    expect(isSubstantiveAnswer(message('## Explanation\n\n' + 'a'.repeat(150) + '\n\n' + 'b'.repeat(150)))).toBe(true);
    expect(isSubstantiveAnswer(message('| A | B |\n|---|---|\n| ' + 'x'.repeat(300) + ' | Y |'))).toBe(true);
    expect(isSubstantiveAnswer(message('Checking progress. '.repeat(20)))).toBe(false);
    expect(isSubstantiveAnswer({ ...message('Done'), responsePhase: 'final' })).toBe(true);
    expect(isSubstantiveAnswer({ ...message('x'.repeat(1000)), kind: 'reasoning' })).toBe(false);
  });
});
