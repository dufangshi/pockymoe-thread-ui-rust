import type { ThreadPendingWakeDto } from "@pockymoe/shared";
import { BellRing } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

/** Wakes this thread registered (`thread wait --wake`): a small bell above the
    composer counting the agent threads whose report will reach it. A tap lists
    them with their state and explains when the wake comes. */
export function ComposerPendingWakes({ wakes }: { wakes: ThreadPendingWakeDto[] }) {
  useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const groups = wakes.map((wake) => ({
    id: wake.id,
    members: wake.members.map((member) => {
      const mark = markStatus(member.status);
      return { threadId: member.threadId, label: member.name ?? member.threadId.slice(0, 8), mark, state: memberLabel(mark) };
    }),
  }));
  const count = groups.reduce((sum, group) => sum + group.members.length, 0);
  const name = `${translate("chat.waitingForWake")}: ${translate("chat.pendingWakeCount", { count })}`;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key, true); };
  }, [open]);

  return (
    <div ref={root} className="thread-composer-wakes">
      <button
        ref={trigger}
        type="button"
        className="thread-composer-wakes-bell"
        aria-label={name}
        title={name}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <BellRing aria-hidden="true" />
        <span className="thread-composer-wakes-count" aria-hidden="true">{count}</span>
      </button>
      {open ? (
        <section id={id} role="dialog" aria-label={translate("chat.pendingWakes")} className="thread-composer-wakes-panel">
          <p className="thread-composer-wakes-title">{translate("chat.waitingForWake")}</p>
          {groups.map((group) => (
            <ul key={group.id} className="thread-composer-wakes-group">
              {group.members.map((member) => (
                <li key={member.threadId}>
                  <StatusMark status={member.mark} label={member.state} />
                  <span className="thread-composer-wakes-name">{member.label}</span>
                  <span className="thread-composer-wakes-state">{member.state}</span>
                </li>
              ))}
            </ul>
          ))}
          <p className="thread-composer-wakes-hint">{translate("chat.pendingWakeHint")}</p>
        </section>
      ) : null}
    </div>
  );
}
