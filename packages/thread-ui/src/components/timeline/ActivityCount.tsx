import { useEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Bot, Check, FileText, Lightbulb, Search, SquareTerminal, Wrench, X } from 'lucide-react';

import { translate, useI18n } from '../../i18n';
import type { ActivityPart } from './activity';

const HINT_DELAY_MS = 400;

type HintKey = 'commands' | 'failed' | 'reads' | 'searches' | 'agents' | 'tools' | 'reasoning' | 'wakes';

const ICONS: Record<HintKey, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  commands: Check,
  failed: X,
  reads: FileText,
  searches: Search,
  agents: Bot,
  tools: Wrench,
  reasoning: Lightbulb,
  wakes: BellRing,
};

export function countedPart(part: ActivityPart): part is ActivityPart & { key: HintKey; count: number } {
  return part.count !== undefined && part.key in ICONS;
}

/** A count as a small icon and its number; resting the pointer on it a moment
    explains the kind with an example. A tap on a touch screen pins the same
    explanation (it does not fold the line it sits in); a tap anywhere closes it. */
export function ActivityCount({ part }: { part: ActivityPart & { key: HintKey; count: number } }) {
  useI18n();
  const Icon = ICONS[part.key];
  const ref = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | null>(null);
  const [hint, setHint] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const touchRef = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHint(null);
  };
  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 140;
    setHint({ left: Math.min(Math.max(rect.left + rect.width / 2, 132), window.innerWidth - 132), top: below ? rect.bottom + 8 : rect.top - 8, below });
  };
  const arm = () => {
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      show();
    }, HINT_DELAY_MS);
  };

  useEffect(() => {
    if (!hint) return;
    // The hint is placed once; anything that moves the page closes it.
    const close = () => cancel();
    // A pinned (tapped) explanation also closes on the next tap elsewhere.
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [hint]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  return (
    <span ref={ref} className="tlog-count" data-kind={part.key} role="img" aria-label={part.text}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') arm(); }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') cancel(); }}
      onPointerDown={(event) => { touchRef.current = event.pointerType !== 'mouse'; if (event.pointerType === 'mouse') cancel(); }}
      onClick={(event) => {
        // Touch: the tap explains the count instead of folding the work line.
        if (!touchRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (hint) cancel(); else show();
      }}>
      {/* Ticks alone do not say what ran: a terminal marks them as commands. */}
      {part.key === 'commands' ? <SquareTerminal className="tlog-count-icon is-kind" aria-hidden /> : null}
      <Icon className="tlog-count-icon" aria-hidden />
      <span aria-hidden="true">{part.count}</span>
      {hint ? createPortal(
        <span className="tlog-hint" data-below={hint.below || undefined} role="tooltip" style={{ left: hint.left, top: hint.top }}>
          <span className="tlog-hint-title"><Icon className="tlog-count-icon" aria-hidden />{part.text}</span>
          <span className="tlog-hint-body">{translate(`chat.hint.${part.key}`)}</span>
          <span className="tlog-hint-example">{translate(`chat.hint.${part.key}Example`)}</span>
        </span>,
        // Inside the shell so the theme's colours apply; fixed, so nothing moves.
        ref.current?.closest('.thread-ui-shell') ?? document.body,
      ) : null}
    </span>
  );
}
