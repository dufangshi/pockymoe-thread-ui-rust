// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { GraphChatUserMessageBody } from '../graph-chat/GraphChatMessageBody';
import { composeQuotedPrompt } from '../composer/promptQuotes';
import { QuoteScopeContext, type QuoteScope } from './QuoteScope';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('shows a quoting prompt as its own words with a mark where each quote is, opening the passage', () => {
  const quote = { text: 'Use a queue per device.', from: 'assistant' as const, turn: 4, turnId: 't4', itemId: 'm1' };
  const text = composeQuotedPrompt('Why [QUOTE 1]?', new Map([['[QUOTE 1]', quote]]));
  const preview = vi.fn();
  const scope: QuoteScope = { connect: () => () => {}, insert: () => false, preview };
  act(() => root.render(<QuoteScopeContext.Provider value={scope}><GraphChatUserMessageBody text={text} /></QuoteScopeContext.Provider>));
  expect(host.textContent).toBe('Why 1?');
  expect(host.textContent).not.toContain('pockymoe-quotes');
  const mark = host.querySelector<HTMLButtonElement>('button.quote-tile')!;
  expect(mark.getAttribute('aria-label')).toBe('Quote 1');
  act(() => mark.click());
  const card = document.querySelector('.quote-card')!;
  expect(card.textContent).toContain('Use a queue per device.');
  expect(card.textContent).toContain('Agent · turn 4');
  act(() => [...card.querySelectorAll('button')].find(button => button.textContent === 'Show where it was')!.click());
  expect(preview).toHaveBeenCalledWith(quote);
});
