// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceNodeActions } from './WorkspaceNodeActions';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function openMenu() {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const node = { id: 'n', name: 'package.json', path: 'package.json', kind: 'file' as const, children: [], size: 2458,
    workspaceNode: { name: 'package.json', path: 'package.json', kind: 'file' as const, size: 2458, createdAt: '2026-10-04T15:09:22Z',
      modifiedAt: '2026-10-05T08:00:00Z', mode: 'rw-r--r--', readonly: true } };
  act(() => root!.render(<WorkspaceNodeActions node={node} onCopyPath={vi.fn()} />));
  act(() => host!.querySelector<HTMLButtonElement>('[aria-label="More actions for package.json"]')!.click());
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

describe('WorkspaceNodeActions', () => {
  it('keeps menu labels short, with the node named in each accessible name', () => {
    const [item] = openMenu();
    expect(item!.textContent).toBe('Copy relative path');
    expect(item!.getAttribute('aria-label')).toBe('Copy relative path for package.json');
  });

  it('shows the item\'s properties: kind, place, size, times and permissions', () => {
    const items = openMenu();
    const properties = items.find(item => item.textContent === 'Properties')!;
    act(() => properties.click());
    const rows = Array.from(document.querySelectorAll('.workspace-properties dl > div')).map(row => row.textContent);
    expect(rows).toEqual(['KindJSON file', 'LocationWorkspace root', 'Size2.4 KB (2,458 bytes)', expect.stringMatching(/^Created/), expect.stringMatching(/^Modified/), 'Permissionsrw-r--r--Read-only']);
    expect(document.querySelector('.workspace-properties-note')).toBeNull();
  });
});
