/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreadDetailDto } from '@pockymoe/shared';
import { ThreadRelationBar } from './ThreadRelationBar';
import { GraphChatThreadChatPanel } from './GraphChatThreadChatPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parentId = 'd6ccb483-81a8-42a2-829b-7edb0ab9bffe';
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function render(node: ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(node));
  return host;
}
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('ThreadRelationBar', () => {
  it('names the parent, its other workspace and leads back to it', () => {
    const open = vi.fn();
    const bar = render(<ThreadRelationBar parentThreadId={parentId} currentWorkspaceId="docs"
      parent={{ title: 'Rebuild the home page', workspaceId: 'site', workspaceLabel: 'Site' }}
      href={`/threads/${parentId}`} onOpen={open} />);
    expect(bar.textContent).toContain('Sub-thread · from');
    const [title, back] = Array.from(bar.querySelectorAll<HTMLAnchorElement>('a'));
    expect(title!.textContent).toBe('Rebuild the home page');
    expect(title!.getAttribute('href')).toBe(`/threads/${parentId}`);
    expect(bar.querySelector('.thread-relation-place')?.textContent).toBe('· Site');
    expect(back!.getAttribute('aria-label')).toBe('Back to parent');
    act(() => back!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(open).toHaveBeenCalledExactlyOnceWith(parentId);
    // A modified click is the browser's (new tab).
    let prevented = false;
    bar.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); });
    act(() => title!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(prevented).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('leaves the workspace out when the parent works in the same one', () => {
    const bar = render(<ThreadRelationBar parentThreadId={parentId} currentWorkspaceId="site"
      parent={{ title: 'Rebuild', workspaceId: 'site', workspaceLabel: 'Site' }} href="/x" onOpen={vi.fn()} />);
    expect(bar.querySelector('.thread-relation-place')).toBeNull();
  });

  it('shows the short ID while the parent is looked up', () => {
    const bar = render(<ThreadRelationBar parentThreadId={parentId} parent={undefined} onOpen={vi.fn()} />);
    expect(bar.querySelector('.thread-relation-bar')?.hasAttribute('data-loading')).toBe(true);
    // Without an address the links are buttons.
    expect(bar.querySelector('button.thread-relation-parent')?.textContent).toBe('d6ccb483');
  });

  it('says the parent is unavailable without linking to it', () => {
    const bar = render(<ThreadRelationBar parentThreadId={parentId} parent={null} href="/x" onOpen={vi.fn()} />);
    expect(bar.textContent).toBe('Sub-thread ·Parent unavailable');
    expect(bar.querySelector('a, button')).toBeNull();
  });
});

describe('GraphChatThreadChatPanel relation bar', () => {
  const detail = (parentThreadId?: string) => ({
    thread: { id: 'child', workspaceId: 'docs', title: 'Update the docs', status: 'idle', activeTurnId: null, ...(parentThreadId ? { parentThreadId, rootThreadId: parentThreadId } : {}) },
    workspace: { id: 'docs', label: 'Docs', absPath: '/docs' },
    turns: [], pendingRequests: [], pendingSteers: [],
  }) as unknown as ThreadDetailDto;
  const Timeline = () => <div data-testid="timeline" />;

  it('appears above the timeline only for a sub-thread on a page that can name threads', () => {
    const describeThread = vi.fn(() => ({ title: 'Rebuild the home page', workspaceId: 'site', workspaceLabel: 'Site' }));
    const plain = { openThread: vi.fn(), sendPrompt: vi.fn(), getThreadHref: (id: string) => `/threads/${id}` };
    const adapter = { ...plain, describeThread };
    const panel = render(<GraphChatThreadChatPanel detail={detail(parentId)} adapter={adapter} timelineAdapter={{}} TimelineComponent={Timeline} transcriptItemCount={0} />);
    const bar = panel.querySelector('.thread-relation-bar');
    expect(bar?.nextElementSibling?.getAttribute('data-testid')).toBe('timeline');
    expect(describeThread).toHaveBeenCalledWith(parentId);
    act(() => root.render(<GraphChatThreadChatPanel detail={detail()} adapter={adapter} timelineAdapter={{}} TimelineComponent={Timeline} transcriptItemCount={0} />));
    expect(panel.querySelector('.thread-relation-bar')).toBeNull();
    act(() => root.render(<GraphChatThreadChatPanel detail={detail(parentId)} adapter={plain} timelineAdapter={{}} TimelineComponent={Timeline} transcriptItemCount={0} />));
    expect(panel.querySelector('.thread-relation-bar')).toBeNull();
  });
});
