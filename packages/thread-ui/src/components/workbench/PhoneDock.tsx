import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronsUpDown, Ellipsis, FolderOpen, MessageSquare, Terminal } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import type { WorkbenchThread } from '../MatterWorkbench';
import { threadGroupActivity } from '../GroupedThreadTabs';
import type { WorkbenchPane, WorkbenchPaneSwitch } from './paneSwitch';

export type PhonePane = 'chat' | 'shell' | 'files';

const SWIPE_DISTANCE = 48;

/** The phone's bottom navigation row: the current thread (tap for the thread
    sheet, swipe sideways for the neighbouring open thread), the chat / terminal /
    files views and a More sheet for everything the top bar used to hold. */
export function PhoneDock({
  title, thread, paneSwitch = null, siblings, currentKey, pane, terminalEnabled, onPane, onNavigate, onOpenThreads, onOpenMore, moreOpen, threadsOpen,
}: {
  title: string;
  thread: WorkbenchThread | undefined;
  /** A split's two conversations: pinned side by side, one tap switches. */
  paneSwitch?: WorkbenchPaneSwitch | null;
  siblings: WorkbenchThread[];
  currentKey: string;
  pane: PhonePane;
  terminalEnabled: boolean;
  onPane: (pane: PhonePane) => void;
  onNavigate: (href: string) => void;
  onOpenThreads: () => void;
  onOpenMore: () => void;
  moreOpen: boolean;
  threadsOpen: boolean;
}) {
  useI18n();
  const index = siblings.findIndex(item => item.key === currentKey);
  const swipe = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const swiped = useRef(false);
  const [nudge, setNudge] = useState(0);
  const activity = thread ? threadGroupActivity(thread) : null;
  const step = (direction: 1 | -1) => {
    const next = siblings[index + direction];
    if (next) onNavigate(next.href);
  };
  // Only a few position dots: where this thread sits among the open ones.
  const dots = siblings.length > 1 ? Array.from({ length: Math.min(siblings.length, 5) }, (_, i) => {
    const start = Math.max(0, Math.min(index - 2, siblings.length - 5));
    return start + i === index;
  }) : [];
  return (
    <nav className="matter-phone-dock" aria-label={translate('workbench.phoneDock')}>
      {paneSwitch ? <PinnedThreads value={paneSwitch} threadsOpen={threadsOpen} onOpenThreads={onOpenThreads} /> : <button
        type="button"
        className="matter-phone-thread"
        aria-haspopup="dialog"
        aria-expanded={threadsOpen}
        aria-label={translate('workbench.phoneDockThread', { title })}
        data-nudge={nudge || undefined}
        onPointerDown={event => {
          if (event.pointerType === 'mouse') return;
          swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
        }}
        onPointerMove={event => {
          const start = swipe.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(event.clientY - start.y)) start.moved = true;
          if (start.moved) setNudge(Math.max(-1, Math.min(1, Math.round(dx / SWIPE_DISTANCE))));
        }}
        onPointerUp={event => {
          const start = swipe.current;
          swipe.current = null;
          setNudge(0);
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          swiped.current = start.moved || Math.abs(dy) >= SWIPE_DISTANCE;
          if (start.moved && Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
          else if (dy <= -SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx) * 1.5) onOpenThreads();
        }}
        onPointerCancel={() => { swipe.current = null; setNudge(0); }}
        onClick={() => {
          // A swipe can still end in a click; only a tap opens the sheet.
          if (swiped.current) { swiped.current = false; return; }
          onOpenThreads();
        }}
      >
        <span className="matter-status-dot" data-status={activity?.status ?? 'idle'} role="img" aria-label={activity?.label ?? ''} />
        <span className="matter-phone-thread-title">{title}</span>
        <ChevronsUpDown aria-hidden="true" />
        {dots.length > 0 && <span className="matter-phone-thread-dots" aria-hidden="true">{dots.map((on, i) => <i key={i} data-on={on || undefined} />)}</span>}
      </button>}
      <div className="matter-phone-panes" role="group" aria-label={translate('workbench.phoneDockPanes')}>
        <button type="button" aria-label={translate('workbench.chat')} aria-pressed={pane === 'chat'} onClick={() => onPane('chat')}><MessageSquare /></button>
        <button type="button" aria-label={translate('workbench.toggleExplorer')} aria-pressed={pane === 'files'} onClick={() => onPane('files')}><FolderOpen /></button>
        {terminalEnabled && <button type="button" aria-label={translate('workbench.terminal')} aria-pressed={pane === 'shell'} onClick={() => onPane('shell')}><Terminal /></button>}
      </div>
      <button type="button" className="matter-phone-more" aria-label={translate('workbench.moreActions')} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onOpenMore}><Ellipsis /></button>
    </nav>
  );
}

/** A split pins two conversations to the dock. The one not shown comes forward
    with a tap; tapping the shown one opens the thread list, like the single
    thread button. The dock takes over both panes' switches. */
function PinnedThreads({ value, threadsOpen, onOpenThreads }: {
  value: WorkbenchPaneSwitch;
  threadsOpen: boolean;
  onOpenThreads: () => void;
}) {
  const { claim } = value;
  useEffect(() => {
    const releasePrimary = claim('primary');
    const releaseReference = claim('reference');
    return () => { releasePrimary(); releaseReference(); };
  }, [claim]);
  return (
    <div className="matter-phone-pins" role="group" aria-label={translate('workbench.pinnedThreads')}>
      {(['primary', 'reference'] as WorkbenchPane[]).map(side => {
        const shown = value.active === side;
        return (
          <button key={side} type="button" className="matter-phone-pin" data-side={side} aria-pressed={shown}
            {...(shown ? { 'aria-haspopup': 'dialog' as const, 'aria-expanded': threadsOpen } : {})}
            aria-label={shown
              ? translate('workbench.phoneDockThread', { title: value.titles[side] })
              : translate(side === 'primary' ? 'workbench.showLeftConversation' : 'workbench.showRightConversation', { value1: value.titles[side] })}
            title={value.titles[side]}
            onClick={() => (shown ? onOpenThreads() : value.select(side))}>
            <span className="matter-phone-pin-title">{value.titles[side]}</span>
            {shown ? <ChevronsUpDown aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A bottom sheet that stays mounted while closed, so host controls inside it
    (settings, automations, split picker) keep their dialogs open after it hides. */
export function PhoneSheet({ open, label, onClose, children, footer }: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useI18n();
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>('[data-sheet-autofocus], button, a')?.focus({ preventScroll: true });
  }, [open]);
  return (
    <>
      {open && <button type="button" className="matter-phone-sheet-scrim" aria-label={translate('workbench.closeSheet')} onClick={onClose} />}
      <section
        ref={sheet}
        className="matter-phone-sheet"
        role="dialog"
        aria-modal={open}
        aria-label={label}
        data-open={open || undefined}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
        // Actions and modal dialog triggers hide the sheet (their dialogs live in
        // portals); popover triggers keep it, since their popovers anchor inside.
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('a[href], button:not([aria-expanded]), [data-slot="dialog-trigger"]')) window.setTimeout(onClose, 0);
        }}
      >
        <div className="matter-phone-sheet-grabber" aria-hidden="true" />
        <div className="matter-phone-sheet-body">{children}</div>
        {footer && <div className="matter-phone-sheet-footer">{footer}</div>}
      </section>
    </>
  );
}
