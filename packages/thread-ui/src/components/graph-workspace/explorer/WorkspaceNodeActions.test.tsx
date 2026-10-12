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
  const node = { id: 'n', name: 'package.json', path: 'package.json', kind: 'file' as const, children: [] };
  act(() => root!.render(<WorkspaceNodeActions node={node} onCopyPath={vi.fn()} />));
  act(() => host!.querySelector<HTMLButtonElement>('[aria-label="More actions for package.json"]')!.click());
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  delete document.documentElement.dataset.themeFeatures;
});

describe('WorkspaceNodeActions theme flags', () => {
  it('names the node in menu labels unless the theme asks for short labels', () => {
    expect(openMenu()[0]!.textContent).toBe('Copy relative path for package.json');
    act(() => root?.unmount());
    host?.remove();
    document.documentElement.dataset.themeFeatures = 'explorer.shortMenuLabels';
    const [item] = openMenu();
    expect(item!.textContent).toBe('Copy relative path');
    expect(item!.getAttribute('aria-label')).toBe('Copy relative path for package.json');
  });
});
