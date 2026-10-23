import { translate, useI18n } from '../../i18n';
import { useRef, useState } from 'react';
import { GraphWorkspaceImageLightbox } from '../ZoomableImage';
import { Quote, ScanSearch, X } from 'lucide-react';
import type { ComposerQuoteDraft } from './composerUtils';
import type { PromptQuote } from './promptQuotes';
import { QuoteCard } from '../quotes/QuoteCard';
import { useQuoteScope } from '../quotes/QuoteScope';
import { AttachmentCard, FloatingCard, ViewAction } from '../attachments/AttachmentTile';
import type { FileFamily } from '../attachments/attachmentFiles';
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from 'react';

interface ComposerPromptEditorProps {
  promptRef: RefObject<HTMLDivElement | null>;
  prompt: string;
  /** The quotes the prompt refers to, in its order: small marks above it. */
  quotes?: ComposerQuoteDraft[];
  disabled: boolean;
  promptPlaceholder: string;
  /** How to send, shown after the placeholder where there is a keyboard. */
  promptPlaceholderHint?: string;
  canInterrupt: boolean;
  interruptLabel: string;
  composerPromptRegionClassName: string;
  graphChatInputClassName: string;
  onInterrupt?: () => Promise<void> | void;
  onInput: () => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp: () => void;
  onMouseUp: () => void;
  onBlur: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function hasIOSNativeBridge() {
  const nativeWindow = window as Window & {
    webkit?: {
      messageHandlers?: {
        remoteCodex?: unknown;
      };
    };
  };
  return Boolean(nativeWindow.webkit?.messageHandlers?.remoteCodex);
}

/** A quote's first few characters, to tell the marks apart. */
function quoteExcerpt(text: string) {
  const points = Array.from(text.replace(/\s+/g, ' ').trim());
  return points.length > 8 ? `${points.slice(0, 8).join('')}…` : points.join('');
}

export function ComposerPromptEditor({
  promptRef,
  prompt,
  quotes = [],
  disabled,
  promptPlaceholder,
  promptPlaceholderHint = '',
  composerPromptRegionClassName,
  graphChatInputClassName,
  onInput,
  onPointerDown,
  onPaste,
  onKeyDown,
  onKeyUp,
  onMouseUp,
  onBlur,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: ComposerPromptEditorProps) {
  useI18n();
  const previewTrigger = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{src: string; alt: string} | null>(null);
  // An attachment tile opens its card: name, kind, size, and view or remove.
  const [details, setDetails] = useState<HTMLElement | null>(null);
  const quoteScope = useQuoteScope();
  const detailsQuote = details?.dataset.kind === 'quote' && details.dataset.quote
    ? (JSON.parse(details.dataset.quote) as PromptQuote) : null;
  const detailsNumber = details?.dataset.placeholder?.match(/\d+/)?.[0] ?? '';
  // Removing a quote removes its tile from the prompt, wherever the card was opened.
  const removeDetails = () => {
    if (!details) return;
    const tile = details.closest('[contenteditable]') ? details
      : promptRef.current?.querySelector(`[data-client-id="${CSS.escape(details.dataset.clientId ?? '')}"]`);
    tile?.remove();
    setDetails(null);
    onInput();
    promptRef.current?.focus({ preventScroll: true });
  };
  function attachmentTile(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>('[data-segment-type="attachment"]') : null;
  }
  const detailsImage = details?.querySelector('img');
  const view = details && detailsImage ? () => {
    previewTrigger.current = details;
    setDetails(null);
    setPreview({ src: detailsImage.src, alt: details.dataset.name ?? '' });
  } : undefined;
  return (
    <div
      data-slot="input-group-control"
      className={`${composerPromptRegionClassName} relative w-full`}
    >
      {quotes.length > 0 ? (
        <div className="composer-quote-row" role="group" aria-label={translate('chat.quotes')}>
          {quotes.map((quote) => {
            const n = quote.placeholder.match(/\d+/)?.[0] ?? '';
            return (
              <button key={quote.clientId} type="button" className="composer-quote-mark"
                data-kind="quote" data-client-id={quote.clientId} data-placeholder={quote.placeholder} data-quote={JSON.stringify(quote.quote)}
                aria-label={translate('chat.quoteDetails', { n })} title={quote.quote.text.slice(0, 120)}
                aria-expanded={details?.dataset.clientId === quote.clientId}
                onClick={(event) => { const button = event.currentTarget; setDetails(current => current === button ? null : button); }}>
                <Quote aria-hidden="true" /><span className="composer-quote-mark-number">{n}</span>
                <span className="composer-quote-mark-text">{quoteExcerpt(quote.quote.text)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={graphChatInputClassName}>
        {prompt.length === 0 && promptPlaceholder && (
          <span
            className={`thread-composer-placeholder pointer-events-none absolute left-3 top-3 truncate text-slate-500 sm:left-4 sm:top-4 dark:text-slate-400 right-3 sm:right-4`}
          >
            {promptPlaceholder}
            {promptPlaceholderHint ? <span className="thread-composer-placeholder-hint">{promptPlaceholderHint}</span> : null}
          </span>
        )}
        <div
          ref={promptRef}
          role="textbox"
          aria-label={translate("chat.prompt")}
          aria-multiline="true"
          contentEditable={disabled ? false : 'plaintext-only'}
          inputMode="text"
          suppressContentEditableWarning
          onClick={event => {
            const tile = attachmentTile(event.target);
            if (tile) { event.preventDefault(); setDetails(current => current === tile ? null : tile); }
          }}
          onPointerDown={(event) => {
            if (attachmentTile(event.target)) { event.preventDefault(); return; }
            if (
              !disabled &&
              document.activeElement !== event.currentTarget &&
              hasIOSNativeBridge()
            ) {
              // WKWebView only opens the software keyboard reliably when focus
              // is requested synchronously from the user's touch gesture.
              event.currentTarget.focus({ preventScroll: true });
            }
            onPointerDown?.(event);
          }}
          onCompositionStart={event => {
            event.currentTarget.dataset.imeComposing = 'true';
          }}
          onCompositionEnd={event => {
            delete event.currentTarget.dataset.imeComposing;
            onInput();
          }}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={event => {
            if (event.currentTarget.dataset.imeComposing === 'true' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            const tile = attachmentTile(event.target);
            if (tile && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); setDetails(tile); return;
            }
            onKeyDown(event);
          }}
          onKeyUp={onKeyUp}
          onMouseUp={onMouseUp}
          onBlur={onBlur}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative z-[1] min-h-[4.25rem] whitespace-pre-wrap break-words pb-2 outline-none sm:min-h-[4.25rem] ${disabled ? 'cursor-not-allowed text-slate-500' : ''}`}
        />
      </div>
      {details?.isConnected && detailsQuote ? (
        <FloatingCard anchor={details} onClose={() => setDetails(null)}>
          <QuoteCard quote={detailsQuote} n={detailsNumber} actions={<>
            {quoteScope ? (
              <button type="button" onClick={() => { setDetails(null); quoteScope.preview(detailsQuote); }}>
                <ScanSearch aria-hidden="true" />{translate('chat.quotePreview')}
              </button>
            ) : null}
            <button type="button" className="is-danger" onClick={removeDetails}><X aria-hidden="true" />{translate('chat.attachmentRemove')}</button>
          </>} />
        </FloatingCard>
      ) : details?.isConnected ? (
        <FloatingCard anchor={details} onClose={() => setDetails(null)}>
          <AttachmentCard name={details.dataset.name ?? ''} family={(details.dataset.family ?? 'other') as FileFamily}
            size={details.dataset.size ? Number(details.dataset.size) : undefined} thumbnail={detailsImage?.src} onView={view}
            actions={<>
              {view ? <ViewAction onClick={view} /> : null}
              <button type="button" className="is-danger" onClick={() => {
                details.remove();
                setDetails(null);
                onInput();
                promptRef.current?.focus({ preventScroll: true });
              }}><X aria-hidden="true" />{translate('chat.attachmentRemove')}</button>
            </>} />
        </FloatingCard>
      ) : null}
      {preview ? <GraphWorkspaceImageLightbox src={preview.src} alt={preview.alt} onClose={() => {
        setPreview(null);
        previewTrigger.current?.focus({preventScroll: true});
      }} /> : null}
    </div>
  );
}
