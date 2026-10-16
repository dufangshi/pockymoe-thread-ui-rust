/** @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { SettingsDialog } from './SettingsDialog';

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

const sections = [
  { id: 'session', label: 'Session', content: <p>Session body</p> },
  { id: 'preferences', label: 'Preferences', content: <p>Preferences body</p> },
];

it('keeps an owner-held section when the dialog remounts elsewhere', () => {
  let move: () => void = () => {};
  function Owner() {
    const [section, setSection] = useState<string | undefined>();
    const [where, setWhere] = useState<'sheet' | 'bar'>('sheet');
    move = () => setWhere('bar');
    const dialog = <SettingsDialog open sections={sections} initialId="session" section={section} onSectionChange={setSection} />;
    return where === 'sheet' ? <section>{dialog}</section> : <header>{dialog}</header>;
  }
  act(() => root.render(<Owner />));
  const tab = () => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(item => item.textContent === 'Preferences')!;
  act(() => tab().click());
  expect(document.body.textContent).toContain('Preferences body');
  act(() => move());
  expect(tab().getAttribute('aria-selected')).toBe('true');
  expect(document.body.textContent).toContain('Preferences body');
});
