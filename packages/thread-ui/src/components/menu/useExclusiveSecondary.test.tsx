/** @vitest-environment jsdom */
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { useExclusiveSecondary } from './useExclusiveSecondary';

it.each(['menu', 'sheet'] as const)('an avatar menu replaces a %s and is replaced in return', kind => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Window({ name, kind, replace = false }: { name: string; kind: 'menu' | 'sheet'; replace?: boolean }) {
    const ref = useRef<HTMLDivElement>(null), [open, setOpen] = useState(false);
    useExclusiveSecondary(ref, open, () => setOpen(false), kind, replace);
    return <div ref={ref} data-open={open}><button onClick={() => setOpen(true)}>{name}</button></div>;
  }
  act(() => root.render(<><Window name="other" kind={kind} /><Window name="avatar" kind="menu" replace /></>));
  const buttons = host.querySelectorAll('button');
  act(() => buttons[0]!.click());
  act(() => buttons[1]!.click());
  expect(buttons[0]!.parentElement!.dataset.open).toBe('false');
  expect(buttons[1]!.parentElement!.dataset.open).toBe('true');
  act(() => buttons[0]!.click());
  expect(buttons[1]!.parentElement!.dataset.open).toBe('false');
  act(() => root.unmount()); host.remove();
});
