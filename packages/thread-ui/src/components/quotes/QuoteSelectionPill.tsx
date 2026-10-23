import { Quote } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { shellThemeProps } from '../themeHooks';
import { translate, useI18n } from '../../i18n';
import type { PromptQuote } from '../composer/promptQuotes';

const MESSAGE = '[data-testid="chat-message"]';

/** What a selection in this pane's conversation quotes, if it lies in one message. */
function selectedQuote(root: HTMLElement, turnNumber: (turnId: string) => number | null): { quote: PromptQuote; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const element = (node: Node | null) => (node instanceof Element ? node : node?.parentElement) ?? null;
  const start = element(range.startContainer)?.closest<HTMLElement>(MESSAGE);
  const end = element(range.endContainer)?.closest<HTMLElement>(MESSAGE);
  // One message, in this pane's conversation (not the composer, not a dialog).
  if (!start || start !== end || !root.contains(start) || !start.closest('.thread-timeline-surface')) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const turnId = start.closest<HTMLElement>('[data-turn-id]')?.dataset.turnId ?? null;
  return {
    quote: {
      text,
      from: start.dataset.role === 'user' ? 'user' : 'assistant',
      turn: turnId ? turnNumber(turnId) : null,
      turnId,
      itemId: start.dataset.messageId ?? null,
    },
    rect: range.getBoundingClientRect(),
  };
}

/**
 * Selecting text in one message offers Quote. Phones put it just above the
 * composer, where the thumb is and the system's own selection menu never is;
 * with a mouse it sits under the end of the selection. It shows only while
 * something is selected. Browsers give pages no way into the system menu.
 */
export function QuoteSelectionPill({ root, composerRef, turnNumber, onQuote }: {
  root: RefObject<HTMLElement | null>;
  composerRef: RefObject<HTMLElement | null>;
  turnNumber: (turnId: string) => number | null;
  onQuote: (quote: PromptQuote) => void;
}) {
  useI18n();
  const [offer, setOffer] = useState<{ quote: PromptQuote; left: number; top: number; docked: boolean } | null>(null);
  const pressing = useRef(false);
  const number = useRef(turnNumber);
  number.current = turnNumber;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Pressing the pill can clear the selection (iOS) before its click: keep the offer.
        if (pressing.current) return;
        const pane = root.current;
        const found = pane ? selectedQuote(pane, number.current) : null;
        if (!found) { setOffer(null); return; }
        const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const composer = composerRef.current?.getBoundingClientRect();
        if (touch && composer && composer.height > 0) {
          setOffer({ quote: found.quote, left: composer.left + composer.width / 2, top: composer.top - 10, docked: true });
        } else {
          setOffer({ quote: found.quote, left: Math.min(found.rect.right, window.innerWidth - 60), top: Math.min(found.rect.bottom + 8, window.innerHeight - 48), docked: false });
        }
      });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('selectionchange', update); window.removeEventListener('resize', update); };
  }, [root, composerRef]);

  if (!offer) return null;
  const take = () => {
    pressing.current = false;
    onQuote(offer.quote);
    window.getSelection()?.removeAllRanges();
    setOffer(null);
  };
  const theme = shellThemeProps(root.current);
  // On the page's body: a transformed pane would move a fixed element with it.
  return createPortal(
    <div className={`thread-ui-shell quote-selection-layer ${theme.themeClass}`.trim()} data-theme-effective={theme['data-theme-effective']}>
    <button
      type="button"
      className="quote-selection-pill"
      data-docked={offer.docked || undefined}
      style={{ left: offer.left, top: offer.top }}
      title={translate('chat.quoteSelectionHint')}
      aria-label={translate('chat.quoteSelectionHint')}
      // Keep the selection while pressing: a mouse press would clear it before the click.
      onPointerDown={(event) => { pressing.current = true; event.preventDefault(); }}
      onPointerCancel={() => { pressing.current = false; }}
      onClick={take}
    >
      <Quote aria-hidden="true" />{translate('chat.quoteSelection')}
    </button>
    </div>,
    document.body,
  );
}
