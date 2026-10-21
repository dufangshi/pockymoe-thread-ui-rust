import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, RotateCw } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { shellThemeProps, surfaceBehind } from '../themeHooks';

/**
 * Why something failed, or why a control cannot be used, without a paragraph
 * of red text in the page: a small, quiet exclamation mark that opens the
 * reason (and a Retry, when there is one) in a bubble on a tap. Screen readers
 * still hear the reason when it appears. Put it after the control it explains;
 * a control that cannot be used stays in place, greyed and disabled.
 */
export function ErrorMark({
  message,
  detail,
  kind = 'error',
  label,
  onRetry,
  retryLabel,
  className = '',
  announce = true,
  tabIndex,
}: {
  message: string;
  /** The raw error under a readable message, in small type. */
  detail?: string | undefined;
  /** `unavailable`: the reason a control next to it is disabled. */
  kind?: 'error' | 'unavailable';
  label?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  className?: string | undefined;
  /** Say the reason aloud when it appears (an action that just failed). A
      record of an earlier failure (a past turn) is not announced. */
  announce?: boolean;
  tabIndex?: number | undefined;
}) {
  useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({ left: -9999, top: -9999 });
  const name = label ?? translate(kind === 'unavailable' ? 'common.whyUnavailable' : 'common.whyFailed');

  // Below the mark, or above it when there is no room; kept inside the window.
  const placeBubble = useCallback(() => {
    const button = trigger.current?.getBoundingClientRect();
    const box = bubble.current?.getBoundingClientRect();
    if (!button || !box) return;
    const width = Math.min(box.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(button.left + button.width / 2 - width / 2, window.innerWidth - width - 8));
    const below = button.bottom + 6 + box.height <= window.innerHeight - 8 || button.top - 6 - box.height < 8;
    setPlace((current) => ({ ...current, left, top: below ? button.bottom + 6 : button.top - 6 - box.height }));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // The bubble lives on the page's body: it takes the inks of the place it
    // explains (the text around the mark, the surface behind it).
    const host = trigger.current?.parentElement ?? trigger.current;
    const ink = host ? getComputedStyle(host).color : undefined;
    setPlace((current) => ({
      ...current,
      ...(ink ? { color: ink, borderColor: `color-mix(in srgb, ${ink} 22%, transparent)` } : {}),
      background: surfaceBehind(trigger.current),
    }));
    placeBubble();
  }, [open, message, detail, placeBubble]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!bubble.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    // On window, capturing: an open bubble takes Esc before the window or menu
    // around it (which would close as a whole).
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    // The page may still settle as the bubble opens (a phone's composer folds
    // and the transcript scrolls): the bubble follows the mark, and closes once
    // the mark has left the window.
    const follow = (event: Event) => {
      if (event.target instanceof Node && bubble.current?.contains(event.target)) return;
      const button = trigger.current?.getBoundingClientRect();
      if (!button || button.bottom < 0 || button.top > window.innerHeight) setOpen(false);
      else placeBubble();
    };
    // A press in the bubble belongs to whatever holds the mark: a menu, a search
    // or a window that closes on an outside press must not close for it.
    const own = bubble.current;
    const keep = (event: Event) => event.stopPropagation();
    own?.addEventListener('pointerdown', keep);
    own?.addEventListener('mousedown', keep);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
      own?.removeEventListener('pointerdown', keep);
      own?.removeEventListener('mousedown', keep);
    };
  }, [open, placeBubble]);

  const theme = shellThemeProps(trigger.current);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`error-mark ${className}`.trim()}
        data-kind={kind}
        aria-label={name}
        title={name}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        tabIndex={tabIndex}
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
      >
        <CircleAlert aria-hidden="true" />
      </button>
      {kind === 'error' && announce ? <span className="sr-only" role="alert">{message}</span> : null}
      {open ? createPortal(
        <div
          ref={bubble}
          id={id}
          role="dialog"
          aria-label={name}
          className={`thread-ui-shell error-mark-bubble ${theme.themeClass}`.trim()}
          data-theme-effective={theme['data-theme-effective']}
          data-kind={kind}
          style={place}
        >
          <p className="error-mark-message">{message}</p>
          {detail ? <pre className="error-mark-detail">{detail}</pre> : null}
          {onRetry ? (
            <button type="button" className="error-mark-retry" onClick={() => { setOpen(false); onRetry(); }}>
              <RotateCw aria-hidden="true" />
              {retryLabel ?? translate('common.retry')}
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
