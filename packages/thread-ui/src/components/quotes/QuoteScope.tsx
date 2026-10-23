import { createContext, useContext, useEffect, useRef } from 'react';
import { translate } from '../../i18n';
import type { PromptQuote } from '../composer/promptQuotes';

/**
 * One conversation pane's quoting: its composer takes quotes in, and anything in
 * the pane (a tile in the composer, a quote in a sent prompt) can show where a
 * quote came from. Each pane of a split has its own scope.
 */
export interface QuoteScope {
  /** The composer that takes quotes registers here; it returns the release. */
  connect: (insert: (quote: PromptQuote) => void) => () => void;
  /** Adds a quote to this pane's composer; false when it has none. */
  insert: (quote: PromptQuote) => boolean;
  /** Shows the quoted passage where it was, over the conversation. */
  preview: (quote: PromptQuote) => void;
}

export const QuoteScopeContext = createContext<QuoteScope | null>(null);

export function useQuoteScope() {
  return useContext(QuoteScopeContext);
}

/** Registers a composer's insert with the pane's scope while it is mounted. */
export function useQuoteSink(insert: (quote: PromptQuote) => void) {
  const scope = useQuoteScope();
  const latest = useRef(insert);
  latest.current = insert;
  useEffect(() => scope?.connect((quote) => latest.current(quote)), [scope]);
}

/** Who a quote is from and where, e.g. "Agent · turn 12". */
export function quoteSource(quote: PromptQuote) {
  const who = translate(quote.from === 'user' ? 'chat.quoteFromYou' : 'chat.quoteFromAgent');
  return quote.turn ? `${who} · ${translate('chat.quoteTurn', { turn: quote.turn })}` : who;
}
