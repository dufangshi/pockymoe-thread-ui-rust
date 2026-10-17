import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { translate, useI18n } from '../../i18n';

/** Who sent a prompt when it was not the device owner, as the device recorded it. */
export interface MessageSenderView {
  userId: string;
  name?: string | null | undefined;
}

function displayName(sender: MessageSenderView) {
  return sender.name?.trim() || sender.userId;
}

/**
 * A stable hue per account, so two people sharing a thread look different. It
 * stays between teal and magenta: red and amber already mean failure and warning.
 */
function senderHue(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return 170 + (hash % 160);
}

const CARD_WIDTH = 240;

/** A small initial on the corner of a prompt; it opens a compact card naming the sender. */
export function MessageSenderMark({ sender }: { sender: MessageSenderView }) {
  useI18n();
  const name = displayName(sender);
  const initial = [...name][0]?.toUpperCase() ?? '?';
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const style = { '--sender-hue': String(senderHue(sender.userId)) } as CSSProperties;

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const height = card.current?.offsetHeight ?? 72;
    const width = card.current?.offsetWidth ?? CARD_WIDTH;
    const left = Math.min(Math.max(8, rect.left - 4), window.innerWidth - width - 8);
    // Above the mark, clear of the prompt it names; below only near the top edge.
    const above = rect.top - height - 6;
    const top = above >= 8 ? above : Math.min(rect.bottom + 6, window.innerHeight - height - 8);
    setPosition({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && (card.current?.contains(event.target) || button.current?.contains(event.target))) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const label = translate('chat.sentBy', { name });
  return (
    <>
      <button
        ref={button}
        type="button"
        className="thread-graph-message-sender"
        style={style}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
      >
        <span aria-hidden="true">{initial}</span>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={card}
          role="dialog"
          aria-label={label}
          className="thread-message-sender-card"
          style={{ ...style, left: position?.left ?? -9999, top: position?.top ?? -9999, maxWidth: CARD_WIDTH }}
        >
          <div className="thread-message-sender-card-head">
            <span className="thread-message-sender-avatar" aria-hidden="true">{initial}</span>
            <strong>{name}</strong>
          </div>
          <p>{translate('chat.sentThroughSharing')}</p>
          {sender.name?.trim() ? <code title={translate('chat.senderAccountId')}>{sender.userId}</code> : null}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
