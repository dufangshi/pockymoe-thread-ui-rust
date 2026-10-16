/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { PhoneSheet } from './PhoneDock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** jsdom has no Touch: a plain event carrying what the sheet reads. */
function touch(target: Element, type: string, clientY: number, timeStamp: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === 'touchend' ? [] : [{ clientX: 100, clientY }];
  Object.assign(event, { touches, changedTouches: [{ clientX: 100, clientY }] });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  act(() => { target.dispatchEvent(event); });
  return event;
}

function renderSheet(onClose: () => void) {
  act(() => root.render(<PhoneSheet open label="Threads" onClose={onClose}><button>Row</button></PhoneSheet>));
  const sheet = host.querySelector<HTMLElement>('section.matter-phone-sheet')!;
  Object.defineProperty(sheet, 'offsetHeight', { value: 600 });
  return sheet;
}

describe('PhoneSheet', () => {
  it('follows a downward drag and closes past the threshold', () => {
    const onClose = vi.fn();
    const sheet = renderSheet(onClose);
    const row = sheet.querySelector('button')!;
    touch(row, 'touchstart', 100, 0);
    expect(touch(row, 'touchmove', 130, 100).defaultPrevented).toBe(true);
    expect(sheet.hasAttribute('data-dragging')).toBe(true);
    touch(row, 'touchmove', 260, 600);
    expect(sheet.style.transform).toBe('translateY(160px)');
    touch(row, 'touchend', 260, 700);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sheet.hasAttribute('data-dragging')).toBe(false);
  });

  it('springs back from a short slow drag and closes on a flick', () => {
    const onClose = vi.fn();
    const sheet = renderSheet(onClose);
    const row = sheet.querySelector('button')!;
    touch(row, 'touchstart', 100, 0);
    touch(row, 'touchmove', 150, 400);
    touch(row, 'touchend', 150, 800);
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    touch(row, 'touchstart', 100, 1000);
    touch(row, 'touchmove', 140, 1020);
    touch(row, 'touchend', 140, 1040);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets the list scroll instead of dragging when it is not at its top', () => {
    const onClose = vi.fn();
    const sheet = renderSheet(onClose);
    const body = sheet.querySelector<HTMLElement>('.matter-phone-sheet-body')!;
    Object.defineProperty(body, 'scrollTop', { value: 40 });
    const row = sheet.querySelector('button')!;
    touch(row, 'touchstart', 100, 0);
    expect(touch(row, 'touchmove', 200, 300).defaultPrevented).toBe(false);
    touch(row, 'touchend', 200, 400);
    expect(onClose).not.toHaveBeenCalled();
  });
});
