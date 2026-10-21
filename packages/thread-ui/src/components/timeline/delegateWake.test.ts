import { describe, expect, it } from 'vitest';
import type { ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';
import { delegateWakeMessages } from './delegateWake';

const first = '12345678-1234-1234-1234-123456789012';
const second = '12345678-1234-1234-1234-123456789013';
const context: ThreadPeerWorkDto = { taskTurnId: 'task', messages: [
  { id: 'a', fromThreadId: first, name: 'b-lab', kind: 'result', subject: 'idle', text: null },
  { id: 'b', fromThreadId: second, name: 'reviewer', kind: 'result', subject: 'blocked', text: null },
] };
const turn = (text: string): Pick<ThreadTurnDto, 'items'> => ({ items: [{ id: 'wake', kind: 'userMessage', text, peerWork: context }] });
describe('delegate wake reports', () => {
  it('recovers multiline reports from older wake envelopes and matches sources by thread ID', () => {
    const messages = delegateWakeMessages(turn(`[Pockymoe wake: the delegates you registered a wake for have settled]\n- b-lab (${first}): idle\n  closing message: All tests passed.\n\n- Test one: PASS\n- Test two: PASS\n- reviewer (${second}): blocked, waiting on: approval\n  closing message: Please review the API.\n\nVerify results before acting on them. Full transcripts: pockymoe transcript ID --limit 1`), context);
    expect(messages[0]).toMatchObject({ state: 'idle', text: 'All tests passed.\n\n- Test one: PASS\n- Test two: PASS' });
    expect(messages[1]).toMatchObject({ state: 'blocked', text: 'Please review the API.' });
  });
  it('reads a wake that fired because a delegate is blocked, past its note line', () => {
    const messages = delegateWakeMessages(turn(`[Pockymoe wake: a delegate you registered a wake for is blocked]\nThis continues the task you delegated from: it adds information, not a new instruction.\n- b-lab (${first}): running\n- reviewer (${second}): blocked, waiting on: question\n\nVerify results before acting on them. Full transcripts: pockymoe transcript ID --limit 1`), context);
    expect(messages[0]).toMatchObject({ state: 'running', text: null });
    expect(messages[1]).toMatchObject({ state: 'blocked', text: null });
  });
  it('does not turn status into report text or parse quoted wakes without a system header', () => {
    expect(delegateWakeMessages(turn('Quoted text\n- b-lab (' + first + '): idle\n  closing message: Unrelated report'), context)[0]).toMatchObject({ state: 'idle', text: null });
    const question = { ...context, messages: [{ id: 'q', kind: 'question' as const, subject: 'Scope?', text: 'Which scope?' }] };
    expect(delegateWakeMessages(turn('No wake'), question)[0]).toMatchObject({ state: undefined, text: 'Which scope?' });
  });
});
