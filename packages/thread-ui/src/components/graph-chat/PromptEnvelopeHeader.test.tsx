/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { parsePromptEnvelope, PromptEnvelopeHeader, ThreadLinkContext } from './PromptEnvelope';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const id = 'bf8cee0b-f8f6-4f33-bac6-40ae6713768c';

describe('PromptEnvelopeHeader sender links', () => {
  it.each([
    [{}, true], [{ ctrlKey: true }, false], [{ metaKey: true }, false],
    [{ shiftKey: true }, false], [{ altKey: true }, false], [{ button: 1 }, false],
  ])('preserves browser handling for modified clicks %j', (modifiers, opens) => {
    const envelope = parsePromptEnvelope(`[Pockymoe task from thread ${id}]\nFix it`);
    if (envelope?.type !== 'peer') throw new Error('Expected peer envelope');
    const host = document.createElement('div');
    const root = createRoot(host);
    const open = vi.fn();
    const href = vi.fn((threadId: string) => `/devices/local/threads/${threadId}`);
    try {
      act(() => root.render(<ThreadLinkContext.Provider value={{ href, open }}><PromptEnvelopeHeader envelope={envelope} /></ThreadLinkContext.Provider>));
      const link = host.querySelector<HTMLAnchorElement>('a.prompt-envelope-link')!;
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe(`/devices/local/threads/${id}`);
      expect(link.textContent).toBe('bf8cee0b');
      expect(href).toHaveBeenCalledWith(id);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers });
      // Prevent jsdom navigation after recording the component's own default handling.
      let prevented = false;
      host.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); });
      act(() => link.dispatchEvent(click));
      expect(prevented).toBe(opens);
      if (opens) expect(open).toHaveBeenCalledExactlyOnceWith(id);
      else expect(open).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });

  it('names a sender the page knows by its title and keeps the short ID for others', () => {
    const known = parsePromptEnvelope(`[Pockymoe task from thread ${id} | Update the install notes]\nFix it`);
    const unknown = parsePromptEnvelope(`[Pockymoe task from thread ${id.replace('bf8', 'aa8')}]\nFix it`);
    if (known?.type !== 'peer' || unknown?.type !== 'peer') throw new Error('Expected peer envelopes');
    const describe = vi.fn((threadId: string) => threadId === id ? { title: 'Rebuild the home page' } : undefined);
    const host = document.createElement('div');
    const root = createRoot(host);
    const open = vi.fn();
    try {
      act(() => root.render(<ThreadLinkContext.Provider value={{ href: value => `/threads/${value}`, open, describe }}>
        <PromptEnvelopeHeader envelope={known} /><PromptEnvelopeHeader envelope={unknown} />
      </ThreadLinkContext.Provider>));
      const [titled, plain] = Array.from(host.querySelectorAll<HTMLAnchorElement>('a.prompt-envelope-link'));
      expect(titled!.textContent).toBe('Rebuild the home page');
      expect(titled!.getAttribute('href')).toBe(`/threads/${id}`);
      expect(titled!.closest('.prompt-envelope-from')?.hasAttribute('data-titled')).toBe(true);
      expect(plain!.textContent).toBe('aa8cee0b');
      expect(plain!.closest('.prompt-envelope-from')?.hasAttribute('data-titled')).toBe(false);
      act(() => titled!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      expect(open).toHaveBeenCalledExactlyOnceWith(id);
    } finally { act(() => root.unmount()); }
  });

  it('keeps cross-device senders as text even when their thread id is a UUID', () => {
    const envelope = parsePromptEnvelope(`[Pockymoe result from device-a/${id} (device "Peer laptop")]\nDone`);
    if (envelope?.type !== 'peer') throw new Error('Expected peer envelope');
    expect(envelope.fromThreadId).toBeNull();
    const host = document.createElement('div');
    const root = createRoot(host);
    const open = vi.fn();
    try {
      act(() => root.render(<ThreadLinkContext.Provider value={{ href: value => `/threads/${value}`, open }}><PromptEnvelopeHeader envelope={envelope} /></ThreadLinkContext.Provider>));
      expect(host.querySelector('a')).toBeNull();
      expect(host.querySelector('.prompt-envelope-from')?.textContent).toContain('device-a/bf8cee0b');
      expect(open).not.toHaveBeenCalled();
    } finally { act(() => root.unmount()); }
  });
});
