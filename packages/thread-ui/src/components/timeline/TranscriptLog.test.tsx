/** @vitest-environment jsdom */
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreadHistoryItemDetailDto, ThreadHistoryItemDto } from '@pockymoe/shared';
import { ChangedFiles, diffForPath, displayPath, LogRow, LogRun, opensDiff, TranscriptLogContext, unwrapShellCommand, type TranscriptLogActions } from './TranscriptLog';

vi.mock('../graph-chat/graphChatShiki', () => ({ getGraphChatHighlighter: async () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); });
const item = (id: string, kind: ThreadHistoryItemDto['kind'] = 'commandExecution', extra: Partial<ThreadHistoryItemDto> = {}): ThreadHistoryItemDto => ({ id, kind, text: id, status: 'completed', ...extra });
const actions = (extra: Partial<TranscriptLogActions> = {}): TranscriptLogActions => ({ openCommand: vi.fn(), openToolCall: vi.fn(), openDeferred: vi.fn(), ...extra });
async function render(node: ReactNode) {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root!.render(node));
  return container;
}
async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull();
  await act(async () => button!.click());
}
const detail = (id: string, text: string): ThreadHistoryItemDetailDto => ({ id, kind: 'commandExecution', title: id, text });
function Run({ items }: { items: ThreadHistoryItemDto[] }) {
  const [expanded, setExpanded] = useState(false);
  return <LogRun items={items} expanded={expanded} onToggle={() => setExpanded(value => !value)} />;
}

describe('TranscriptLog', () => {
  it('toggles a closed run and summarizes edits, commands, failures and elapsed time', async () => {
    await render(<Run items={[
      item('cmd', 'commandExecution', { status: 'failed', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T10:00:51Z' }),
      item('edit', 'fileChange', { changedFiles: 2, addedLines: 64, removedLines: 3 }),
    ]} />);
    expect(container.querySelector('.tlog-run-head')?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.tlog-run-body')).toBeNull();
    expect(container.querySelector('.tlog-summary')?.textContent?.replace(/\s*·\s*/g, ' · ')).toBe('edited 2 files +64 −3 · 1 command · 1 failed · 51s');
    expect(container.querySelector('.tlog-run')?.getAttribute('data-failed')).toBe('true');
    await click('.tlog-run-head');
    expect(container.querySelectorAll('.tlog-row')).toHaveLength(2);
    expect(container.querySelector('.tlog-run-head')?.getAttribute('aria-expanded')).toBe('true');
    await click('.tlog-run-head');
    expect(container.querySelector('.tlog-row')).toBeNull();
  });

  it('loads details only after a row click and reuses the cache across close and remount', async () => {
    const loadDetail = vi.fn(async (id: string) => detail(id, 'Tool: shell\n\nOutput:\n"loaded output\\n"'));
    const context = actions({ loadDetail });
    const row = item('cached');
    await render(<TranscriptLogContext.Provider value={context}><Run items={[row, item('other')]} /></TranscriptLogContext.Provider>);
    expect(loadDetail).not.toHaveBeenCalled();
    await click('.tlog-run-head');
    expect(loadDetail).not.toHaveBeenCalled();
    await click('.tlog-row-head');
    expect(loadDetail).toHaveBeenCalledExactlyOnceWith('cached');
    expect(container.querySelector('.tlog-output')?.textContent).toBe('loaded output');
    await click('.tlog-row-head');
    await click('.tlog-row-head');
    expect(loadDetail).toHaveBeenCalledTimes(1);
    await click('.tlog-run-head');
    await click('.tlog-run-head');
    await click('.tlog-row-head');
    expect(container.querySelector('.tlog-output')?.textContent).toBe('loaded output');
    expect(loadDetail).toHaveBeenCalledTimes(1);
    await click('.tlog-open');
    expect(context.openCommand).toHaveBeenCalledWith(row, 'Command Output');
  });

  it('keys completed details by both item id and status', async () => {
    const loadDetail = vi.fn(async (id: string) => detail(id, `output ${loadDetail.mock.calls.length}`));
    const context = actions({ loadDetail });
    const node = (status: string) => <TranscriptLogContext.Provider value={context}><LogRow item={item('status-change', 'commandExecution', { status })} defaultOpen /></TranscriptLogContext.Provider>;
    await render(node('completed'));
    expect(loadDetail).toHaveBeenCalledTimes(1);
    await act(async () => root!.render(node('failed')));
    expect(loadDetail).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.tlog-output')?.textContent).toBe('output 2');
    await act(async () => root!.render(node('completed')));
    expect(loadDetail).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.tlog-output')?.textContent).toBe('output 1');
  });

  it('reloads running details on reopening and does not cache them for completion', async () => {
    const loadDetail = vi.fn(async (id: string) => detail(id, `snapshot ${loadDetail.mock.calls.length}`));
    const context = actions({ loadDetail });
    const node = (status: string) => <TranscriptLogContext.Provider value={context}><LogRow item={item('live', 'commandExecution', { status })} /></TranscriptLogContext.Provider>;
    await render(node('running'));
    await click('.tlog-row-head');
    expect(container.querySelector('.tlog-output')?.textContent).toBe('snapshot 1');
    await click('.tlog-row-head');
    await click('.tlog-row-head');
    expect(loadDetail).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.tlog-output')?.textContent).toBe('snapshot 2');
    await act(async () => root!.render(node('completed')));
    expect(loadDetail).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.tlog-output')?.textContent).toBe('snapshot 3');
  });

  it('renders loading and loader errors, and retries failed requests', async () => {
    let reject!: (error: Error) => void;
    const loadDetail = vi.fn(() => new Promise<ThreadHistoryItemDetailDto>((_resolve, rejectRequest) => { reject = rejectRequest; }));
    await render(<TranscriptLogContext.Provider value={actions({ loadDetail })}><LogRow item={item('retry')} /></TranscriptLogContext.Provider>);
    await click('.tlog-row-head');
    expect(container.querySelector('.tlog-detail[role="status"]')).not.toBeNull();
    await act(async () => reject(new Error('Unavailable')));
    expect(container.querySelector('.tlog-output.is-error')?.textContent).toBe('Unavailable');
    await click('.tlog-row-head');
    await click('.tlog-row-head');
    expect(loadDetail).toHaveBeenCalledTimes(2);
  });

  it('uses inline output without loading and keeps full tool and diff open handlers', async () => {
    const context = actions({ loadDetail: vi.fn() });
    const tool = item('lookup', 'toolCall', { detailText: 'Tool: lookup\n\nResult:\n```text\nfound\n```', hasDeferredDetail: true });
    const edit = item('src/a.ts', 'fileChange', { detailText: '@@ -1 +1 @@\n-old\n+new', addedLines: 1, removedLines: 1 });
    await render(<TranscriptLogContext.Provider value={context}><LogRow item={tool} defaultOpen /><LogRow item={edit} defaultOpen /></TranscriptLogContext.Provider>);
    expect(context.loadDetail).not.toHaveBeenCalled();
    expect(container.querySelector('.tlog-output')?.textContent).toBe('found');
    expect(container.querySelector('.tlog-diff .is-add code')?.textContent).toBe('new');
    await click('[data-kind="toolCall"] .tlog-open');
    expect(context.openToolCall).toHaveBeenCalledWith(tool, 'Tool Call Details');
    await click('[data-kind="fileChange"] .tlog-open');
    expect(context.openDeferred).toHaveBeenCalledWith(edit, 'File Change Details', edit.detailText, expect.any(String), expect.any(String));
  });

  it.each([
    [item('zero', 'fileChange'), false], [item('one', 'fileChange', { addedLines: 1 }), true],
    [item('edge', 'fileChange', { addedLines: 20, removedLines: 20 }), true],
    [item('large', 'fileChange', { addedLines: 21, removedLines: 20 }), false],
    [item('command', 'commandExecution', { addedLines: 1 }), false],
  ])('decides whether %s is a small inline diff', (value, expected) => expect(opensDiff(value)).toBe(expected));

  it('automatically opens only the first three small edits per run', async () => {
    const edits = Array.from({ length: 5 }, (_, index) => item(`edit-${index}`, 'fileChange', {
      addedLines: index === 0 ? 41 : 1, detailText: '@@ -1 +1 @@\n-old\n+new',
    }));
    await render(<LogRun items={edits} expanded onToggle={vi.fn()} />);
    expect([...container.querySelectorAll('.tlog-row-head')].map(node => node.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'true', 'true', 'false']);
    expect(container.querySelectorAll('.tlog-diff')).toHaveLength(3);
  });

  it('folds three consecutive reads, leaving two reads and reads separated by another operation alone', async () => {
    await render(<TranscriptLogContext.Provider value={actions({ workspaceRoot: '/work' })}><LogRun items={[
      ...['a', 'b', 'c'].map(id => item(id, 'fileRead', { text: `/work/src/${id}.ts` })),
      item('separator'), item('d', 'fileRead'), item('e', 'fileRead'), item('separator-2'), item('f', 'fileRead'),
    ]} expanded onToggle={vi.fn()} /></TranscriptLogContext.Provider>);
    expect(container.querySelectorAll('[data-batch="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-batch="true"] .tlog-title')?.textContent).toBe('Read 3 files');
    expect(container.querySelector('.tlog-batch-names')?.textContent).toBe('a.ts  b.ts  c.ts');
    expect(container.querySelectorAll('.tlog-run-body > .tlog-row')).toHaveLength(6);
    await click('[data-batch="true"] > .tlog-row-head');
    expect(container.querySelectorAll('.tlog-batch .tlog-row')).toHaveLength(3);
    expect(container.querySelector('.tlog-batch .tlog-title')?.textContent).toBe('src/a.ts');
  });

  it.each([['completed', 'done', false], ['failed', 'failed', true], ['cancelled', 'interrupted', true], ['running', 'running', false]])(
    'renders normalized status and only exceptional tags for %s', async (status, normalized, tag) => {
      await render(<LogRow item={item('bash -lc "pwd"', 'commandExecution', { status })} />);
      expect(container.querySelector('.tlog-row')?.getAttribute('data-status')).toBe(normalized);
      expect(container.querySelector('.tlog-title')?.textContent).toBe('pwd');
      expect(Boolean(container.querySelector('.tlog-tag'))).toBe(tag);
      expect(Boolean(container.querySelector('.tlog-spinner'))).toBe(status === 'running');
    },
  );
});

describe('log titles', () => {
  it.each([
    ['bash -lc "pwd"', 'pwd'], ["/bin/bash -lc 'git status'", 'git status'],
    ['bash -lc "echo \\"hello\\" \\$HOME"', 'echo "hello" $HOME'],
    ['zsh -c "ls\npwd"', 'ls\npwd'], ['cargo test', 'cargo test'],
    ['bash script.sh', 'bash script.sh'],
  ])('unwraps %s', (command, expected) => expect(unwrapShellCommand(command)).toBe(expected));

  it.each([
    ['/work/repo/lib/a.rs', '/work/repo/', 'lib/a.rs'],
    ['/work/repo-other/lib/a.rs', '/work/repo', '…/repo-other/lib/a.rs'],
    ['/work/repo/crates/runtime/src/service.rs', undefined, 'crates/runtime/src/service.rs'],
    ['./src/a.ts', undefined, 'src/a.ts'], ['src/a.ts', undefined, 'src/a.ts'],
    ['/one/two/three/four/five.txt', undefined, '…/three/four/five.txt'], ['/tmp/a', undefined, '/tmp/a'],
    [' \\work\\repo\\lib\\a.rs ', '/work/repo', 'lib/a.rs'],
  ])('displays %s relative to %s', (path, workspace, expected) => expect(displayPath(path, workspace)).toBe(expected));
});

const patch = [
  '--- a/src/a.ts', '+++ b/src/a.ts', '@@ -1,1 +1,1 @@', '-old a', '+new a',
  '--- a/src/b.ts', '+++ b/src/b.ts', '@@ -1,1 +1,2 @@', ' keep b', '+new b',
].join('\n');

describe('changed files', () => {
  it('keeps one file of a multi-file patch, and the whole patch when nothing matches', () => {
    expect(diffForPath(patch, '/repo/src/b.ts')).toBe(patch.split('\n').slice(5).join('\n'));
    expect(diffForPath(patch, 'src/a.ts')).toBe(patch.split('\n').slice(0, 5).join('\n'));
    expect(diffForPath(patch, 'src/none.ts')).toBe(patch);
    expect(diffForPath('@@ -1 +1 @@\n-x\n+y', 'src/a.ts')).toBe('@@ -1 +1 @@\n-x\n+y');
  });

  it('shows four names, reveals the rest, and opens one file\'s diff in place', async () => {
    const loadDetail = vi.fn(async (id: string) => ({ id, kind: 'fileChange' as const, title: id, text: patch }));
    const files = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ path: `/repo/src/${name}.ts`, itemId: 'edit-1', addedLines: 1, removedLines: 0 }));
    await render(<TranscriptLogContext.Provider value={actions({ loadDetail, workspaceRoot: '/repo' })}><ChangedFiles files={files} total={12} /></TranscriptLogContext.Provider>);
    expect([...container.querySelectorAll('.tlog-file-name')].map((node) => node.textContent)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    expect(container.querySelector('.tlog-file')?.getAttribute('title')).toBe('src/a.ts');
    expect(container.querySelector('.tlog-files-more')?.textContent).toBe('+8');
    expect(loadDetail).not.toHaveBeenCalled();
    await click('.tlog-file:nth-of-type(2)');
    expect(loadDetail).toHaveBeenCalledExactlyOnceWith('edit-1');
    expect(container.querySelector('.tlog-file:nth-of-type(2)')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.thread-diff')?.textContent).toContain('new b');
    expect(container.querySelector('.thread-diff')?.textContent).not.toContain('new a');
    await click('.tlog-file:nth-of-type(2)');
    expect(container.querySelector('.thread-diff')).toBeNull();
    await click('button.tlog-files-more');
    expect(container.querySelectorAll('.tlog-file')).toHaveLength(5);
    expect(container.querySelector('.tlog-files-more')?.textContent).toBe('+7');
  });

  it('renders nothing for a turn without edits', async () => {
    await render(<ChangedFiles files={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
