// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { RecoverableImage, ImageRecoveryProvider } from './RecoverableImage';

const host = document.createElement('div');
document.body.append(host);
let root = createRoot(host);
afterEach(() => { act(() => root.unmount()); host.replaceChildren(); root = createRoot(host); vi.useRealTimers(); });
const error = () => act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
it('resolves afresh twice with backoff, stops, and exposes themed retry outside the trigger', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn(() => '/new.png');
  act(() => root.render(<ImageRecoveryProvider value={refresh}><RecoverableImage src="/old.png" alt="Photo" renderImage={image => <button>{image}</button>} /></ImageRecoveryProvider>));
  error(); await tick(299); expect(refresh).not.toHaveBeenCalled();
  await tick(1); expect(refresh).toHaveBeenCalledTimes(1);
  expect(host.querySelector('img')!.src).toContain('/new.png?_imageRetry=');
  error(); await tick(900); expect(refresh).toHaveBeenCalledTimes(2);
  error(); await tick(10000);
  expect(host.querySelector('img')).toBeNull();
  expect(host.querySelector('.image-unavailable')).not.toBeNull();
  expect(refresh).toHaveBeenCalledTimes(2);
  const mark = host.querySelector<HTMLButtonElement>('.error-mark')!;
  expect(mark.parentElement!.tagName).toBe('SPAN');
  act(() => mark.click());
  act(() => document.querySelector<HTMLButtonElement>('.error-mark-retry')!.click());
  await tick(300); expect(refresh).toHaveBeenCalledTimes(3);
  act(() => host.querySelector('img')!.dispatchEvent(new Event('load')));
  act(() => window.dispatchEvent(new Event('online')));
  await tick(2000); expect(refresh).toHaveBeenCalledTimes(3);
});
it('recovers failed blobs via the durable resolver on reconnect and cancels stale requests', async () => {
  vi.useFakeTimers();
  const resolve = vi.fn(() => '/durable.png');
  act(() => root.render(<RecoverableImage src="blob:revoked" resolveSrc={resolve} alt="Photo" />));
  error(); await tick(300);
  expect(host.querySelector('img')!.src).toContain('/durable.png');
  error(); await tick(900); error();
  act(() => window.dispatchEvent(new Event('pockymoe-images-reconnected')));
  await tick(300); expect(resolve).toHaveBeenCalledTimes(3);
  error();
  act(() => root.render(<RecoverableImage src="/replacement.png" alt="New" />));
  await tick(2000); expect(resolve).toHaveBeenCalledTimes(3);
  expect(host.querySelector('img')!.getAttribute('src')).toBe('/replacement.png');
});
it('bounds resolver failures too', async () => {
  vi.useFakeTimers();
  const resolve = vi.fn(() => Promise.reject(new Error('offline')));
  act(() => root.render(<RecoverableImage src="/old.png" resolveSrc={resolve} alt="Photo" />));
  error(); await tick(300); await tick(900); await tick(10000);
  expect(resolve).toHaveBeenCalledTimes(2);
  expect(host.querySelector('.error-mark')).not.toBeNull();
});
