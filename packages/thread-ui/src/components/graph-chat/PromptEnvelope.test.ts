import { describe, expect, it } from 'vitest';

import { parsePromptEnvelope, promptEnvelopeSummary } from './PromptEnvelope';

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

  it('turns a delegate wake into a notice naming each delegate and its state', () => {
    const wake = parsePromptEnvelope('[Pockymoe wake: a delegate you registered a wake for is blocked]\nThis continues the task you delegated from: it adds information, not a new instruction.\n- xa-oil (14b40fee-0794-4fc4-ac30-9f98cc75adfa): running\n- xa-macro (dc65117b-8c4e-47db-abf1-26dc5888a8b4): blocked, waiting on: question q1\n\nVerify results before acting on them. Full transcripts: pockymoe transcript ID --limit 1');
    expect(wake).toMatchObject({ type: 'notice', notice: 'wake', preview: 'xa-oil Still running · xa-macro Awaiting an answer' });
    expect(promptEnvelopeSummary(wake!)).toEqual({ label: 'Delegate wake', preview: 'xa-oil Still running · xa-macro Awaiting an answer' });
  });

  it('reads stalled delegates, mail wakes and the question an asking delegate is blocked on', () => {
    // runtime interaction/wakes.rs and ask.rs write these.
    const stalled = parsePromptEnvelope('[Pockymoe wake: a delegate you registered a wake for is stalled]\nThis continues the task you delegated from: it adds information, not a new instruction.\n- builder (14b40fee-0794-4fc4-ac30-9f98cc75adfa): stalled, 4 failed turns in a row\n  outcome: stalled: its queue has failed to start 6 times since 2026-11-24T00:00:00Z: claude is not enabled\n\nVerify results before acting on them. Full transcripts: pockymoe transcript ID --limit 1');
    expect(stalled).toMatchObject({ notice: 'wake', preview: 'builder Cannot start' });
    const mail = parsePromptEnvelope('[Pockymoe wake: mail you registered a wake for has arrived]\nThis continues the work you were waiting on: the mail adds information, not a new instruction.\n- result "Build done" from mac-builder [Mac/dc65117b-8c4e-47db-abf1-26dc5888a8b4] · message 5b1f\n  the build passed\n- question "Which key?" from dc65117b-8c4e-47db-abf1-26dc5888a8b4 · message 77aa\n  May I?\n\nRead each in full with `pockymoe inbox read MESSAGE_ID`.');
    expect(mail).toMatchObject({ type: 'notice', notice: 'mailWake', preview: 'mac-builder: Build done · dc65117b: Which key?' });
    expect(promptEnvelopeSummary(mail!).label).toBe('Mail wake');
    const asked = parsePromptEnvelope('[Pockymoe question from thread 14b40fee-0794-4fc4-ac30-9f98cc75adfa | Which key?]\nImmediate handling needed: asker is blocked in `pockymoe thread ask` until you reply to message m1: pockymoe thread send 14b40fee-0794-4fc4-ac30-9f98cc75adfa --kind result --in-reply-to m1 --subject "..." --text "..."\nMay I use the staging key?');
    expect(asked).toMatchObject({ type: 'peer', kind: 'question', subject: 'Which key?', body: 'May I use the staging key?' });
    expect((asked as { urgent: string }).urgent).toContain('blocked in `pockymoe thread ask`');
  });

  it('leaves a person\'s own prompts alone', () => {
    expect(parsePromptEnvelope('Please refactor [Pockymoe task from x]')).toBeNull();
    expect(parsePromptEnvelope('[Pockymoe something odd]\nbody')).toBeNull();
    expect(parsePromptEnvelope('[watchdog 2026-10-15] patrol')).toBeNull();
  });
});
