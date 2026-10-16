// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GraphChatMarkdownAwareBody, GraphChatUserMessageBody } from './GraphChatMessageBody';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('opens attachments and closes only outside the image or with Escape', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody text="See [PHOTO screenshot.png]" attachmentPreviewUrls={{ 'screenshot.png': '/test.png' }} />));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Open image preview: screenshot.png"]')!;
    expect(trigger).not.toBeNull();
    act(() => trigger.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Image preview: screenshot.png');
    act(() => dialog.querySelector<HTMLImageElement>('img')!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => dialog.querySelector<HTMLElement>('.thread-graph-image-lightbox-viewport')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => trigger.click());
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

const imageUrl = ({ path, variant }: { threadId: string; path: string; variant?: 'thumbnail' }) =>
  `/image?path=${path}${variant ? `&variant=${variant}` : ''}`;

it('shows photo chips as thumbnails and loads the original only in the lightbox', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody threadId="t1" text="See [PHOTO ./shot.jpg]" getImageAssetUrl={imageUrl} />));
    const chip = container.querySelector<HTMLImageElement>('img')!;
    expect(chip.getAttribute('src')).toBe('/image?path=./shot.jpg&variant=thumbnail');
    expect(document.querySelector('img[src="/image?path=./shot.jpg"]')).toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Open image preview: shot.jpg"]')!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('img')!.getAttribute('src')).toBe('/image?path=./shot.jpg');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it('keeps a local preview for both the chip and the lightbox', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody threadId="t1" text="[PHOTO a.png]" attachmentPreviewUrls={{ 'a.png': 'blob:local' }} getImageAssetUrl={imageUrl} />));
    expect(container.querySelector('img')!.getAttribute('src')).toBe('blob:local');
    act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(document.querySelector('[role="dialog"] img')!.getAttribute('src')).toBe('blob:local');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it('folds long prompts, keeps late attachments accessible, and resets disclosure for another message', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const text = `${'详细要求：请核对配对流程。'.repeat(100)}FULL PROMPT TAIL [PHOTO evidence.png] [FILE requirements.md]`;
  try {
    const message = (id: string) => <GraphChatUserMessageBody messageId={id} text={text} attachmentPreviewUrls={{'evidence.png':'/evidence.png'}} />;
    act(() => root.render(message('first')));
    const button = container.querySelector<HTMLButtonElement>('.thread-graph-show-more')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('FULL PROMPT TAIL');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/evidence.png');
    expect(container.textContent).toContain('requirements.md');
    act(() => button.click());
    expect(container.textContent).toContain('FULL PROMPT TAIL');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => root.render(message('first')));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => root.render(message('second')));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('FULL PROMPT TAIL');
    act(() => root.render(<GraphChatUserMessageBody messageId="short" text="A short prompt" />));
    expect(container.textContent).toBe('A short prompt');
    expect(container.querySelector('.thread-graph-show-more')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it.each(['user', 'markdown'])('anchors the %s message top on expansion and its toggle on collapse', (kind) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onBeforeResize = vi.fn();
  const text = 'A long readable paragraph for checking message disclosure anchors.\n'.repeat(100);
  try {
    act(() => root.render(kind === 'user'
      ? <GraphChatUserMessageBody messageId="anchor-user" text={text} onBeforeResize={onBeforeResize} />
      : <GraphChatMarkdownAwareBody messageId="anchor-markdown" text={text} onBeforeResize={onBeforeResize} scrollRootRef={{ current: null }} />));
    const toggle = container.querySelector<HTMLButtonElement>('.thread-graph-show-more')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(onBeforeResize).toHaveBeenLastCalledWith(toggle.parentElement);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => toggle.click());
    expect(onBeforeResize).toHaveBeenLastCalledWith(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  } finally { act(() => root.unmount()); container.remove(); }
});
