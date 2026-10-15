// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceTreeNode } from '../workspaceTree';
import { WorkspaceExplorerTree } from './WorkspaceExplorerTree';

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
});
