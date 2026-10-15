import { describe, expect, it } from 'vitest';

import { parsePromptEnvelope } from './PromptEnvelope';

describe('parsePromptEnvelope', () => {
  it('reads a peer task header, its reply and urgency lines, and shortens thread ids', () => {
    expect(parsePromptEnvelope('[Pockymoe task from thread bf8cee0b-f8f6-4f33-bac6-40ae6713768c | Fix the queue]\nIn reply to message m1\nImmediate handling needed: stale input\nPlease fix it.\nThanks')).toEqual({
      type: 'peer', kind: 'task', from: 'bf8cee0b', fromThreadId: 'bf8cee0b-f8f6-4f33-bac6-40ae6713768c', subject: 'Fix the queue', urgent: 'stale input', body: 'Please fix it.\nThanks',
    });
    expect(parsePromptEnvelope('[Pockymoe result from device-a/foreign-thread (device "Peer laptop")]\nDone')).toMatchObject({
      type: 'peer', kind: 'result', fromThreadId: null, from: 'device-a/foreign-thread (device "Peer laptop")', subject: null, urgent: null, body: 'Done',
    });
  });

  it('turns inbox reminders, turn notifications and maintenance resumes into notices', () => {
    expect(parsePromptEnvelope('[Pockymoe inbox reminder: unread mail has waited at least 10 minutes]\n1 messages are waiting in your inbox.\n- status: H baseline captured\n\nRead them with `pockymoe inbox`.')).toMatchObject({
      type: 'notice', notice: 'inbox', preview: 'status: H baseline captured',
    });
    expect(parsePromptEnvelope('[Pockymoe turn notification]\nThread 61be68cd-9c04-4c72-abf0-b023219602a6, turn t1 ended with status completed at now. This describes execution status, not business success.')).toMatchObject({
      type: 'notice', notice: 'turn', preview: 'Thread 61be68cd, turn t1 ended with status completed at now',
    });
    expect(parsePromptEnvelope('The Supervisor was restarted for device maintenance, interrupting this task. Continue…')).toMatchObject({ type: 'notice', notice: 'resume' });
  });

  it('leaves a person\'s own prompts alone', () => {
    expect(parsePromptEnvelope('Please refactor [Pockymoe task from x]')).toBeNull();
    expect(parsePromptEnvelope('[Pockymoe something odd]\nbody')).toBeNull();
    expect(parsePromptEnvelope('[watchdog 2026-10-15] patrol')).toBeNull();
  });
});
