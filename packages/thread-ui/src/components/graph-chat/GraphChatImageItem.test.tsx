// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { ThreadHistoryItemDto } from '@pockymoe/shared';
import { GraphChatImageItem } from './GraphChatHistoryItems';

it('previews generated images as thumbnails and opens the original on demand', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const getImageAssetUrl = vi.fn(({ path, variant }: { threadId: string; path: string; variant?: 'thumbnail' }) =>
    `/image?path=${path}${variant ? `&variant=${variant}` : ''}`);
  const onOpen = vi.fn();
  const item = {
    id: 'i1',
    kind: 'image',
    text: 'A cat',
    assetPath: '.temp/threads/t1/cat.png',
  } as unknown as ThreadHistoryItemDto & { kind: 'image' };
  try {
    act(() => root.render(<GraphChatImageItem threadId="t1" item={item} onOpen={onOpen} getImageAssetUrl={getImageAssetUrl} />));
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/image?path=.temp/threads/t1/cat.png&variant=thumbnail');
    expect(getImageAssetUrl).toHaveBeenCalledTimes(1);
    act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(onOpen).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"] img')!.getAttribute('src')).toBe('/image?path=.temp/threads/t1/cat.png');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('.thread-graph-history-event-path')!.click());
    expect(onOpen).toHaveBeenCalledWith(expect.any(String), '.temp/threads/t1/cat.png');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
