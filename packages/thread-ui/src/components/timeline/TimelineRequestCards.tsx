import { translate, useI18n } from '../../i18n';
import { useState } from 'react';

import type {
  RespondThreadActionRequestInput,
  ThreadActionRequestDto,
  ThreadActivityNoteDto,
  ThreadAnsweredRequestNoteDto,
} from '@pockymoe/shared';
import {
  formatLongTimestamp,
  formatShortTimestamp,
} from '../threadPresentation';
import type { RequestEntryAnchor } from './timelineAnchors';

export function PendingRequestCard({
  request,
  busy = false,
  onRespond,
}: {
  request: ThreadActionRequestDto;
  busy?: boolean;
  onRespond?: ((
    requestId: string,
    input: RespondThreadActionRequestInput,
  ) => Promise<void> | void) | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [selectedPlanDecision, setSelectedPlanDecision] = useState<
    string | null
  >(null);
  const primaryQuestion = request.questions[0] ?? null;
  const OTHER_SENTINEL = '__other__';
  const ALLOW_SENTINEL = '__allow__';
  const DENY_SENTINEL = '__deny__';
  const isPermissionRequest = request.kind === 'permissionRequest';
  const isDecision = request.kind === 'planDecision' || isPermissionRequest;
  // A decision without choices (the fake fixture, an ACP request that lists no
  // options) still needs a way out: a bare allow/deny, as the desktop shell
  // sends, lets the Supervisor pick the source's own first allow/reject option.
  const bareDecision =
    isDecision &&
    !request.questions.some((question) => (question.options?.length ?? 0) > 0);
  // A viewer who cannot answer sees the actions, greyed out.
  const disabled = busy || !onRespond;
  const cardTitle =
    request.kind === 'planDecision'
      ? translate("chat.plan")
      : isPermissionRequest
        ? translate("chat.permissionRequired")
      : request.kind === 'requestUserInput'
        ? translate("chat.answerRequired")
        : request.title;

  function getOptionPresentation(label: string) {
    const recommended = /\s*\(recommended\)\s*$/i.test(label);
    return {
      rawLabel: label,
      displayLabel: label.replace(/\s*\(recommended\)\s*$/i, '').trim(),
      recommended,
    };
  }

  function respondWithSingleAnswer(answer: string) {
    if (!primaryQuestion) {
      return;
    }

    setSelectedPlanDecision(answer);
    void onRespond?.(request.id, {
      answers: {
        [primaryQuestion.id]: {
          answers: [answer],
        },
      },
    });
  }

  function respondWithAllow(allow: boolean) {
    setSelectedPlanDecision(allow ? ALLOW_SENTINEL : DENY_SENTINEL);
    void onRespond?.(request.id, { allow });
  }

  function currentAnswerForQuestion(
    question: ThreadActionRequestDto['questions'][number],
  ) {
    const selected = answers[question.id] ?? '';
    const customAnswer = (customAnswers[question.id] ?? '').trim();
    if (Array.isArray(selected)) {
      const selectedValues = selected
        .map((answer) =>
          answer === OTHER_SENTINEL
            ? customAnswer
            : answer.trim(),
        )
        .filter(Boolean);
      return selectedValues.length > 0
        ? selectedValues.join(', ')
        : customAnswer;
    }
    if (selected === OTHER_SENTINEL) {
      return customAnswer;
    }

    return selected.trim() || customAnswer;
  }

  function currentAnswersForQuestion(
    question: ThreadActionRequestDto['questions'][number],
  ) {
    const selected = answers[question.id] ?? '';
    const customAnswer = (customAnswers[question.id] ?? '').trim();
    if (Array.isArray(selected)) {
      const selectedValues = selected
        .map((answer) =>
          answer === OTHER_SENTINEL
            ? customAnswer
            : answer.trim(),
        )
        .filter(Boolean);
      return selectedValues.length > 0
        ? selectedValues
        : customAnswer
          ? [customAnswer]
          : [];
    }
    if (selected === OTHER_SENTINEL) {
      return customAnswer ? [customAnswer] : [];
    }
    const singleAnswer = selected.trim();
    return singleAnswer ? [singleAnswer] : customAnswer ? [customAnswer] : [];
  }

  function toggleMultiSelectAnswer(questionId: string, label: string) {
    setAnswers((current) => {
      const currentAnswers = current[questionId];
      const selectedAnswers = Array.isArray(currentAnswers)
        ? currentAnswers
        : [];
      const nextAnswers = selectedAnswers.includes(label)
        ? selectedAnswers.filter((entry) => entry !== label)
        : [...selectedAnswers, label];
      return {
        ...current,
        [questionId]: nextAnswers,
      };
    });
  }

  return (
    <div className="timeline-pending-card w-full rounded-[1rem] border px-3 py-3 sm:rounded-[1.2rem] sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="timeline-primary-text text-sm font-medium">{cardTitle}</p>
          {request.kind !== 'planDecision' && request.description && (
            <p className="timeline-soft-text mt-1 text-[13px] leading-5">
              {request.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {request.questions.map((question) => (
          <div
            key={question.id}
            className="timeline-question-section rounded-xl border p-2.5 sm:p-3"
          >
            <p className="timeline-meta-text text-xs uppercase tracking-[0.2em]">
              {question.header}
            </p>
            <p className="timeline-primary-text mt-1 text-[13px] leading-5 sm:text-sm">
              {question.question}
            </p>
            {isDecision &&
            question.options &&
            question.options.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option, index) => {
                  const presentation = getOptionPresentation(option.label);
                  const isImplement =
                    presentation.displayLabel.toLowerCase() === 'implement';
                  const isReject = /reject|cancel/i.test(
                    `${option.label} ${option.description}`,
                  );
                  return (
                    <button
                      key={option.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => respondWithSingleAnswer(option.label)}
                      className={`relative rounded-2xl border px-2.5 py-1.5 pr-6 text-[12px] leading-4 transition sm:text-[13px] ${
                        isReject
                          ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                          : index === 0
                          ? 'ui-action-info'
                          : 'border-stone-700 text-stone-200 hover:bg-stone-800'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title={option.description}
                    >
                      {presentation.recommended ? (
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/18 text-[10px] leading-none text-current"
                        >
                          ✦
                        </span>
                      ) : null}
                      {busy && selectedPlanDecision === option.label
                        ? isPermissionRequest
                          ? translate("chat.submitting")
                          : isImplement
                          ? translate("chat.starting")
                          : translate("chat.saving")
                        : presentation.displayLabel}
                    </button>
                  );
                })}
              </div>
            ) : question.options && question.options.length > 0 ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const presentation = getOptionPresentation(option.label);
                    const selectedAnswer = answers[question.id];
                    return (
                      <button
                        key={option.label}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          question.multiSelect
                            ? toggleMultiSelectAnswer(question.id, option.label)
                            : setAnswers((current) => ({
                                ...current,
                                [question.id]: option.label,
                              }))
                        }
                        className={`relative rounded-2xl border px-3 py-1.5 pr-6 text-[12px] leading-4 transition sm:text-[13px] ${
                          (question.multiSelect
                            ? Array.isArray(selectedAnswer) &&
                              selectedAnswer.includes(option.label)
                            : selectedAnswer === option.label)
                            ? 'ui-status-warning'
                            : 'border-stone-700 text-stone-300 hover:bg-stone-800'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        title={option.description}
                      >
                        {presentation.recommended ? (
                          <span
                            aria-hidden="true"
                            className="absolute right-1.5 top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none text-amber-100/90"
                          >
                            ✦
                          </span>
                        ) : null}
                        {presentation.displayLabel}
                      </button>
                    );
                  })}
                  {question.isOther &&
                    (() => {
                      const selectedAnswer = answers[question.id];
                      return (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            question.multiSelect
                              ? toggleMultiSelectAnswer(
                                  question.id,
                                  OTHER_SENTINEL,
                                )
                              : setAnswers((current) => ({
                                  ...current,
                                  [question.id]: OTHER_SENTINEL,
                                }))
                          }
                          className={`rounded-2xl border px-3 py-1.5 text-[12px] leading-4 transition sm:text-[13px] ${
                            (question.multiSelect
                              ? Array.isArray(selectedAnswer) &&
                                selectedAnswer.includes(OTHER_SENTINEL)
                              : selectedAnswer === OTHER_SENTINEL)
                              ? 'ui-status-info'
                              : 'border-stone-700 text-stone-300 hover:bg-stone-800'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {translate("chat.notFromAbove")}</button>
                      );
                    })()}
                </div>
                {question.isOther &&
                  (() => {
                    const selectedAnswer = answers[question.id];
                    const showOtherInput = question.multiSelect
                      ? Array.isArray(selectedAnswer) &&
                        selectedAnswer.includes(OTHER_SENTINEL)
                      : selectedAnswer === OTHER_SENTINEL;
                    return showOtherInput || question.isOther ? (
                      <input
                        aria-label={translate("chat.customAnswer", { value1: question.header })}
                        value={customAnswers[question.id] ?? ''}
                        onChange={(event) =>
                          setCustomAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder={translate("chat.enterACustomAnswer")}
                        className="mt-3 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-sky-300"
                      />
                    ) : null;
                  })()}
              </>
            ) : isDecision ? null : (
              <input
                aria-label={question.header}
                value={answers[question.id] ?? ''}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
                className="mt-3 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-amber-300"
              />
            )}
          </div>
        ))}
      </div>
      {bareDecision ? (
        <div className="timeline-request-actions mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => respondWithAllow(false)}
            className="min-h-11 rounded-full border border-stone-700 px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
          >
            {busy && selectedPlanDecision === DENY_SENTINEL
              ? translate("chat.submitting")
              : translate("chat.denyRequest")}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => respondWithAllow(true)}
            className="ui-action-info min-h-11 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
          >
            {busy && selectedPlanDecision === ALLOW_SENTINEL
              ? translate("chat.submitting")
              : translate("chat.approveRequest")}
          </button>
        </div>
      ) : !isDecision ? (
        <div className="timeline-request-actions mt-3 flex justify-end gap-2">
          {/* Every question can be declined: ACP and native Codex get an empty
              or cancelled answer, native Claude a refusal. */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => respondWithAllow(false)}
            className="min-h-11 rounded-full border border-stone-700 px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
          >
            {busy && selectedPlanDecision === DENY_SENTINEL
              ? translate("chat.submitting")
              : translate("chat.declineRequest")}
          </button>
          <button
            type="button"
            disabled={
              disabled ||
              request.questions.some(
                (question) => !currentAnswerForQuestion(question),
              )
            }
            onClick={() => {
              setSelectedPlanDecision(null);
              void onRespond?.(request.id, {
                answers: Object.fromEntries(
                  request.questions.map((question) => [
                    question.id,
                    {
                      answers: currentAnswersForQuestion(question),
                    },
                  ]),
                ),
              });
            }}
            className="ui-action-info min-h-11 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
          >
            {busy && selectedPlanDecision !== DENY_SENTINEL
              ? translate("chat.submitting")
              : translate("chat.submit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AnsweredRequestNote({
  note,
}: {
  note: ThreadAnsweredRequestNoteDto;
}) {
  const { locale: i18nLocale } = useI18n();
  return (
    <div className="timeline-note-card w-full rounded-2xl border px-3 py-2.5">
      <p className="timeline-meta-text text-[11px] uppercase tracking-[0.2em]">
        {note.title}
      </p>
      <div className="mt-1 space-y-1">
        {note.summaryLines.map((line, index) => (
          <p
            key={`${note.id}-${index}`}
            className="timeline-primary-text text-[13px] leading-5"
          >
            {translate("chat.youSelected")} {line}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ActivityNoteCard({
  note,
  onOpenThread,
  onOpenLinkedThread,
}: {
  note: ThreadActivityNoteDto;
  onOpenThread?: ((threadId: string) => void) | undefined;
  onOpenLinkedThread?: ((threadId: string) => void) | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const title =
    note.kind === 'forkCreated'
      ? translate("chat.fork")
      : note.kind === 'forkSource'
        ? translate("chat.forkSource")
        : note.kind === 'goal'
          ? translate("chat.goal")
          : translate("chat.system");
  const body =
    note.kind === 'forkCreated'
      ? `Thread forked from Turn ${note.turnIndex ?? '?'}`
      : note.kind === 'forkSource'
        ? `Forked from ${note.linkedThreadTitle ?? translate("chat.sourceThread")} at Turn ${note.turnIndex ?? '?'}`
        : note.text ?? '';

  return (
    <div className="timeline-activity-card w-full rounded-2xl border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="timeline-meta-text text-[11px] uppercase tracking-[0.2em]">
          {title}
        </p>
        <time
          dateTime={note.createdAt}
          title={formatLongTimestamp(note.createdAt)}
          className="timeline-meta-text text-[10px]"
        >
          {formatShortTimestamp(note.createdAt)}
        </time>
      </div>
      <p className="timeline-primary-text mt-1 text-[13px] leading-5">{body}</p>
      {note.linkedThreadId ? (
        <button
          type="button"
          onClick={() => {
            const linkedThreadId = note.linkedThreadId;
            if (!linkedThreadId) {
              return;
            }
            onOpenLinkedThread?.(linkedThreadId);
            onOpenThread?.(linkedThreadId);
          }}
          className="relative z-10 mt-2 inline-flex cursor-pointer rounded-full border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-300/10"
        >
          {note.kind === 'forkCreated' ? translate("chat.openFork") : translate("chat.backToSource")}
        </button>
      ) : null}
    </div>
  );
}

export function ActivityNoteSection({
  notes,
  onOpenThread,
  onOpenLinkedThread,
}: {
  notes: ThreadActivityNoteDto[];
  onOpenThread?: ((threadId: string) => void) | undefined;
  onOpenLinkedThread?: ((threadId: string) => void) | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="thread-graph-message-section space-y-3 px-3 py-4 sm:px-5">
      {notes.map((note) => (
        <ActivityNoteCard
          key={note.id}
          note={note}
          onOpenThread={onOpenThread}
          onOpenLinkedThread={onOpenLinkedThread}
        />
      ))}
    </div>
  );
}

export function RequestEntrySection({
  entries,
  respondingRequestId,
  onRespondToRequest,
}: {
  entries: RequestEntryAnchor[];
  respondingRequestId?: string | null | undefined;
  onRespondToRequest?:
    | ((
        requestId: string,
        input: RespondThreadActionRequestInput,
      ) => Promise<void> | void)
    | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="thread-graph-message-section space-y-3 px-3 py-4 sm:px-5">
      {entries.map((entry) =>
        entry.kind === 'note' ? (
          <AnsweredRequestNote key={entry.id} note={entry.note} />
        ) : (
          <PendingRequestCard
            key={entry.id}
            request={entry.request}
            busy={respondingRequestId === entry.request.id}
            onRespond={onRespondToRequest}
          />
        ),
      )}
    </div>
  );
}

export function RequestEntrySectionForTurn({
  notes,
  requests,
  respondingRequestId,
  onRespondToRequest,
}: {
  notes: ThreadAnsweredRequestNoteDto[];
  requests: ThreadActionRequestDto[];
  respondingRequestId?: string | null | undefined;
  onRespondToRequest?:
    | ((
        requestId: string,
        input: RespondThreadActionRequestInput,
      ) => Promise<void> | void)
    | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const entries: RequestEntryAnchor[] = [
    ...notes.map((note) => ({
      kind: 'note' as const,
      id: note.id,
      createdAt: note.createdAt ?? '',
      note,
    })),
    ...requests.map((request) => ({
      kind: 'request' as const,
      id: request.id,
      createdAt: request.createdAt,
      request,
    })),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    <RequestEntrySection
      entries={entries}
      respondingRequestId={respondingRequestId}
      onRespondToRequest={onRespondToRequest}
    />
  );
}

type ActivityRequestEntry =
  | RequestEntryAnchor
  | {
      kind: 'activity';
      id: string;
      createdAt: string;
      note: ThreadActivityNoteDto;
    };

export function ActivityRequestEntrySection({
  entries,
  respondingRequestId,
  onRespondToRequest,
  onOpenThread,
  onOpenLinkedThread,
}: {
  entries: ActivityRequestEntry[];
  respondingRequestId?: string | null | undefined;
  onRespondToRequest?:
    | ((
        requestId: string,
        input: RespondThreadActionRequestInput,
      ) => Promise<void> | void)
    | undefined;
  onOpenThread?: ((threadId: string) => void) | undefined;
  onOpenLinkedThread?: ((threadId: string) => void) | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="thread-graph-message-section space-y-3 px-3 py-4 sm:px-5">
      {[...entries]
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((entry) =>
          entry.kind === 'activity' ? (
            <ActivityNoteCard
              key={entry.id}
              note={entry.note}
              onOpenThread={onOpenThread}
              onOpenLinkedThread={onOpenLinkedThread}
            />
          ) : entry.kind === 'note' ? (
            <AnsweredRequestNote key={entry.id} note={entry.note} />
          ) : (
            <PendingRequestCard
              key={entry.id}
              request={entry.request}
              busy={respondingRequestId === entry.request.id}
              onRespond={onRespondToRequest}
            />
          ),
        )}
    </div>
  );
}
