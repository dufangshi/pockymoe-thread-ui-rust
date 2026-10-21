import type { ThreadPendingWakeDto } from "@pockymoe/shared";
import { BellRing, ChevronRight } from "lucide-react";
import { useState } from "react";
import { translate, useI18n } from '../../i18n';
import { navigationStatusLabel, StatusMark } from "../StatusMark";

function markStatus(status: string | null) {
  switch (status) {
    case "running": case "recovering": return "running";
    case "idle": case "failed": case "interrupted": return status;
    default: return "unknown";
  }
}

/** An agent thread's state as far as the wake is concerned: idle means it ended. */
function memberLabel(mark: string) {
  return mark === "idle" ? translate("chat.peerExecutionEnded") : navigationStatusLabel(mark);
}

/** Wakes this thread registered (`thread wait --wake`): the agent threads
    whose report will reach it. Tapping one explains when and how. */
export function ComposerPendingWakes({ wakes }: { wakes: ThreadPendingWakeDto[] }) {
  useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section
      aria-label={translate("chat.pendingWakes")}
      className="thread-composer-pending-queue thread-composer-pending-wakes mx-auto mb-2 w-full max-w-4xl overflow-hidden rounded-xl border"
    >
      {wakes.map((wake) => {
        const open = openId === wake.id;
        const members = wake.members.map((member) => ({
          ...member,
          label: member.name ?? member.threadId.slice(0, 8),
          mark: markStatus(member.status),
        })).map((member) => ({ ...member, state: memberLabel(member.mark) }));
        return (
          <div key={wake.id} className="thread-composer-pending-wake" data-open={open || undefined}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : wake.id)}
              className="thread-composer-pending-wake-head flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <BellRing className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span className="thread-composer-pending-source flex-none">{translate("chat.waitingForWake")}</span>
              <span className="thread-composer-pending-wake-members flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                {members.map((member) => (
                  <span key={member.threadId} className="inline-flex min-w-0 items-center gap-1.5">
                    <StatusMark status={member.mark} label={member.state} />
                    <span className="truncate">{member.label}</span>
                  </span>
                ))}
              </span>
              <ChevronRight className="thread-composer-pending-wake-chev h-3.5 w-3.5 flex-none" aria-hidden="true" />
            </button>
            {open ? (
              <div className="thread-composer-pending-wake-body px-3 pb-2.5 text-xs">
                <p>{translate("chat.pendingWakeHint")}</p>
                <ul>
                  {members.map((member) => (
                    <li key={member.threadId} className="flex items-center gap-1.5">
                      <StatusMark status={member.mark} label={member.state} />
                      <span className="font-medium">{member.label}</span>
                      <span>{member.state}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
