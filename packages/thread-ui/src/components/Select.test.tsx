/** @vitest-environment jsdom */
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Select } from './Select';
import * as Dialog from '@radix-ui/react-dialog';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 30, left: 20, top: 30, right: 220, bottom: 62, width: 200, height: 32, toJSON() {} });
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 200, height: 32 }] as unknown as DOMRectList);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = (node: ReactNode) => act(() => root.render(node));
const click = (node: Element) => act(() => (node as HTMLElement).click());
const key = (node: Element, value: string, shiftKey = false) => act(() => node.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true })));
const trigger = () => host.querySelector<HTMLButtonElement>('[role=combobox]')!;
const choices = () => [...document.querySelectorAll<HTMLButtonElement>('[role=option]')];

it('renders a portal listbox and preserves labels, disabled options, and selected-value focus', () => {
  const changed = vi.fn();
  render(<label>Device<Select value="b" onValueChange={changed}><option value="a" disabled>Offline</option><optgroup label="Available"><option value="b">Laptop</option><option value="c">Studio</option></optgroup></Select></label>);
  click(trigger());
  expect(host.querySelector('[role=listbox]')).toBeNull();
  expect(document.querySelector('[role=listbox]')?.parentElement).toBe(document.body);
  expect(document.querySelector('select')).toBeNull(); expect(choices()[0]?.disabled).toBe(true);
  expect(document.activeElement).toBe(choices()[1]);
  key(choices()[1]!, 'ArrowDown'); expect(document.activeElement).toBe(choices()[2]);
  key(choices()[2]!, 'Enter'); expect(changed).toHaveBeenCalledWith('c');
  expect(document.querySelector('[role=listbox]')).toBeNull(); expect(document.activeElement).toBe(trigger());
  expect(trigger().textContent).toBe('Laptop'); // Controlled value remains owned by caller.
});

it('keeps form data, required validation, reset, and implicit label association', () => {
  render(<form><label htmlFor="model">Model</label><Select id="model" name="model" required defaultValue=""><option value="">Choose</option><option value="gpt">GPT</option></Select></form>);
  const form = host.querySelector('form')!;
  expect(trigger().labels?.[0]?.textContent).toBe('Model');
  act(() => { expect(form.checkValidity()).toBe(false); });
  expect(trigger().getAttribute('aria-invalid')).toBe('true');
  click(trigger()); click(choices()[1]!);
  expect(new FormData(form).get('model')).toBe('gpt'); expect(form.checkValidity()).toBe(true);
  act(() => form.reset()); expect(new FormData(form).get('model')).toBe(''); expect(trigger().textContent).toBe('Choose');
});

it('uses the current locale labels without remounting a controlled form', () => {
  function Form() { const [chinese, setChinese] = useState(false); return <><button id="locale" onClick={() => setChinese(!chinese)}>Language</button><Select value="en" aria-label="Locale" options={[{ value: 'en', label: chinese ? '英语' : 'English' }, { value: 'zh', label: chinese ? '中文' : 'Chinese' }]} /></>; }
  render(<Form />); const original = trigger(); click(original); click(host.querySelector('#locale')!);
  expect(trigger()).toBe(original); expect(trigger().textContent).toBe('英语'); expect(choices()[0]?.textContent).toBe('英语');
});

it('supports home/end, wrapping, escape focus restoration, and skips disabled entries', () => {
  render(<Select defaultValue="b" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Blocked', disabled: true }]} />);
  key(trigger(), 'ArrowDown'); key(choices()[1]!, 'End'); expect(document.activeElement).toBe(choices()[1]);
  key(choices()[1]!, 'ArrowDown'); expect(document.activeElement).toBe(choices()[0]);
  key(choices()[0]!, 'Home'); expect(document.activeElement).toBe(choices()[0]);
  key(choices()[0]!, 'Escape'); expect(document.querySelector('[role=listbox]')).toBeNull(); expect(document.activeElement).toBe(trigger());
});

it('supports typeahead without changing the value until the user chooses', () => {
  const changed = vi.fn(); render(<Select value="a" onValueChange={changed} options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Bravo' }]} />);
  key(trigger(), 'b'); expect(document.activeElement).toBe(choices()[1]); expect(changed).not.toHaveBeenCalled();
  key(choices()[1]!, 'r'); expect(document.activeElement).toBe(choices()[2]);
  key(choices()[2]!, ' '); expect(changed).toHaveBeenCalledWith('c');
});

it('tabs to the next control in the form rather than to the end of the portal tree', () => {
  render(<><input id="before" /><Select options={[{ value: 'a', label: 'Alpha' }]} /><input id="after" /></>);
  click(trigger()); key(choices()[0]!, 'Tab'); expect(document.activeElement).toBe(host.querySelector('#after'));
  click(trigger()); key(choices()[0]!, 'Tab', true); expect(document.activeElement).toBe(host.querySelector('#before'));
});

it('clamps the portal to the viewport and opens above a trigger near its lower edge', () => {
  vi.stubGlobal('innerWidth', 800); vi.stubGlobal('innerHeight', 700);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ x: 700, y: 650, left: 700, top: 650, right: 900, bottom: 682, width: 200, height: 32, toJSON() {} });
  render(<Select options={[{ value: 'a', label: 'Alpha' }]} />); click(trigger());
  const list = document.querySelector<HTMLElement>('[role=listbox]')!;
  expect(parseFloat(list.style.left)).toBeLessThanOrEqual(592); expect(parseFloat(list.style.top)).toBeLessThan(650);
  act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  expect(document.querySelector('[role=listbox]')).toBeNull();
});

it('closes when disabled and excludes disabled fields from FormData', () => {
  render(<form><Select name="device" value="a" options={[{ value: 'a', label: 'Alpha' }]} /></form>); click(trigger());
  render(<form><Select name="device" value="a" disabled options={[{ value: 'a', label: 'Alpha' }]} /></form>);
  expect(document.querySelector('[role=listbox]')).toBeNull(); expect(trigger().disabled).toBe(true); expect(new FormData(host.querySelector('form')!).has('device')).toBe(false);
});


it('keeps option focus inside a parent Radix modal and returns without dismissing or scrolling it', async () => {
  await act(async () => root.render(<Dialog.Root open><Dialog.Portal><Dialog.Content aria-describedby={undefined}><Dialog.Title>Parent form</Dialog.Title><Select value="b" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} /></Dialog.Content></Dialog.Portal></Dialog.Root>));
  const control = document.querySelector<HTMLButtonElement>('[role=combobox]')!;
  const dialog = document.querySelector<HTMLElement>('[role=dialog]')!;
  await act(async () => control.click()); expect(document.activeElement).toBe(choices()[1]);
  key(choices()[1]!, 'ArrowUp'); expect(document.activeElement).toBe(choices()[0]);
  key(choices()[0]!, 'Escape'); expect(document.activeElement).toBe(control);
  expect(document.querySelector('[role=dialog]')).toBe(dialog); expect(dialog.scrollLeft).toBe(0);
});
