import { Quote } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';
import type { PromptQuote } from '../composer/promptQuotes';
import { quoteSource } from './QuoteScope';

/** A quote's card: its number, who said it and in which turn, the passage, and actions.
    A passage taller than the card fades out and says how many lines are left;
    "Show all" opens it in place. */
export function QuoteCard({ quote, n, actions }: { quote: PromptQuote; n: number | string; actions?: ReactNode }) {
  useI18n();
  const textRef = useRef<HTMLQuoteElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(0);
  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node || expanded) { setHiddenLines(0); return; }
    const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 19.5;
    const hidden = node.scrollHeight - node.clientHeight;
    setHiddenLines(hidden > 4 ? Math.max(1, Math.ceil(hidden / lineHeight)) : 0);
  }, [quote.text, expanded]);
  return (
    <div className="quote-card">
      <div className="quote-card-head">
        <Quote aria-hidden="true" />
        <strong>{translate('chat.quoteDetails', { n })}</strong>
        <span>{quoteSource(quote)}</span>
      </div>
      <blockquote ref={textRef} className="quote-card-text" data-clipped={hiddenLines > 0 || undefined} data-expanded={expanded || undefined}>{quote.text}</blockquote>
      {hiddenLines > 0 ? (
        <button type="button" className="quote-card-more" onClick={() => setExpanded(true)}>
          {translate('chat.quoteMoreLines', { count: hiddenLines })}
        </button>
      ) : null}
      {actions ? <div className="attachment-card-actions quote-card-actions">{actions}</div> : null}
    </div>
  );
}
