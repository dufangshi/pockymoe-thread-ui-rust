/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { GroupedThreadTabs, groupThreads, threadGroupActivity } from './GroupedThreadTabs';
import type { WorkbenchThread } from './MatterWorkbench';
const thread = (key: string, rootKey?: string): WorkbenchThread => ({key, rootKey, title: key, href: `/threads/${key}`, status: 'running', subtitle: '', favorite: false});

describe('agent thread groups', () => {
  it('distinguishes idle parents with running descendants and preserves their own execution and error states', () => {
    const children = [thread('child', 'root'), { ...thread('grandchild', 'root'), parentKey: 'child' }];
    for (const status of ['idle', 'unread']) {
      const parent = { ...thread('root'), status };
      expect(threadGroupActivity(parent, children)).toMatchObject({ status: 'agents-running', label: expect.stringContaining('2 agent threads running') });
      expect(parent.status).toBe(status);
      expect(threadGroupActivity(parent, children.map(child => ({ ...child, status: 'idle' })))).toMatchObject({ status });
    }
    for (const status of ['running', 'failed', 'interrupted', 'unknown']) {
      expect(threadGroupActivity({ ...thread('root'), status }, children).status).toBe(status);
    }
  });
  it('updates a group indicator when its last running child finishes without changing the parent link', () => {
    const container = document.createElement('nav'); document.body.append(container);
    const root = createRoot(container);
    const parent = { ...thread('root'), status: 'idle' };
    try {
      flushSync(() => root.render(<GroupedThreadTabs threads={[parent, thread('child', 'root')]} currentKey="root" onNavigate={vi.fn()} />));
      expect(container.querySelector('[role="img"]')?.getAttribute('data-status')).toBe('agents-running');
      expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Idle, read · 1 agent thread running');
      expect(container.querySelector('a')?.getAttribute('href')).toBe('/threads/root');
      expect(container.querySelector('.matter-group-toggle')?.hasAttribute('data-running')).toBe(true);
      flushSync(() => root.render(<GroupedThreadTabs threads={[parent, { ...thread('child', 'root'), status: 'idle' }]} currentKey="root" onNavigate={vi.fn()} />));
      expect(container.querySelector('[role="img"]')?.getAttribute('data-status')).toBe('idle');
      expect(container.querySelector('.matter-group-toggle')?.hasAttribute('data-running')).toBe(false);
    } finally { flushSync(() => root.unmount()); container.remove(); }
  });
  it('groups children and grandchildren by the device-scoped root while preserving unrelated and missing-root threads', () => {
    const groups = groupThreads([thread('mac:child', 'mac:root'), thread('mac:root'), thread('mac:grandchild', 'mac:root'), thread('wsl:root'), thread('wsl:orphan', 'wsl:missing')]);
    expect(groups.map(g => g.root.key)).toEqual(['mac:root', 'wsl:root', 'wsl:orphan']);
    expect(groups[0].children.map(t => t.key)).toEqual(['mac:child', 'mac:grandchild']);
  });
  it('keeps fan-out collapsed, identifies the selected child and opens navigable child links outside the scrolling tabs', () => {
    const container = document.createElement('nav'); document.body.append(container);
    const root = createRoot(container); const navigate = vi.fn();
    try {
      flushSync(() => root.render(<GroupedThreadTabs threads={[thread('root'), thread('child', 'root'), thread('grandchild', 'root')]} currentKey="child" onNavigate={navigate} />));
      expect(container.querySelectorAll('a')).toHaveLength(1);
      expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('root · child');
      const button = container.querySelector('button')!;
      expect(button.getAttribute('aria-expanded')).toBe('false');
      flushSync(() => button.click());
      const menu = document.querySelector('#matter-agent-threads')!;
      expect(container.contains(menu)).toBe(false);
      expect(menu.querySelectorAll('a')).toHaveLength(3);
      const child = menu.querySelector<HTMLAnchorElement>('a[href="/threads/grandchild"]')!;
      flushSync(() => child.click());
      expect(navigate).toHaveBeenCalledWith('/threads/grandchild');
      expect(document.querySelector('#matter-agent-threads')).toBeNull();
      flushSync(() => button.click());
      flushSync(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      expect(document.querySelector('#matter-agent-threads')).toBeNull();
      expect(document.activeElement).toBe(button);
    } finally { flushSync(() => root.unmount()); container.remove(); }
  });
});

it('counts only open agents, lists closed agents last and retains an icon-only history entry', () => {
  const container = document.createElement('nav'); document.body.append(container);
  const root = createRoot(container), parent = { ...thread('root'), status: 'idle' };
  const closed = { ...thread('closed', 'root'), closedAt: '2026-11-01T00:00:00Z' };
  try {
    flushSync(() => root.render(<GroupedThreadTabs threads={[parent, closed, thread('open', 'root')]} currentKey="root" onNavigate={vi.fn()} />));
    const button = container.querySelector<HTMLButtonElement>('.matter-group-toggle')!;
    expect(button.textContent).toBe('1'); expect(button.getAttribute('aria-label')).toBe('root: 1 agent threads');
    flushSync(() => button.click());
    const links = [...document.querySelectorAll<HTMLAnchorElement>('#matter-agent-threads a')];
    expect(links.map(link => link.textContent)).toEqual(['root', 'open', 'closed']);
    expect(links[2].style.color).toBe('var(--theme-fg-muted)');
    flushSync(() => root.render(<GroupedThreadTabs threads={[parent, closed]} currentKey="root" onNavigate={vi.fn()} />));
    expect(button.textContent).toBe(''); expect(button.classList.contains('is-badge')).toBe(true); expect(button.hasAttribute('data-closed-only')).toBe(true);
    expect(container.querySelector('[role="img"]')?.getAttribute('data-status')).toBe('idle');
    expect(document.querySelector('#matter-agent-threads a[href="/threads/closed"]')).not.toBeNull();
  } finally { flushSync(() => root.unmount()); container.remove(); }
});
