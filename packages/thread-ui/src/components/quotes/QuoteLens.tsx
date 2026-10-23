import { X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { translate, useI18n } from '../../i18n';
import type { PromptQuote } from '../composer/promptQuotes';
import { useModalFocus } from '../menu/useModalFocus';
import { shellThemeProps } from '../themeHooks';
import { QuoteCard } from './QuoteCard';
import { quoteSource } from './QuoteScope';

const HIGHLIGHT = 'pockymoe-quote';
const MESSAGE = '[data-testid="chat-message"]';

/**
 * The source message in this pane's conversation, with the messages around it
 * that fill about half a screen above and below it (as shown, so it can be read
 * in context and scrolled a little), or null when it is not shown.
 */
function sourceMessages(root: HTMLElement, quote: PromptQuote) {
  const messages = [...root.querySelectorAll<HTMLElement>(MESSAGE)].filter((message) => message.closest('.thread-timeline-surface'));
  const start = squash(quote.text.split(' … ')[0]!).slice(0, 60);
  let index = quote.itemId ? messages.findIndex((message) => message.dataset.messageId === quote.itemId) : -1;
  if (index < 0 && start) index = messages.findIndex((message) => squash(message.textContent ?? '').includes(start));
  if (index < 0) return null;
  const reach = window.innerHeight / 2;
  const height = (message: HTMLElement) => message.getBoundingClientRect().height + 14;
  let first = index, last = index;
  for (let room = reach; first > 0 && room > 0; ) room -= height(messages[--first]!);
  for (let room = reach; last < messages.length - 1 && room > 0; ) room -= height(messages[++last]!);
  return { messages: messages.slice(first, last + 1), source: messages[index]! };
}

const squash = (text: string) => text.replace(/\s+/g, '');

/** The quoted passage inside a copied message, as a range: whitespace is ignored. */
function passageRange(element: HTMLElement, text: string) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  const positions: Array<{ node: Text; offset: number }> = [];
  let joined = '';
  for (const node of nodes) {
    for (let offset = 0; offset < node.data.length; offset += 1) {
      if (/\s/.test(node.data[offset]!)) continue;
      joined += node.data[offset];
      positions.push({ node, offset });
    }
  }
  const parts = text.split(' … ').map(squash).filter(Boolean);
  const first = parts[0] ?? '';
  const at = first ? joined.indexOf(first) : -1;
  if (at < 0) return null;
  const last = parts.length > 1 ? parts.at(-1)! : '';
  const tail = last ? joined.indexOf(last, at + first.length) : -1;
  const end = tail >= 0 ? tail + last.length - 1 : at + first.length - 1;
  const range = document.createRange();
  range.setStart(positions[at]!.node, positions[at]!.offset);
  range.setEnd(positions[end]!.node, positions[end]!.offset + 1);
  return range;
}

/**
 * Where a quote came from, without moving the conversation: a window over the
 * pane with the source message between its neighbours, the passage marked and
 * in view. Closing it leaves the reader where they were.
 */
export function QuoteLens({ quote, root, onClose }: { quote: PromptQuote; root: RefObject<HTMLElement | null>; onClose: () => void }) {
  useI18n();
  const windowRef = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState(true);
  useModalFocus(windowRef, true, onClose);
  const theme = shellThemeProps(root.current);

  useLayoutEffect(() => {
    const container = body.current;
    const pane = root.current;
    if (!container || !pane) return;
    const located = sourceMessages(pane, quote);
    if (!located) { setFound(false); return; }
    container.replaceChildren();
    let sourceCopy: HTMLElement | null = null;
    for (const message of located.messages) {
      const copy = message.cloneNode(true) as HTMLElement;
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      copy.dataset.quoteLensSource = message === located.source ? 'true' : 'false';
      container.append(copy);
      if (message === located.source) sourceCopy = copy;
    }
    const range = sourceCopy ? passageRange(sourceCopy, quote.text) : null;
    const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const Highlight = (window as unknown as { Highlight?: new (range: Range) => unknown }).Highlight;
    if (range && highlights && Highlight) highlights.set(HIGHLIGHT, new Highlight(range));
    // The passage (or its message) opens in the middle; the context scrolls around it.
    const target = range?.getBoundingClientRect() ?? sourceCopy?.getBoundingClientRect();
    if (target) {
      const box = container.getBoundingClientRect();
      container.scrollTop += target.top - box.top - Math.max(16, (box.height - Math.min(target.height, box.height)) / 2);
    }
    return () => { highlights?.delete(HIGHLIGHT); };
  }, [quote, root]);

  return createPortal(
    <div className={`thread-ui-shell quote-lens-scrim ${theme.themeClass}`.trim()} data-theme-effective={theme['data-theme-effective']}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={windowRef} role="dialog" aria-modal="true" aria-label={translate('chat.quoteLens')} className="quote-lens" tabIndex={-1}>
        <div className="quote-lens-head">
          <span>{translate('chat.quoteLens')} · {quoteSource(quote)}</span>
          <button type="button" aria-label={translate('files.close')} title={translate('files.close')} onClick={onClose}><X aria-hidden="true" /></button>
        </div>
        {found ? (
          // A copy of the conversation, to read: nothing in it acts.
          <div ref={body} className="quote-lens-body thread-graph-message-list" inert />
        ) : (
          <div className="quote-lens-body">
            <p className="quote-lens-note">{translate('chat.quoteNotLoaded')}</p>
            <QuoteCard quote={quote} n="" />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
