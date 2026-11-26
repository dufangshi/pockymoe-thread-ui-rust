import { afterEach, describe, expect, it } from 'vitest';

import { setHostPlatform } from '../../shortcuts';

import type { WorkspaceExplorerRowProjection } from './workspaceExplorerTypes';
import { workspaceExplorerCommandForKey } from './workspaceExplorerCommands';

function row(input: {
  id: string;
  parentId?: string | null;
  path: string;
  kind: 'directory' | 'file';
  expanded?: boolean;
}): WorkspaceExplorerRowProjection {
  return {
    id: input.id,
    parentId: input.parentId ?? null,
    depth: input.parentId ? 1 : 0,
    posInSet: 1,
    setSize: 1,
    expanded:
      input.kind === 'directory' ? (input.expanded ?? false) : undefined,
    node: {
      id: input.id,
      parentId: input.parentId ?? null,
      name: input.path,
      path: input.path,
      kind: input.kind,
      childIds: [],
      childrenState: 'resolved',
      hasChildren: input.kind === 'directory',
      truncated: false,
      requestGeneration: 0,
      source: {
        id: input.id,
        name: input.path,
        path: input.path,
        kind: input.kind,
      },
    },
  };
}

const rows = [
  row({ id: 'root', path: '', kind: 'directory', expanded: true }),
  row({
    id: 'src',
    parentId: 'root',
    path: 'src',
    kind: 'directory',
    expanded: true,
  }),
  row({
    id: 'file',
    parentId: 'src',
    path: 'src/index.ts',
    kind: 'file',
  }),
];

describe('workspaceExplorerCommandForKey', () => {
  it('moves focus within visible boundaries', () => {
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowDown',
        focusedId: 'src',
        rows,
      }),
    ).toEqual({ type: 'focus', id: 'file' });
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowUp',
        focusedId: 'root',
        rows,
      }),
    ).toEqual({ type: 'focus', id: 'root' });
    expect(
      workspaceExplorerCommandForKey({ key: 'End', focusedId: 'root', rows }),
    ).toEqual({ type: 'focus', id: 'file' });
  });

  it('expands, collapses, and enters directories', () => {
    const collapsedRows = [rows[0], { ...rows[1], expanded: false }, rows[2]];
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowRight',
        focusedId: 'src',
        rows: collapsedRows,
      }),
    ).toEqual({ type: 'expand', path: 'src' });
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowRight',
        focusedId: 'src',
        rows,
      }),
    ).toEqual({ type: 'focus', id: 'file' });
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowLeft',
        focusedId: 'src',
        rows,
      }),
    ).toEqual({ type: 'collapse', path: 'src' });
    expect(
      workspaceExplorerCommandForKey({
        key: 'ArrowLeft',
        focusedId: 'file',
        rows,
      }),
    ).toEqual({ type: 'focus', id: 'src' });
  });

  it('activates and selects', () => {
    expect(
      workspaceExplorerCommandForKey({ key: 'Enter', focusedId: 'file', rows }),
    ).toEqual({ type: 'activate', id: 'file' });
    expect(
      workspaceExplorerCommandForKey({ key: ' ', focusedId: 'file', rows }),
    ).toEqual({ type: 'select', id: 'file' });
  });

  describe('find', () => {
    afterEach(() => setHostPlatform(null));
    const find = (modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }) =>
      workspaceExplorerCommandForKey({ key: 'f', focusedId: 'file', rows, ...modifiers });

    it('opens the filter with Ctrl+F on Windows and Linux', () => {
      setHostPlatform('linux');
      expect(find({ ctrlKey: true })).toEqual({ type: 'open-filter' });
      expect(find({ metaKey: true })).toBeNull();
      expect(find({ ctrlKey: true, shiftKey: true })).toBeNull();
      expect(find({ ctrlKey: true, altKey: true })).toBeNull();
    });

    it('opens the filter with ⌘F on a Mac and leaves Ctrl+F alone', () => {
      setHostPlatform('darwin');
      expect(find({ metaKey: true })).toEqual({ type: 'open-filter' });
      expect(find({ ctrlKey: true })).toBeNull();
    });
  });
});
