import { Quote, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import { translate, useI18n } from '../../i18n';
import { FloatingCard } from '../attachments/AttachmentTile';
import type { PromptQuote } from '../composer/promptQuotes';
import { QuoteCard } from './QuoteCard';
import { useQuoteScope } from './QuoteScope';

/** A quote where a sent prompt refers to it: its mark and number, opening its card. */
export function SentQuoteMark({ n, quote }: { n: number; quote: PromptQuote }) {
  useI18n();
  const scope = useQuoteScope();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className="quote-tile is-sent" aria-label={translate('chat.quoteDetails', { n })} title={quote.text.slice(0, 120)}
        aria-expanded={Boolean(anchor)}
        onClick={(event) => { event.stopPropagation(); const button = event.currentTarget; setAnchor((current) => current ? null : button); }}>
        <span className="quote-tile-icon"><Quote aria-hidden="true" /></span>
        <span className="quote-tile-number">{n}</span>
      </button>
      {anchor ? (
        <FloatingCard anchor={anchor} onClose={() => setAnchor(null)}>
          <QuoteCard quote={quote} n={n} actions={scope ? (
            <button type="button" onClick={() => { setAnchor(null); scope.preview(quote); }}>
              <ScanSearch aria-hidden="true" />{translate('chat.quotePreview')}
            </button>
          ) : undefined} />
        </FloatingCard>
      ) : null}
    </>
  );
}
