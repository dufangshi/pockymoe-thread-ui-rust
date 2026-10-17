// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceFileTabs } from './WorkspaceFileTabs';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('WorkspaceFileTabs', () => {
  const tabs = [
    { name: 'preview.ts', path: 'src/preview.ts', pinned: false },
    { name: 'pinned.ts', path: 'src/pinned.ts', pinned: true },
  ];

  it('distinguishes preview and pinned tabs and selects a tab', () => {
    const onSelect = vi.fn();
    const element = render(
      <WorkspaceFileTabs
        activePath="src/preview.ts"
        dirtyPaths={new Set()}
        onClose={() => undefined}
        onSelect={onSelect}
        tabs={tabs}
      />,
    );

    const renderedTabs = element.querySelectorAll('[role="tab"]');
    expect(renderedTabs).toHaveLength(2);
    expect(renderedTabs[0]?.parentElement?.classList).toContain('is-preview');
    expect(renderedTabs[1]?.parentElement?.classList).toContain('is-pinned');
    act(() => (renderedTabs[1] as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledWith('src/pinned.ts');
  });

  it('asks in the confirmation window before closing a dirty tab', () => {
    const onClose = vi.fn();
    const element = render(
      <WorkspaceFileTabs
        activePath="src/preview.ts"
        dirtyPaths={new Set(['src/preview.ts'])}
        onClose={onClose}
        onSelect={() => undefined}
        tabs={tabs}
      />,
    );

    act(() =>
      element
        .querySelector<HTMLButtonElement>('[aria-label="Close preview.ts"]')
        ?.click(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      'Discard unsaved changes in preview.ts?',
    );

    const discard = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Discard',
    );
    act(() => discard?.click());
    expect(onClose).toHaveBeenCalledWith('src/preview.ts');
  });
});
