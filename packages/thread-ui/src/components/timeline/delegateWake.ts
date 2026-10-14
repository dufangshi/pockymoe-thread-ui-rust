import type { ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';

const WAKE_HEADER = '[Pockymoe wake: the delegates you registered a wake for have settled]\n';
const WAKE_FOOTER = '\n\nVerify results before acting on them. Full transcripts:';

// The trusted peerWork metadata identifies the sources. The original wake
// retains their reports even on older devices that projected only "idle".
export function delegateWakeMessages(turn: Pick<ThreadTurnDto, 'items'>, context: ThreadPeerWorkDto) {
  const text = turn.items.find(item => item.kind === 'userMessage' && item.peerWork)?.text ?? '';
  const reports = new Map<string, { state: string; text: string | null }>();
  if (text.startsWith(WAKE_HEADER)) {
    const footer = text.lastIndexOf(WAKE_FOOTER);
    const body = text.slice(WAKE_HEADER.length, footer < 0 ? undefined : footer);
    const entries = [...body.matchAll(/^- .+ \(([0-9a-f-]{36})\): ([^\n]*)$/gmi)];
    for (const [index, entry] of entries.entries()) {
      const block = body.slice(entry.index! + entry[0].length, entries[index + 1]?.index);
      const marker = '\n  closing message: ';
      const start = block.indexOf(marker);
      reports.set(entry[1]!, {
        state: entry[2]!.split(',')[0]!.trim(),
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
