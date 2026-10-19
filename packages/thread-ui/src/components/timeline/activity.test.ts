import { describe, expect, it } from 'vitest';
import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { activityFromItems, activityParts, stretchBetween, stretchFromItems, itemsDuration, logStatus, toolResultText, turnActivity, turnChangedFiles } from './activity';

const item = (kind: ThreadHistoryItemDto['kind'], extra: Partial<ThreadHistoryItemDto> = {}): ThreadHistoryItemDto => ({ id: kind, kind, text: kind, ...extra });

describe('transcript activity', () => {
  it('counts operation kinds, edit deltas and failures without counting messages or notices', () => {
    expect(activityFromItems([
      item('commandExecution', { status: 'error' }), item('commandExecution', { status: 'cancelled' }),
      item('fileChange', { changedFiles: 2, addedLines: 64, removedLines: 3 }), item('fileChange'),
      item('fileRead'), item('webSearch'), item('toolCall'), item('skillToolCall', { status: 'denied' }),
      item('agentToolCall'), item('reasoning'), item('userMessage', { status: 'failed' }), item('agentMessage'), item('other'),
    ])).toEqual({ commands: 2, fileChanges: 2, changedFiles: 2, fileCount: 1, addedLines: 64, removedLines: 3,
      reads: 1, searches: 1, tools: 2, agents: 1, reasoning: 1, failed: 2 });
  });

  it('keeps the maximum server and loaded counts after hydration', () => {
    const items = [item('commandExecution')];
    expect(turnActivity({ hasDeferredItems: false, activity: { commands: 99, reads: 20 } }, items)).toEqual({ ...activityFromItems(items), commands: 99, reads: 20 });
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
    } }, loaded)).toEqual({ commands: 6, fileChanges: 2, changedFiles: 3, fileCount: 1, addedLines: 64, removedLines: 3,
      reads: 4, searches: 2, tools: 1, agents: 1, reasoning: 5, failed: 1 });
  });

  it('counts distinct loaded paths and prefers fileCount over patch and edit counts', () => {
    const counts = activityFromItems([
      item('fileChange', { text: 'src/a.ts, src/b.ts', changedFiles: 4, addedLines: 1 }),
      item('fileChange', { text: 'src/a.ts', changedFiles: 2, addedLines: 2 }),
      item('fileChange', { text: 'src/failed.ts', status: 'failed' }),
    ]);
    expect(counts).toMatchObject({ fileCount: 2, changedFiles: 6, fileChanges: 3, addedLines: 3 });
    expect(activityParts(counts)[0]?.text).toBe('edited 2 files');
    expect(turnActivity({ hasDeferredItems: false, activity: { fileCount: 5 } }, [item('fileChange', { text: 'src/a.ts' })])?.fileCount).toBe(5);
    expect(turnActivity({ hasDeferredItems: true, activity: { fileCount: 1 } }, [item('fileChange', { text: 'src/a.ts, src/b.ts' })])?.fileCount).toBe(2);
  });

  it('orders summary parts with edit and failure tones', () => {
    const counts = { ...activityFromItems([]), commands: 6, fileChanges: 1, changedFiles: 2, addedLines: 64, removedLines: 3,
      reads: 4, searches: 2, agents: 1, tools: 3, reasoning: 7, failed: 1 };
    expect(activityParts(counts)).toEqual([
      { key: 'edits', text: 'edited 2 files' }, { key: 'added', text: '+64', tone: 'add' }, { key: 'removed', text: '−3', tone: 'remove' },
      { key: 'commands', count: 6, text: '6 commands' }, { key: 'failed', count: 1, text: '1 failed', tone: 'failed' },
      { key: 'reads', count: 4, text: 'Read 4 files' }, { key: 'searches', count: 2, text: '2 searches' },
      { key: 'agents', count: 1, text: '1 subagent' }, { key: 'tools', count: 3, text: '3 tool calls' },
    ]);
    // Failures follow the commands they mostly are; without commands they come last.
    expect(activityParts(counts, { lines: false }).map(part => part.key)).toEqual(['edits', 'commands', 'failed', 'reads', 'searches', 'agents', 'tools']);
    expect(activityParts({ ...counts, commands: 0 }, { lines: false }).map(part => part.key)).toEqual(['edits', 'reads', 'searches', 'agents', 'tools', 'failed']);
    expect(activityParts({ ...activityFromItems([]), fileChanges: 2 })[0]?.text).toBe('edited 2 files');
    expect(activityParts(activityFromItems([]))).toEqual([]);
    expect(activityParts(activityFromItems([item('reasoning')]))).toEqual([{ key: 'reasoning', count: 1, text: 'thought once' }]);
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
    ['Output:\nimported output', 'imported output'],
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
    expect(turnChangedFiles({ hasDeferredItems: false, activity: { files } }, [item('fileChange', { text: 'other.ts' })])).toBe(files);
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

describe('folded answer stretches', () => {
  const segments = [
    { before: 'answer-1', commands: 7, startedAt: '2026-10-10T10:00:00Z', endedAt: '2026-10-10T10:00:05Z' },
    { before: 'narration', commands: 2, reads: 3, startedAt: '2026-10-10T10:00:10Z', endedAt: '2026-10-10T10:00:20Z' },
    { before: 'answer-2', commands: 1, failed: 1, searches: 2, endedAt: '2026-10-10T10:00:30Z' },
    { before: null, tools: 2 },
  ];

  it('sums every segment between answers, excluding the work before the first answer', () => {
    expect(stretchBetween(segments, 'answer-1', 'answer-2')).toEqual({
      before: 'answer-2', commands: 3, reads: 3, searches: 2, failed: 1,
      startedAt: '2026-10-10T10:00:10Z', endedAt: '2026-10-10T10:00:30Z',
    });
    expect(stretchBetween(segments, null, 'answer-1')).toEqual(segments[0]);
    expect(stretchBetween(segments, 'answer-2', null)).toEqual({ before: null, tools: 2 });
    expect(stretchBetween(segments, null, null)).toMatchObject({ commands: 10, tools: 2, failed: 1 });
  });

  it('returns null for absent boundaries, empty segments and empty tails', () => {
    expect(stretchBetween(undefined, null, null)).toBeNull();
    expect(stretchBetween([], null, null)).toBeNull();
    expect(stretchBetween(segments, 'missing', 'answer-2')).toBeNull();
    expect(stretchBetween(segments, 'answer-1', 'missing')).toBeNull();
    expect(stretchBetween(segments.slice(0, 3), 'answer-2', null)).toBeNull();
  });

  it('builds a loaded stretch with edit deltas, failed counts and timestamp bounds', () => {
    expect(stretchFromItems([
      item('fileRead', { createdAt: '2026-10-10T10:00:20Z' }),
      item('commandExecution', { status: 'failed', createdAt: '2026-10-10T10:00:10Z', updatedAt: '2026-10-10T10:00:30Z' }),
      item('fileChange', { text: 'src/a.ts', changedFiles: 1, addedLines: 64, removedLines: 3 }),
      item('agentMessage'),
    ], 'answer')).toEqual({ before: 'answer', reads: 1, commands: 1, failed: 1,
      fileChanges: 1, changedFiles: 1, addedLines: 64, removedLines: 3,
      startedAt: '2026-10-10T10:00:10Z', endedAt: '2026-10-10T10:00:30Z' });
    expect(stretchFromItems([item('toolCall')], null)).toEqual({ before: null, tools: 1 });
    expect(stretchFromItems([], 'answer')).toBeNull();
    expect(stretchFromItems([item('agentMessage'), item('userMessage')], null)).toBeNull();
  });
});
