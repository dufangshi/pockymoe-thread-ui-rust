import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, RotateCw } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { shellThemeProps } from '../themeHooks';

/**
 * Why something failed, or why a control cannot be used, without a paragraph
 * of red text in the page: a small, quiet exclamation mark that opens the
 * reason (and a Retry, when there is one) in a bubble on a tap. Screen readers
 * still hear the reason when it appears. Put it after the control it explains;
 * a control that cannot be used stays in place, greyed and disabled.
 */
export function ErrorMark({
  message,
  kind = 'error',
  label,
  onRetry,
  retryLabel,
  className = '',
}: {
  message: string;
  /** `unavailable`: the reason a control next to it is disabled. */
  kind?: 'error' | 'unavailable';
  label?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  className?: string | undefined;
}) {
  useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({ left: -9999, top: -9999 });
  const name = label ?? translate(kind === 'unavailable' ? 'common.whyUnavailable' : 'common.whyFailed');

  useLayoutEffect(() => {
    if (!open) return;
    const button = trigger.current?.getBoundingClientRect();
    const box = bubble.current?.getBoundingClientRect();
    if (!button || !box) return;
    const width = Math.min(box.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(button.left + button.width / 2 - width / 2, window.innerWidth - width - 8));
    const below = button.bottom + 6 + box.height <= window.innerHeight - 8 || button.top - 6 - box.height < 8;
    setPlace(below ? { left, top: button.bottom + 6 } : { left, top: button.top - 6 - box.height });
  }, [open, message]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!bubble.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const away = (event: Event) => { if (!bubble.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', away);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', away);
      window.removeEventListener('scroll', away, true);
    };
  }, [open]);

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
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
      >
        <CircleAlert aria-hidden="true" />
      </button>
      {kind === 'error' ? <span className="sr-only" role="alert">{message}</span> : null}
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
