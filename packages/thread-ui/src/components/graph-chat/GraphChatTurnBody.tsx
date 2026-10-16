import { translate, useI18n } from '../../i18n';
import { type ReactNode } from 'react';

export interface GraphChatLivePlan {
  turnId: string;
  explanation: string | null;
  plan: Array<{ step: string; status: string }>;
}

function normalizeGraphChatPlanStepStatus(status: string) {
  const normalized = status.trim().toLowerCase();

  if (
    normalized === 'completed' ||
    normalized === 'done' ||
    normalized === 'complete'
  ) {
    return 'completed' as const;
  }

  if (
    normalized === 'in_progress' ||
    normalized === 'inprogress' ||
    normalized === 'in-progress' ||
    normalized === 'running' ||
    normalized === 'active'
  ) {
    return 'in_progress' as const;
  }

  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'cancelled'
  ) {
    return 'failed' as const;
  }

  if (normalized === 'pending' || normalized === 'todo') {
    return 'pending' as const;
  }

  return 'unknown' as const;
}

/** A compact checklist: done steps fade, the current one is bold. Themes draw the
    marks through `data-status` (✓ ▸ ○ ✕ by default). */
export function GraphChatLivePlanCard({ livePlan }: { livePlan: GraphChatLivePlan }) {
  useI18n();
  const steps = livePlan.plan.map((step) => ({ ...step, normalized: normalizeGraphChatPlanStepStatus(step.status) }));
  const done = steps.filter((step) => step.normalized === 'completed').length;
  return (
    <section className="thread-graph-plan-card tlog-plan" aria-label={translate('chat.logPlan')}>
      <div className="tlog-plan-head">
        <span className="tlog-plan-title">{translate('chat.logPlan')}</span>
        <span className="tlog-plan-count">{done}/{steps.length}</span>
      </div>
      {livePlan.explanation ? <p className="tlog-plan-note">{livePlan.explanation}</p> : null}
      <ol className="tlog-plan-list">
        {steps.map((step, index) => (
          <li key={`${livePlan.turnId}-${index}`} className="thread-graph-plan-step tlog-plan-step" data-status={step.normalized}>
            <span className="tlog-plan-mark" aria-hidden="true" />
            <span className="thread-graph-plan-step-text">{step.step}</span>
            <span className="sr-only"><GraphChatPlanStepStatusLabel status={step.status} /></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GraphChatPlanStepStatusLabel({ status }: { status: string }) {
  const normalized = normalizeGraphChatPlanStepStatus(status);
  return <>{normalized === 'completed'
    ? translate("chat.planStepStatusCompleted")
    : normalized === 'in_progress'
      ? translate("chat.planStepStatusInProgress")
      : normalized === 'pending'
        ? translate("chat.planStepStatusPending")
        : normalized === 'failed'
          ? translate("chat.planStepStatusFailed")
          : translate("chat.planStepStatus", { value1: status })}</>;
}

export function GraphChatTurnBody({
  footer,
  history,
  liveHookPrompt,
  liveOutput,
  livePlan,
}: {
  footer?: ReactNode;
  history: ReactNode;
  liveHookPrompt?: ReactNode;
  liveOutput?: ReactNode;
  livePlan?: GraphChatLivePlan | null;
}) {
  const { locale: i18nLocale } = useI18n();
  return (
    <>
      {history}
      {livePlan ? <GraphChatLivePlanCard livePlan={livePlan} /> : null}
      {liveHookPrompt ?? liveOutput ?? null}
      {footer}
    </>
  );
}
