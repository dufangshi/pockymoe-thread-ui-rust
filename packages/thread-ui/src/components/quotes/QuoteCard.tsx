import { Quote } from 'lucide-react';
import type { ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';
import type { PromptQuote } from '../composer/promptQuotes';
import { quoteSource } from './QuoteScope';

/** A quote's card: its number, who said it and in which turn, the passage, and actions. */
export function QuoteCard({ quote, n, actions }: { quote: PromptQuote; n: number | string; actions?: ReactNode }) {
  useI18n();
  return (
    <div className="quote-card">
      <div className="quote-card-head">
        <Quote aria-hidden="true" />
        <strong>{translate('chat.quoteDetails', { n })}</strong>
        <span>{quoteSource(quote)}</span>
      </div>
      <blockquote className="quote-card-text">{quote.text}</blockquote>
      {actions ? <div className="attachment-card-actions quote-card-actions">{actions}</div> : null}
    </div>
  );
}
