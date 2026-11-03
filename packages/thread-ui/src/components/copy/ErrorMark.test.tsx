// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { ErrorMark } from './ErrorMark';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const bubble = () => document.querySelector<HTMLElement>('.error-mark-bubble');

it('shows only a mark in the page; the reason and a retry open on a tap', () => {
  const retry = vi.fn();
  act(() => root.render(<ErrorMark message="The device did not answer." onRetry={retry} />));
  const mark = host.querySelector<HTMLButtonElement>('button.error-mark')!;
  expect(mark.getAttribute('aria-label')).toBe('Why it failed');
  expect(bubble()).toBeNull();
  // Screen readers still hear the reason.
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('The device did not answer.');
  act(() => mark.click());
  expect(bubble()?.textContent).toContain('The device did not answer.');
  act(() => bubble()!.querySelector<HTMLButtonElement>('.error-mark-retry')!.click());
  expect(retry).toHaveBeenCalledOnce();
  expect(bubble()).toBeNull();
});

it('closes on a press elsewhere and on Esc', () => {
  act(() => root.render(<ErrorMark message="Not saved." />));
  const mark = host.querySelector<HTMLButtonElement>('button.error-mark')!;
  act(() => mark.click());
  act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  expect(bubble()).toBeNull();
  act(() => mark.click());
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(bubble()).toBeNull();
});

it('explains an unavailable control quietly, without an alert', () => {
  act(() => root.render(<ErrorMark kind="unavailable" message="Install the harness first." />));
  const mark = host.querySelector<HTMLButtonElement>('button.error-mark')!;
  expect(mark.dataset.kind).toBe('unavailable');
  expect(mark.getAttribute('aria-label')).toBe('Why it is unavailable');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  act(() => mark.click());
  expect(bubble()?.textContent).toContain('Install the harness first.');
});

it('keeps the window or menu around it open when the bubble is pressed', () => {
  const outside = vi.fn();
  document.addEventListener('pointerdown', outside);
  act(() => root.render(<ErrorMark message="Not saved." onRetry={() => {}} />));
  act(() => host.querySelector<HTMLButtonElement>('button.error-mark')!.click());
  act(() => { bubble()!.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  expect(outside).not.toHaveBeenCalled();
  expect(bubble()).not.toBeNull();
  document.removeEventListener('pointerdown', outside);
});

it('follows its mark while the page settles, and closes once the mark scrolls away', () => {
  act(() => root.render(<ErrorMark message="Not saved." />));
  const mark = host.querySelector<HTMLButtonElement>('button.error-mark')!;
  let top = 300;
  vi.spyOn(mark, 'getBoundingClientRect').mockImplementation(() => new DOMRect(40, top, 20, 20));
  act(() => mark.click());
  expect(bubble()!.style.top).toBe('326px');
  top = 250;
  act(() => { window.dispatchEvent(new Event('scroll')); });
  expect(bubble()!.style.top).toBe('276px');
  top = -40;
  act(() => { window.dispatchEvent(new Event('scroll')); });
  expect(bubble()).toBeNull();
});


it('keeps retry and an alternative recovery inside the same error bubble', () => {
  const retry = vi.fn(), download = vi.fn();
  act(() => root.render(<ErrorMark message="Update failed." onRetry={retry} secondaryAction={{ label: 'Go to download', onClick: download }} />));
  act(() => host.querySelector<HTMLButtonElement>('button.error-mark')!.click());
  const actions = bubble()!.querySelectorAll<HTMLButtonElement>('button');
  expect(actions).toHaveLength(2);
  expect(actions[1].textContent).toBe('Go to download');
  act(() => actions[1].click());
  expect(download).toHaveBeenCalledOnce(); expect(retry).not.toHaveBeenCalled();
  expect(bubble()).toBeNull();
});


it('uses the surface behind the mark rather than its translucent hover tint', () => {
  host.style.backgroundColor = 'rgb(20, 30, 40)';
  act(() => root.render(<ErrorMark message="Update failed." />));
  const mark = host.querySelector<HTMLButtonElement>('button.error-mark')!;
  mark.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
  act(() => mark.click());
  expect(bubble()!.style.backgroundColor).toBe('rgb(20, 30, 40)');
});


it('disables Retry after an attempt limit while preserving alternative recovery', () => {
  const retry = vi.fn(), download = vi.fn();
  act(() => root.render(<ErrorMark message="Retry limit reached." onRetry={retry} retryDisabled secondaryAction={{ label: 'Go to download', onClick: download }} />));
  act(() => host.querySelector<HTMLButtonElement>('button.error-mark')!.click());
  const actions = bubble()!.querySelectorAll<HTMLButtonElement>('button');
  expect(actions[0].disabled).toBe(true); act(() => actions[0].click()); expect(retry).not.toHaveBeenCalled();
  act(() => actions[1].click()); expect(download).toHaveBeenCalledOnce();
});
