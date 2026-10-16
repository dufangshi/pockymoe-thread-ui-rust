// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceTreeNode } from '../workspaceTree';
import { WorkspaceExplorerTree } from './WorkspaceExplorerTree';

const { scrollToIndex } = vi.hoisted(() => ({ scrollToIndex: vi.fn() }));
vi.mock('@tanstack/react-virtual', () => ({
  measureElement: vi.fn(),
  useVirtualizer: () => ({
    scrollToIndex,
    getVirtualItems: () => [],
    getTotalSize: () => 2000,
    measureElement: vi.fn(),
  }),
}));

function directory(
  path: string,
  children: WorkspaceTreeNode[] = [],
): WorkspaceTreeNode {
  return {
    id: `workspace:${path}`,
    name: path.split('/').at(-1) || 'workspace',
    path,
    kind: 'directory',
    children,
    childrenLoaded: true,
    hasChildren: children.length > 0,
  };
}

function file(path: string): WorkspaceTreeNode {
  return {
    id: `workspace:${path}`,
    name: path.split('/').at(-1) ?? path,
    path,
    kind: 'file',
    children: [],
  };
}

const tree = directory('', [
  directory('src', [file('src/index.ts')]),
  file('README.md'),
]);

let root: Root | null = null;
let host: HTMLDivElement | null = null;

describe('WorkspaceExplorerTree', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 1;
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    host?.remove();
    host = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders one-tab-stop ARIA tree metadata', () => {
    act(() => {
      root?.render(
        <WorkspaceExplorerTree
          tree={tree}
          expandedPaths={new Set(['src'])}
          loadingPaths={new Set()}
          selectedNodeId="workspace:src/index.ts"
          scrollerRef={createRef<HTMLDivElement>()}
          onSelect={() => undefined}
          onToggle={() => undefined}
          virtualize={false}
        />,
      );
    });

    expect(
      host?.querySelector('[role="tree"]')?.getAttribute('aria-label'),
    ).toBe('Workspace files');
    const rows = [
      ...(host?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []),
    ];
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);
    expect(rows[1]?.getAttribute('aria-level')).toBe('2');
    expect(rows[1]?.getAttribute('aria-posinset')).toBe('1');
    expect(rows[1]?.getAttribute('aria-setsize')).toBe('2');
    expect(rows[1]?.getAttribute('aria-expanded')).toBe('true');
    expect(rows[2]?.getAttribute('aria-selected')).toBe('true');
  });

  it('names node icons with data-icon for theme packs', () => {
    act(() => {
      root?.render(
        <WorkspaceExplorerTree
          tree={directory('', [directory('src', [file('src/index.ts')]), directory('docs'), file('notes.txt')])}
          expandedPaths={new Set(['src'])}
          loadingPaths={new Set()}
          selectedNodeId={null}
          scrollerRef={createRef<HTMLDivElement>()}
          onSelect={() => undefined}
          onToggle={() => undefined}
          virtualize={false}
        />,
      );
    });
    const icons = [...(host?.querySelectorAll('[role="treeitem"] svg.workspace-node-icon') ?? [])]
      .map((icon) => icon.getAttribute('data-icon'));
    expect(icons.slice(1)).toEqual(['folder', 'folder-open', 'code', 'file']);
  });

  it('supports VS Code-style focus, expand, collapse, and activation keys', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    act(() => {
      root?.render(
        <WorkspaceExplorerTree
          tree={tree}
          expandedPaths={new Set(['src'])}
          loadingPaths={new Set()}
          selectedNodeId="workspace:src"
          scrollerRef={createRef<HTMLDivElement>()}
          onSelect={onSelect}
          onToggle={onToggle}
          virtualize={false}
        />,
      );
    });

    const src = host?.querySelector<HTMLElement>(
      '[data-explorer-node-id="workspace:src"]',
    );
    act(() => src?.focus());
    act(() =>
      src?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    const sourceFile = host?.querySelector<HTMLElement>(
      '[data-explorer-node-id="workspace:src/index.ts"]',
    );
    expect(document.activeElement).toBe(sourceFile);

    act(() =>
      sourceFile?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/index.ts', kind: 'file' }),
    );

    act(() => src?.focus());
    act(() =>
      src?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      ),
    );
    expect(onToggle).toHaveBeenCalledWith('src');
  });

  it('separates directory selection from disclosure expansion', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    act(() => {
      root?.render(
        <WorkspaceExplorerTree
          tree={tree}
          expandedPaths={new Set()}
          loadingPaths={new Set()}
          selectedNodeId={null}
          scrollerRef={createRef<HTMLDivElement>()}
          onSelect={onSelect}
          onToggle={onToggle}
          virtualize={false}
        />,
      );
    });

    act(() => {
      [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        .find((button) => button.textContent === 'src')
        ?.click();
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src', kind: 'directory' }),
    );
    expect(onToggle).not.toHaveBeenCalled();

    act(() =>
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Expand src"]')
        ?.click(),
    );
    expect(onToggle).toHaveBeenCalledWith('src');
  });

  it('reveals a requested target at index minus one and uses auto for ordinary selection', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const scrollerRef = createRef<HTMLDivElement>();
    const renderTree = (selectedNodeId: string, revealRequestKey?: number) => act(() => root!.render(
      <WorkspaceExplorerTree tree={tree} expandedPaths={new Set(['src'])} loadingPaths={new Set()}
        selectedNodeId={selectedNodeId} revealRequestKey={revealRequestKey} scrollerRef={scrollerRef}
        onSelect={vi.fn()} onToggle={vi.fn()} />,
    ));
    renderTree('workspace:src/index.ts', 1);
    expect(scrollToIndex).toHaveBeenLastCalledWith(1, { align: 'start' });
    scrollToIndex.mockClear();
    renderTree('workspace:README.md', 1);
    expect(scrollToIndex).toHaveBeenLastCalledWith(3, { align: 'auto' });
    renderTree('workspace:README.md', 2);
    expect(scrollToIndex).toHaveBeenLastCalledWith(2, { align: 'start' });
    renderTree('workspace:', 3);
    expect(scrollToIndex).toHaveBeenLastCalledWith(0, { align: 'start' });
  });

  it.each(['wheel', 'touchstart', 'keydown', 'expiry'])('repeats reveal during projection loading until %s', (stop) => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const scrollerRef = createRef<HTMLDivElement>();
    const renderTree = (extra: number) => act(() => root!.render(
      <WorkspaceExplorerTree tree={directory('', [...tree.children, ...Array.from({ length: extra }, (_, i) => file(`z-${i}.ts`))])}
        expandedPaths={new Set(['src'])} loadingPaths={new Set()} selectedNodeId="workspace:src/index.ts"
        revealRequestKey={1} scrollerRef={scrollerRef} onSelect={vi.fn()} onToggle={vi.fn()} />,
    ));
    renderTree(0);
    scrollToIndex.mockClear();
    now = 1400;
    renderTree(1);
    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'start' });
    scrollToIndex.mockClear();
    if (stop === 'expiry') now = 1601;
    else act(() => scrollerRef.current!.dispatchEvent(new Event(stop)));
    renderTree(2);
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
});
