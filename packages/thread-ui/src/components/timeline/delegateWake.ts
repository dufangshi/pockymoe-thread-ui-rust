import type { ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';
import { translate } from '../../i18n';

// runtime service/peer_work.rs: the header line names why the wake fired
// (settled or blocked); older devices only wrote the settled one.
const WAKE_HEADER = /^\[Pockymoe wake: [^\n]*\]\n/;
const WAKE_FOOTER = '\n\nVerify results before acting on them. Full transcripts:';

/** The delegate lines of a wake prompt: name, thread ID and state. */
export function wakeEntries(body: string) {
  return [...body.matchAll(/^- (.+) \(([0-9a-f-]{36})\): ([^\n]*)$/gmi)];
}

/** A delegate's state as the wake reported it, in the reader's language. */
export function wakeState(state?: string) {
  switch (state) {
    case 'idle': case 'completed': case 'closed': return translate('chat.peerExecutionEnded');
    case 'blocked': return translate('chat.peerWaitingForAnswer');
    case 'failed': return translate('chat.peerExecutionFailed');
    case 'interrupted': return translate('chat.peerExecutionInterrupted');
    case 'running': return translate('chat.peerStillRunning');
    default: return translate('chat.peerUpdates');
  }
}

// The trusted peerWork metadata identifies the sources. The original wake
// retains their reports even on older devices that projected only "idle".
export function delegateWakeMessages(turn: Pick<ThreadTurnDto, 'items'>, context: ThreadPeerWorkDto) {
  const text = turn.items.find(item => item.kind === 'userMessage' && item.peerWork)?.text ?? '';
  const reports = new Map<string, { state: string; text: string | null }>();
  const header = WAKE_HEADER.exec(text);
  if (header) {
    const footer = text.lastIndexOf(WAKE_FOOTER);
    const body = text.slice(header[0].length, footer < 0 ? undefined : footer);
    const entries = wakeEntries(body);
    for (const [index, entry] of entries.entries()) {
      const block = body.slice(entry.index! + entry[0].length, entries[index + 1]?.index);
      const marker = '\n  closing message: ';
      const start = block.indexOf(marker);
      reports.set(entry[2]!, {
        state: entry[3]!.split(',')[0]!.trim(),
        text: start < 0 ? null : block.slice(start + marker.length).trim() || null,
      });
    }
  }
  return context.messages.map(message => {
    const report = message.kind === 'result' && message.fromThreadId ? reports.get(message.fromThreadId) : undefined;
    return {
      ...message,
      state: message.kind === 'result' ? report?.state ?? message.subject?.split(',')[0]?.trim() : undefined,
      text: message.text?.trim() || report?.text || null,
    };
  });
}
