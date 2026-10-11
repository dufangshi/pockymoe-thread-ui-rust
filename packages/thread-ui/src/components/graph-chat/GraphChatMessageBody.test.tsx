// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { GraphChatUserMessageBody } from './GraphChatMessageBody';

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
