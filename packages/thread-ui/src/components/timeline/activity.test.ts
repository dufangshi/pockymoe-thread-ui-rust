import { describe, expect, it } from 'vitest';
import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { activityFromItems, activityParts, itemsDuration, logStatus, toolResultText, turnActivity, turnChangedFiles } from './activity';

const item = (kind: ThreadHistoryItemDto['kind'], extra: Partial<ThreadHistoryItemDto> = {}): ThreadHistoryItemDto => ({ id: kind, kind, text: kind, ...extra });

describe('transcript activity', () => {
  it('counts operation kinds, edit deltas and failures without counting messages or notices', () => {
    expect(activityFromItems([
      item('commandExecution', { status: 'error' }), item('commandExecution', { status: 'cancelled' }),
      item('fileChange', { changedFiles: 2, addedLines: 64, removedLines: 3 }), item('fileChange'),
      item('fileRead'), item('webSearch'), item('toolCall'), item('skillToolCall', { status: 'denied' }),
      item('agentToolCall'), item('reasoning'), item('userMessage', { status: 'failed' }), item('agentMessage'), item('other'),
    ])).toEqual({ commands: 2, fileChanges: 2, changedFiles: 2, addedLines: 64, removedLines: 3,
      reads: 1, searches: 1, tools: 2, agents: 1, reasoning: 1, failed: 2 });
  });

  it('uses loaded counts once items are hydrated, ignoring stale server counts', () => {
    const items = [item('commandExecution')];
    expect(turnActivity({ hasDeferredItems: false, activity: { commands: 99, reads: 20 } }, items)).toEqual(activityFromItems(items));
    expect(turnActivity({}, [])).toEqual(activityFromItems([]));
  });

  it('falls back to loaded operations or null for deferred turns without server counts', () => {
    expect(turnActivity({ hasDeferredItems: true }, [item('agentMessage')])).toBeNull();
    const items = [item('fileRead')];
    expect(turnActivity({ hasDeferredItems: true }, items)).toEqual(activityFromItems(items));
  });

  it('merges each deferred count by maximum instead of adding overlapping operations', () => {
    const loaded = [item('commandExecution', { status: 'failed' }), item('fileChange', { changedFiles: 3, addedLines: 64, removedLines: 1 }), item('toolCall')];
    expect(turnActivity({ hasDeferredItems: true, activity: {
      commands: 6, fileChanges: 2, changedFiles: 2, addedLines: 10, removedLines: 3,
      reads: 4, searches: 2, tools: 0, agents: 1, reasoning: 5, failed: 0,
    } }, loaded)).toEqual({ commands: 6, fileChanges: 2, changedFiles: 3, addedLines: 64, removedLines: 3,
      reads: 4, searches: 2, tools: 1, agents: 1, reasoning: 5, failed: 1 });
  });

  it('orders summary parts with edit and failure tones', () => {
    const counts = { ...activityFromItems([]), commands: 6, fileChanges: 1, changedFiles: 2, addedLines: 64, removedLines: 3,
      reads: 4, searches: 2, agents: 1, tools: 3, reasoning: 7, failed: 1 };
    expect(activityParts(counts)).toEqual([
      { key: 'edits', text: 'edited 2 files' }, { key: 'added', text: '+64', tone: 'add' }, { key: 'removed', text: '−3', tone: 'remove' },
      { key: 'commands', text: '6 commands' }, { key: 'reads', text: 'Read 4 files' }, { key: 'searches', text: '2 searches' },
      { key: 'agents', text: '1 subagent' }, { key: 'tools', text: '3 tool calls' }, { key: 'failed', text: '1 failed', tone: 'failed' },
    ]);
    expect(activityParts(counts, { lines: false }).map(part => part.key)).toEqual(['edits', 'commands', 'reads', 'searches', 'agents', 'tools', 'failed']);
    expect(activityParts({ ...activityFromItems([]), fileChanges: 2 })[0]?.text).toBe('edited 2 files');
    expect(activityParts(activityFromItems([]))).toEqual([]);
    expect(activityParts(activityFromItems([item('reasoning')])).map(part => part.key)).toEqual(['reasoning']);
  });

  it.each([
    [undefined, 'done'], [null, 'done'], ['', 'done'], ['completed', 'done'], ['success', 'done'],
    [' FAILED ', 'failed'], ['error', 'failed'], ['declined', 'failed'], ['denied', 'failed'], ['rejected', 'failed'],
    ['interrupted', 'interrupted'], ['cancelled', 'interrupted'], ['aborted', 'interrupted'], ['stopped', 'interrupted'],
    ['inProgress', 'running'], ['running', 'running'], ['pending', 'running'], ['started', 'running'],
  ])('normalizes status %s to %s', (status, expected) => expect(logStatus(status)).toBe(expected));

  it.each([
    ['Tool: shell\n\nInput:\n{}\n\nOutput:\n"line one\\nline two\\n"', 'line one\nline two'],
    ['Tool: lookup\n\nResult:\nplain result', 'plain result'],
    ['Tool: shell\n\nOutput:\n```text\nhello\nworld\n```', 'hello\nworld'],
    ['  unstructured output\n', 'unstructured output'],
    ['Tool: x\n\nOutput:\n"invalid json\\x"', '"invalid json\\x"'],
  ])('extracts output from stored detail %#', (detail, expected) => expect(toolResultText(detail)).toBe(expected));

  it('measures the timestamp span independent of item ordering and ignores invalid dates', () => {
    expect(itemsDuration([
      item('commandExecution', { createdAt: '2026-10-10T10:00:05Z', updatedAt: '2026-10-10T10:00:12Z' }),
      item('fileRead', { createdAt: '2026-10-10T10:00:00Z' }), item('toolCall', { createdAt: 'invalid', updatedAt: 'invalid' }),
    ])).toBe(12000);
    expect(itemsDuration([])).toBeNull();
    expect(itemsDuration([item('fileRead', { createdAt: '2026-10-10T10:00:00Z' })])).toBeNull();
    expect(itemsDuration([item('fileRead', { updatedAt: '2026-10-10T10:00:00Z' })])).toBeNull();
  });
});

describe('turnChangedFiles', () => {
  it('uses the Supervisor list for a folded turn and loaded edits otherwise', () => {
    const files = [{ path: 'src/a.ts', itemId: 'e1', addedLines: 3 }];
    expect(turnChangedFiles({ hasDeferredItems: true, activity: { fileChanges: 1, files } }, [])).toBe(files);
    expect(turnChangedFiles({ hasDeferredItems: true, activity: { commands: 2 } }, [])).toEqual([]);
    expect(turnChangedFiles({}, [
      { id: 'e1', kind: 'fileChange', text: 'src/a.ts, src/b.ts', status: 'completed', addedLines: 4, removedLines: 1 },
      { id: 'x', kind: 'fileChange', text: 'src/fail.ts', status: 'failed', addedLines: 9 },
      { id: 'e2', kind: 'fileChange', text: 'src/a.ts', status: 'completed', addedLines: 2 },
      { id: 'c', kind: 'commandExecution', text: 'ls', status: 'completed' },
    ])).toEqual([
      { path: 'src/a.ts', itemId: 'e2', addedLines: 6, removedLines: 1 },
      { path: 'src/b.ts', itemId: 'e1', addedLines: 0, removedLines: 0 },
    ]);
  });
});
