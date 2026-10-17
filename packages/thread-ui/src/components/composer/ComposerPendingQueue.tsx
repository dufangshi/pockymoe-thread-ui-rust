import { translate, useI18n } from '../../i18n';
import { CornerUpRight, Loader2, Pencil, X } from "lucide-react";
import { useState } from "react";

interface ComposerPendingPrompt {
  id: string;
  prompt: string;
  optimistic?: boolean;
}

/** Prompts waiting for the running turn. Tapping one shows all of it and Edit,
    which takes it out of the queue back into the prompt. */
export function ComposerPendingQueue({
  prompts,
  onSteer,
  onCancel,
  onEdit,
}: {
  prompts: ComposerPendingPrompt[];
  onSteer?: (pendingPromptId: string) => Promise<void> | void;
  onCancel?: (pendingPromptId: string) => Promise<void> | void;
  onEdit?: (pendingPromptId: string) => Promise<void> | void;
}) {
  useI18n();
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  async function runAction(
    id: string,
    action: ((pendingPromptId: string) => Promise<void> | void) | undefined,
  ) {
    if (!action || busyIds.has(id)) {
      return;
    }
    setBusyIds((current) => new Set(current).add(id));
    try {
      await action(id);
    } catch {
      // The host surface owns error presentation for queue actions.
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <section
      aria-label={translate("chat.queuedPrompts")}
      className="thread-composer-pending-queue mx-auto mb-2 w-full max-w-4xl overflow-hidden rounded-xl border"
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-[var(--theme-fg-muted)]">
        <span>{translate("chat.queued")}</span>
        <span>{prompts.length}</span>
      </div>
      <div className="max-h-36 overflow-y-auto">
        {prompts.map((prompt) => {
          const busy = busyIds.has(prompt.id);
          const open = openId === prompt.id;
          return (
            <div
              key={prompt.id}
              data-open={open || undefined}
              className={`thread-composer-pending-row flex min-h-10 gap-2 border-t px-3 py-2 ${open ? 'items-start' : 'items-center'}`}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : prompt.id)}
                className={`thread-composer-pending-text min-w-0 flex-1 text-left text-sm text-[var(--theme-fg)] ${open ? 'max-h-28 overflow-y-auto whitespace-pre-wrap break-words py-1.5' : 'truncate'}`}
              >
                {prompt.prompt}
              </button>
              {prompt.optimistic ? (
                <span className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs text-[var(--theme-fg-muted)]">
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {translate("chat.queueing")}</span>
              ) : (
                <>
                  {open && onEdit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(prompt.id, onEdit)}
                      className="thread-composer-queue-edit inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {translate("chat.edit")}
                    </button>
                  ) : null}
                  {onSteer ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(prompt.id, onSteer)}
                      className="thread-composer-steer-button inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CornerUpRight
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      {translate("chat.steerNow")}
                    </button>
                  ) : null}
                  {onCancel ? (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={translate("chat.removeQueuedPrompt")}
                      title={translate("chat.removeFromQueue")}
                      onClick={() => void runAction(prompt.id, onCancel)}
                      className="thread-composer-queue-remove inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-60"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
