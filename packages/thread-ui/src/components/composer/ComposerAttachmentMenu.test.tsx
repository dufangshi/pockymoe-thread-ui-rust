/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerAttachmentMenu } from './ComposerAttachmentMenu';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderMenu({
  open,
  onToggle = vi.fn(),
  onPickPhoto = vi.fn(),
  onPickFile = vi.fn(),
}: {
  open: boolean;
  onToggle?: () => void;
  onPickPhoto?: () => void;
  onPickFile?: () => void;
}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(
      <ComposerAttachmentMenu
        open={open}
        iconButtonClassName="icon"
        menuClassName="menu"
        menuItemClassName="item"
        onToggle={onToggle}
        onPickPhoto={onPickPhoto}
        onPickFile={onPickFile}
      />,
    );
  });

  return container;
}

describe('ComposerAttachmentMenu', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it('renders only the trigger while closed', () => {
    const onToggle = vi.fn();
    const view = renderMenu({ open: false, onToggle });

    expect(view.querySelector('[data-composer-menu-surface="true"]')).toBeNull();
    view.querySelector<HTMLButtonElement>('[aria-label="Add attachment"]')?.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders photo and file actions while open', () => {
    const onPickPhoto = vi.fn();
    const onPickFile = vi.fn();
    const view = renderMenu({
      open: true,
      onPickPhoto,
      onPickFile,
    });

    expect(view.querySelector('[data-composer-menu-surface="true"]')).not.toBeNull();
    const buttons = Array.from(view.querySelectorAll<HTMLButtonElement>('button'));
    buttons.find((button) => button.textContent === 'Photo')?.click();
    buttons.find((button) => button.textContent === 'File')?.click();

    expect(onPickPhoto).toHaveBeenCalledTimes(1);
    expect(onPickFile).toHaveBeenCalledTimes(1);
  });
});

describe('ComposerAttachmentMenu theme flags', () => {
  afterEach(() => {
    if (root) flushSync(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    delete document.documentElement.dataset.themeFeatures;
  });

  it('adds the paperclip trigger and row icons only with composer.richMenus', () => {
    const plain = renderMenu({ open: true });
    expect(plain.querySelectorAll('.composer-attach-icon')).toHaveLength(0);
    flushSync(() => root?.unmount());
    container?.remove();
    document.documentElement.dataset.themeFeatures = 'composer.richMenus';
    const rich = renderMenu({ open: true });
    expect(rich.querySelectorAll('.composer-attach-icon')).toHaveLength(2);
    expect(rich.querySelector('[aria-label="Add attachment"] .lucide-paperclip')).not.toBeNull();
  });
});
