// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { RecoverableImage, ImageRecoveryProvider, ImageDiagnosisProvider } from './RecoverableImage';

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
  const pan = vi.fn(); document.body.addEventListener('pointerdown', pan);
  act(() => mark.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(pan).not.toHaveBeenCalled(); document.body.removeEventListener('pointerdown', pan);
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

it('falls back to a freshly resolved original after thumbnail decoding fails', async () => {
  vi.useFakeTimers();
  const full = vi.fn(() => '/original.png');
  act(() => root.render(<RecoverableImage src="/thumbnail.png" resolveSrc={() => '/thumbnail.png'} resolveFallback={full} alt="Photo" />));
  error(); await tick(300); error(); await tick(900);
  expect(full).toHaveBeenCalledOnce();
  expect(host.querySelector('img')!.src).toContain('/original.png?_imageRetry=');
  act(() => host.querySelector('img')!.dispatchEvent(new Event('load')));
  expect(host.querySelector('[data-image-state]')!.getAttribute('data-image-state')).toBe('ready');
});
it('diagnoses the actual final URL once per failure and shows the short reason', async () => {
  vi.useFakeTimers();
  const diagnose = vi.fn(async (_src: string) => 'File not found');
  act(() => root.render(<ImageDiagnosisProvider value={diagnose}><RecoverableImage src="/missing.png" alt="Photo" /></ImageDiagnosisProvider>));
  error(); await tick(300); error(); await tick(900); error(); await tick(0);
  expect(diagnose).toHaveBeenCalledOnce();
  expect(diagnose.mock.calls[0]![0]).toContain('/missing.png?_imageRetry=');
  act(() => host.querySelector<HTMLButtonElement>('.error-mark')!.click());
  expect(document.querySelector('.error-mark-message')!.textContent).toBe('File not found');
  await tick(10000); expect(diagnose).toHaveBeenCalledOnce();
});
it('never assigns an unresolved blob to a retry image', async () => {
  vi.useFakeTimers();
  act(() => root.render(<RecoverableImage src="blob:expired" alt="Photo" />));
  const first = host.querySelector('img');
  error(); await tick(300);
  expect(host.querySelector('img')).toBe(first);
  await tick(900);
  expect(host.querySelector('img')).toBeNull();
  expect(host.querySelector('.error-mark')).not.toBeNull();
});
