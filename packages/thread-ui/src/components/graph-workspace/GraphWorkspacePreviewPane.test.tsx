// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPluginContextValue } from '../../plugins/plugin-context';
import {
  GraphWorkspacePreviewPane,
  resolveWorkspaceMarkdownPath,
} from './GraphWorkspacePreviewPane';
import type { WorkspaceTreeNode } from './workspaceTree';

vi.mock('../graph-chat/graphChatShiki', () => ({
  getGraphChatHighlighter: () => new Promise(() => undefined),
  syntaxThemeFor: () => 'github-light-default',
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(node);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
  document.body.style.overflow = '';
});

describe('resolveWorkspaceMarkdownPath', () => {
  it('resolves relative, parent, and workspace-absolute resources', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/guides/setup.md',
        resourceUrl: './images/flow chart.png?raw=1',
      }),
    ).toBe('docs/guides/images/flow chart.png');
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/home/u/treer/docs/guides/setup.md',
        resourceUrl: '../assets/diagram.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('docs/assets/diagram.png');
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/guides/setup.md',
        resourceUrl: '/home/u/treer/screenshots/result.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('screenshots/result.png');
  });

  it('keeps external URLs outside the workspace adapter', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/setup.md',
        resourceUrl: 'https://example.com/image.png',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'README.md',
        resourceUrl: '../outside.png',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/home/u/treer/docs/setup.md',
        resourceUrl: '/etc/passwd',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/tmp/outside.md',
        resourceUrl: './image.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBeNull();
  });

  it('resolves complete same-origin workspace URLs', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/setup.md',
        resourceUrl: `${window.location.origin}/home/u/treer/assets/relay.png`,
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('assets/relay.png');
  });
});

describe('GraphWorkspacePreviewPane', () => {
  it('renders README HTML images and routes linked badges to relative workspace documents', () => {
    const onOpenWorkspaceFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { id: 'readme', path: '/home/u/treer/README.md', name: 'README.md', kind: 'file', children: [] } }}
      previewFile={{ path: '/home/u/treer/README.md', name: 'README.md', language: 'markdown', size: 200, truncated: false, nextOffset: 200,
        content: '<p align="center"><a href="README.zh-CN.md"><img src="https://example.com/badge.svg" alt="中文" width="80"></a></p>\n\n<p align="center"><img src="docs/hero.png" alt="Hero" width="100%"></p>' }}
      workspaceRootPath="/home/u/treer" onOpenWorkspaceFile={onOpenWorkspaceFile}
      resolveWorkspaceFileUrl={path => `/raw?path=${encodeURIComponent(path)}`} />);
    expect(element.querySelector('p[align="center"]')).not.toBeNull();
    expect(element.querySelector('a img')?.getAttribute('src')).toBe('https://example.com/badge.svg');
    expect(element.querySelector('a button')).toBeNull();
    const hero = element.querySelector<HTMLImageElement>('img[alt="Hero"]')!;
    expect(hero.getAttribute('src')).toBe('/raw?path=docs%2Fhero.png');
    expect(hero.style.width).toBe('100%');
    act(() => element.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(onOpenWorkspaceFile).toHaveBeenCalledWith('README.zh-CN.md');
  });
  it('explains a refused symbolic link instead of showing the error code', () => {
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { id: 'link', path: 'link', name: 'link', kind: 'file', children: [] } }}
      error="symbolicLink" />);
    expect(element.textContent).toContain('This is a symbolic link. Open the file it points to instead.');
    expect(element.textContent).not.toContain('symbolicLink');
  });
  const markdownNode: WorkspaceTreeNode = {
    id: 'workspace:docs/architecture.md',
    name: 'architecture.md',
    path: '/home/u/treer/docs/architecture.md',
    kind: 'file',
    children: [],
  };

  it('renders Markdown by default and resolves workspace images through the adapter', () => {
    const resolveWorkspaceFileUrl = vi.fn(
      (path: string) => `/relay/files/raw?path=${encodeURIComponent(path)}`,
    );
    const onOpenWorkspaceFile = vi.fn();
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
        previewFile={{
          path: markdownNode.path,
          name: markdownNode.name,
          content:
            '# Architecture\n\n![Diagram](../assets/system.png)\n\n[Details](./details.md)',
          language: 'markdown',
          size: 96,
          truncated: false,
          nextOffset: 96,
        }}
        resolveWorkspaceFileUrl={resolveWorkspaceFileUrl}
        onOpenWorkspaceFile={onOpenWorkspaceFile}
        workspaceRootPath="/home/u/treer"
      />,
    );

    expect(element.querySelector('h1')?.textContent).toBe('Architecture');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(
      '/relay/files/raw?path=assets%2Fsystem.png',
    );
    expect(resolveWorkspaceFileUrl).toHaveBeenCalledWith('assets/system.png');
    expect(element.querySelector('[aria-label="Source code"]')).toBeNull();

    act(() => {
      element
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open image preview: Diagram"]',
        )
        ?.click();
    });
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Image preview: Diagram');
    expect(dialog?.querySelector('img')?.getAttribute('src')).toBe(
      '/relay/files/raw?path=assets%2Fsystem.png',
    );

    act(() => {
      dialog
        ?.querySelector<HTMLElement>('.thread-graph-image-lightbox-viewport')
        ?.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: 320,
            clientY: 240,
            deltaY: -100,
          }),
        );
    });
    expect(document.body.textContent).toContain('125%');
    expect(dialog?.querySelector('img')?.style.transform).toContain(
      'translate3d(-80px, -60px, 0) scale(1.25)',
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      element
        .querySelector<HTMLAnchorElement>('a')
        ?.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
    expect(onOpenWorkspaceFile).toHaveBeenCalledWith('docs/details.md');
  });

  it('keeps an open README image and its zoom across parent callback refreshes', () => {
    const view = () => <GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
      previewFile={{ path: markdownNode.path, name: markdownNode.name, content: '![Diagram](../assets/system.png)', language: 'markdown', size: 40, truncated: false, nextOffset: 40 }}
      workspaceRootPath="/home/u/treer"
      onOpenWorkspaceFile={() => undefined}
      resolveWorkspaceFileUrl={path => `/raw?path=${encodeURIComponent(path)}`} />;
    const element = render(view());
    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Open image preview: Diagram"]')!.click());
    const dialog = document.body.querySelector('[role="dialog"]')!;
    act(() => dialog.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
    expect(dialog.textContent).toContain('125%');
    // Explorer refreshes recreate callbacks, even while the file stays the same.
    act(() => root!.render(view()));
    expect(document.body.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.textContent).toContain('125%');
    act(() => dialog.querySelector<HTMLButtonElement>('[aria-label="Close image preview"]')!.click());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens direct image files in the same lightbox and closes from the toolbar', () => {
    const imageNode: WorkspaceTreeNode = {
      id: 'workspace:images/diagram.png',
      name: 'diagram.png',
      path: '/home/u/treer/images/diagram.png',
      kind: 'file',
      children: [],
    };
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: imageNode }}
        imageUrl="/relay/files/raw?path=images%2Fdiagram.png"
      />,
    );

    act(() => {
      element
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open image preview"]',
        )
        ?.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[aria-label="Close image preview"]')
        ?.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('switches Markdown to highlighted source with line numbers', () => {
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
        focusLine={3}
        previewFile={{
          path: markdownNode.path,
          name: markdownNode.name,
          content: '# Architecture\n\nText',
          language: 'markdown',
          size: 20,
          truncated: false,
          nextOffset: 20,
        }}
      />,
    );

    act(() => element.querySelector<HTMLButtonElement>('[aria-label="File actions"]')!.click());
    expect(element.querySelector('[role="menu"]')).toBeNull();
    const sourceButton = element.querySelector<HTMLButtonElement>(
      '[aria-label="Markdown source"]',
    );
    act(() => {
      sourceButton?.click();
    });

    expect(element.querySelector('[aria-label="Source code"]')).toBeTruthy();
    expect(
      [...element.querySelectorAll('.thread-graph-code-line-number')].map(
        (line) => line.textContent,
      ),
    ).toEqual(['1', '2', '3']);
    expect(
      element
        .querySelector('[data-line="3"]')
        ?.classList.contains('is-focused-line'),
    ).toBe(true);
  });
});

it('resolves Windows Markdown resources with case-insensitive roots and browser drive prefixes', () => {
  for (const resourceUrl of ['C:/WORK/demo/assets/a.png', '/C:/Work/demo/assets/a.png', 'file:///C:/work/demo/assets/a.png', `${window.location.origin}/C%3A/Work/demo/assets/a.png`, '../assets/a.png']) {
    expect(resolveWorkspaceMarkdownPath({markdownPath:'C:\\Work\\demo\\docs\\readme.md', resourceUrl, workspaceRootPath:'c:\\work\\demo'})).toBe('assets/a.png');
  }
});

it('renders draw.io in a sandbox by default and preserves source/preview switching', () => {
  const node: WorkspaceTreeNode = {id:'diagram',name:'architecture.drawio',path:'docs/architecture.drawio',kind:'file',children:[]};
  const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
    selectedTarget={{kind:'workspace-file',node}}
    previewFile={{path:node.path,name:node.name,content:'<mxfile><diagram/></mxfile>',size:35,language:'xml',truncated:false,nextOffset:35}} />);
  const frame = element.querySelector('iframe');
  expect(frame?.getAttribute('title')).toBe('Draw.io preview: architecture.drawio');
  expect(frame?.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame?.getAttribute('srcdoc')).toContain('/vendor/drawio/bootstrap.v1.js');
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="File actions"]')!.click());
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="Diagram source"]')!.click());
  expect(element.querySelector('iframe')).toBeNull();
  expect(element.querySelector('[aria-label="Source code"]')).toBeTruthy();
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="Diagram preview"]')!.click());
  expect(element.querySelector('iframe')).toBeTruthy();
});
