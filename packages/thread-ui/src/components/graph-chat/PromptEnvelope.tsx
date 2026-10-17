import { createContext, useContext, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { translate, useI18n } from '../../i18n';
import type { DescribeThread } from '../../adapters';
import { GraphChatLinkifiedPlainText } from './GraphChatMessageBody';

/* Prompts the Supervisor writes on an agent's behalf (runtime interaction/mod.rs,
   inbox_reminder.rs) start with a bracketed header. They are not the person
   typing, so they read as a labelled envelope or a one-line notice. */

export type PromptEnvelope =
  | { type: 'peer'; kind: string; from: string; fromThreadId: string | null; subject: string | null; urgent: string | null; body: string }
  | { type: 'notice'; notice: 'inbox' | 'turn' | 'resume'; preview: string; body: string };

// runtime service/update.rs RESUME_PROMPT
const RESUME_PREFIX = 'The Supervisor was restarted for device maintenance, interrupting this task.';

const UUID = /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// A sender on this device is "thread <id>"; another device's reads "device/thread (device …)".
const LOCAL_SENDER = /^thread ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Opens a thread of this device from the transcript: an address, in-app navigation and its title. */
export const ThreadLinkContext = createContext<{ href?: (threadId: string) => string; open?: (threadId: string) => void; describe?: DescribeThread }>({});

function shortIds(text: string) {
  return text.replace(UUID, '$1');
}

export function parsePromptEnvelope(text: string): PromptEnvelope | null {
  if (text.startsWith(RESUME_PREFIX)) return { type: 'notice', notice: 'resume', preview: '', body: text };
  const newline = text.indexOf('\n');
  const header = (newline < 0 ? text : text.slice(0, newline)).trim();
  const rest = newline < 0 ? '' : text.slice(newline + 1);
  if (!header.startsWith('[Pockymoe ') || !header.endsWith(']')) return null;
  const inner = header.slice('[Pockymoe '.length, -1);

  if (inner.startsWith('inbox reminder')) {
    // "N messages are waiting…" then "- kind: subject" lines.
    const lines = rest.split('\n').map((line) => line.trim()).filter(Boolean);
    const first = lines.find((line) => line.startsWith('- '))?.slice(2) ?? lines[0] ?? '';
    return { type: 'notice', notice: 'inbox', preview: shortIds(first), body: rest.trim() };
  }
  if (inner === 'turn notification') {
    const first = rest.split('\n')[0] ?? '';
    return { type: 'notice', notice: 'turn', preview: shortIds(first.replace(/\. This describes.*$/, '')), body: rest.trim() };
  }

  const peer = /^(\w+) from (.+)$/.exec(inner);
  if (!peer) return null;
  const separator = peer[2]!.indexOf(' | ');
  const from = separator < 0 ? peer[2]! : peer[2]!.slice(0, separator);
  const subject = separator < 0 ? null : peer[2]!.slice(separator + 3);
  let body = rest;
  let urgent: string | null = null;
  for (;;) {
    const match = /^(In reply to message [^\n]*|Immediate handling needed: ([^\n]*))\n?/.exec(body);
    if (!match) break;
    if (match[2] !== undefined) urgent = match[2];
    body = body.slice(match[0].length);
  }
  return {
    type: 'peer',
    kind: peer[1]!,
    from: shortIds(from.replace(/^thread /, '')),
    fromThreadId: LOCAL_SENDER.exec(from.trim())?.[1] ?? null,
    subject: subject ? shortIds(subject) : null,
    urgent,
    body,
  };
}

function ThreadLink({ threadId, label }: { threadId: string; label: string }) {
  const links = useContext(ThreadLinkContext);
  const href = links.href?.(threadId);
  if (!href && !links.open) return <>{label}</>;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    // Modified clicks keep the browser's own new-tab and new-window handling.
    if (!links.open || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    links.open(threadId);
  };
  return (
    <a className="prompt-envelope-link" href={href ?? '#'} onClick={open} title={translate('chat.envelopeOpenSender', { id: threadId })}>
      {label}
    </a>
  );
}

const KIND_LABEL: Record<string, 'chat.envelopeTask' | 'chat.envelopeQuestion' | 'chat.envelopeResult' | 'chat.envelopeStatus'> = {
  task: 'chat.envelopeTask',
  question: 'chat.envelopeQuestion',
  result: 'chat.envelopeResult',
  status: 'chat.envelopeStatus',
};

/** Header line of a prompt another agent sent; the body follows as the message. */
export function PromptEnvelopeHeader({ envelope }: { envelope: PromptEnvelope & { type: 'peer' } }) {
  useI18n();
  const label = KIND_LABEL[envelope.kind] ? translate(KIND_LABEL[envelope.kind]!) : envelope.kind;
  // A sender thread the page knows reads by its title; others keep the short ID.
  const { describe } = useContext(ThreadLinkContext);
  const senderTitle = envelope.fromThreadId ? describe?.(envelope.fromThreadId)?.title?.trim() : undefined;
  return (
    <>
      <div className="prompt-envelope-head" data-kind={envelope.kind}>
        <span className="prompt-envelope-glyph" aria-hidden="true">↘</span>
        <span className="prompt-envelope-kind">{label}</span>
        <span className="prompt-envelope-from" data-titled={senderTitle ? '' : undefined}>{envelope.fromThreadId
          ? <>{translate('chat.envelopeFrom', { from: '' }).trim()} <ThreadLink threadId={envelope.fromThreadId} label={senderTitle || envelope.from} /></>
          : translate('chat.envelopeFrom', { from: envelope.from })}</span>
        {/* A subject derived from the first line would only repeat it. */}
        {envelope.subject && !envelope.body.trimStart().startsWith(envelope.subject.replace(/…$/, '').trimEnd())
          ? <span className="prompt-envelope-subject">{envelope.subject}</span> : null}
      </div>
      {envelope.urgent ? <p className="prompt-envelope-urgent"><b>{translate('chat.envelopeUrgent')}</b> {envelope.urgent}</p> : null}
    </>
  );
}

const NOTICE = {
  inbox: { glyph: '✉', label: 'chat.envelopeInbox' },
  turn: { glyph: '⚑', label: 'chat.envelopeTurn' },
  resume: { glyph: '↻', label: 'chat.envelopeResume' },
} as const;

/** Inbox reminders, turn notifications and maintenance resumes: one line, opened in place. */
export function PromptNotice({ envelope, actions }: { envelope: PromptEnvelope & { type: 'notice' }; actions?: ReactNode }) {
  useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="prompt-notice" data-notice={envelope.notice} data-open={open || undefined}>
      <button type="button" className="prompt-notice-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="prompt-envelope-glyph" aria-hidden="true">{NOTICE[envelope.notice].glyph}</span>
        <span className="prompt-envelope-kind">{translate(NOTICE[envelope.notice].label)}</span>
        <span className="prompt-notice-preview">{envelope.preview}</span>
        <ChevronRight className="prompt-notice-chev" aria-hidden="true" />
      </button>
      {open ? <div className="prompt-notice-body"><GraphChatLinkifiedPlainText text={envelope.body} />{actions}</div> : null}
    </div>
  );
}
