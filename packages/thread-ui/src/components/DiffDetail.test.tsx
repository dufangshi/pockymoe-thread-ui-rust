/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiffDetail } from './DiffDetail';

vi.mock('./graph-chat/graphChatShiki', () => ({ getGraphChatHighlighter: async () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); });
async function render(text: string) {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root!.render(<DiffDetail text={text} compact formatPath={path => path.replace('/workspace/', '')} />));
  return container;
}
const diff = (path: string) => `diff --git a/${path} b/${path}\nindex abc..def 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,2 @@\n-old\n+new\n same`;

describe('DiffDetail compact mode', () => {
  it('hides single-file headers while retaining the hunk and numbered changes', async () => {
    const el = await render(diff('src/app.ts'));
    expect(el.querySelector('.is-file')).toBeNull();
    expect(el.textContent).not.toContain('src/app.ts');
    expect(el.textContent).not.toContain('diff --git');
    expect(el.textContent).not.toContain('index abc');
    expect(el.querySelector('.is-meta code')?.textContent).toBe('@@ -1,2 +1,2 @@');
    expect(el.querySelector('.is-remove code')?.textContent).toBe('old');
    expect([...el.querySelectorAll('.is-remove .thread-diff-number')].map(node => node.textContent)).toEqual(['1', '']);
    expect([...el.querySelectorAll('.is-context .thread-diff-number')].map(node => node.textContent)).toEqual(['2', '2']);
  });

  it('gives each of several files one formatted is-file row', async () => {
    const el = await render(`${diff('/workspace/src/a.ts')}\n${diff('/workspace/src/b.ts')}`);
    expect([...el.querySelectorAll('.is-file code')].map(node => node.textContent)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(el.querySelectorAll('.is-file')).toHaveLength(2);
    expect(el.querySelectorAll('.is-add')).toHaveLength(2);
    expect(el.textContent).not.toContain('--- a/');
    expect(el.textContent).not.toContain('+++ b/');
  });

  it('keeps a removed line starting with -- inside a hunk as a numbered removal', async () => {
    const el = await render('--- a/query.sql\n+++ b/query.sql\n@@ -7,2 +7,1 @@\n--- old comment\n SELECT 1;');
    const removal = el.querySelector('.is-remove')!;
    expect(removal.querySelector('code')?.textContent).toBe('-- old comment');
    expect(removal.querySelector('.thread-diff-number')?.textContent).toBe('7');
    expect(el.querySelector('.is-context .thread-diff-number')?.textContent).toBe('8');
  });
});
