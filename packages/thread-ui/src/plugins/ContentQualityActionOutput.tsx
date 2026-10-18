import type { ReactNode } from 'react';
import { formatNumber, useI18n, type TranslationKey } from '../i18n';
import type { PluginActionOutputContext } from './plugin-types';

type Report = Record<string, unknown>;
function record(value: unknown): Report | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Report)
    : null;
}
function text(value: unknown, limit = 2000) {
  return typeof value === 'string'
    ? value.length > limit
      ? `${value.slice(0, limit)}…`
      : value
    : '';
}
const statusKeys: Record<string, TranslationKey> = {
  reviewed: 'quality.report.reviewed',
  completed: 'automation.completed',
  failed: 'automation.failed',
  skipped: 'automation.skipped',
  connected: 'quality.report.connected',
};
const reasonKeys: Record<string, TranslationKey> = {
  autoRepliesDisabled: 'quality.report.repliesDisabled',
  noReply: 'quality.report.noReply',
  belowMinReplyChars: 'quality.report.shortReply',
  alreadyPolished: 'quality.report.alreadyPolished',
  turnNotCompleted: 'quality.report.turnNotCompleted',
  unsupportedMarkup: 'quality.report.unsupportedMarkup',
};

/** The reason in words; never a bare code when a translation exists. */
function reasonText(report: Report, t: ReturnType<typeof useI18n>['t']) {
  const reason = text(report.reason, 500);
  if (reason === 'replyExceedsContextBudget') {
    const max = report.maxChars;
    return typeof max === 'number' && Number.isSafeInteger(max) && max > 0
      ? t('quality.report.exceedsContextBudget', { maxChars: formatNumber(max) })
      : t('quality.report.exceedsContextBudgetPlain');
  }
  return Object.hasOwn(reasonKeys, reason) ? t(reasonKeys[reason]!) : reason;
}

type Tone = 'success' | 'danger' | 'accent' | 'neutral';
const statusTones: Record<string, Tone> = {
  reviewed: 'success',
  completed: 'success',
  connected: 'success',
  failed: 'danger',
};

function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`plugin-report-tag is-${tone}`}>{children}</span>;
}

/** Status tag, reason and error of one report object; `completed` is implied by the report itself. */
function ReportStatus({ report, hideCompleted = false }: { report: Report; hideCompleted?: boolean }) {
  const { t } = useI18n();
  const status = text(report.status, 200);
  const reason = reasonText(report, t);
  const statusKey = Object.hasOwn(statusKeys, status)
    ? statusKeys[status]
    : undefined;
  const showStatus = Boolean(status) && !(hideCompleted && status === 'completed');
  return (
    <>
      {(showStatus || reason) && (
        <p className="plugin-report-line">
          {showStatus && (
            <Tag tone={Object.hasOwn(statusTones, status) ? statusTones[status] : 'neutral'}>
              {statusKey ? t(statusKey) : status}
            </Tag>
          )}
          {reason && <span>{reason}</span>}
        </p>
      )}
      {typeof report.error === 'string' && (
        <p role="status" className="plugin-report-error">
          {text(report.error)}
        </p>
      )}
    </>
  );
}

function Model({ report }: { report: Report }) {
  const { t } = useI18n();
  if (typeof report.model !== 'string' || !report.model) return null;
  return (
    <span className="plugin-report-meta">
      {t('quality.model')}: {text(report.model, 200)}
    </span>
  );
}

function diffTone(line: string) {
  if (line.startsWith('@@')) return 'is-hunk';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'is-add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'is-del';
  return undefined;
}

function ReportText({
  label,
  value,
  truncated,
  diff = false,
}: {
  label: string;
  value: unknown;
  truncated?: boolean;
  diff?: boolean;
}) {
  const { t } = useI18n();
  if (typeof value !== 'string' || !value) return null;
  const shown = text(value, 12000);
  return (
    <details className="plugin-report-disclosure">
      <summary>{label}</summary>
      <pre className={`plugin-report-pre${diff ? ' quality-diff' : ''}`}>
        {diff
          ? shown.split('\n').map((line, index) => (
              <span key={index} className={diffTone(line)}>
                {line}
                {'\n'}
              </span>
            ))
          : shown}
      </pre>
      {(truncated || value.length > 12000) && (
        <p className="plugin-report-note">{t('automation.outputTruncated')}</p>
      )}
    </details>
  );
}

function DocumentReport({ report }: { report: Report }) {
  const { t } = useI18n();
  const findings = Array.isArray(report.findings)
    ? report.findings.filter(
        (finding): finding is string => typeof finding === 'string',
      )
    : [];
  const status = text(report.status, 200);
  const statusKey = Object.hasOwn(statusKeys, status)
    ? statusKeys[status]
    : undefined;
  const reason = reasonText(report, t);
  return (
    <article className="quality-doc" data-status={status || undefined}>
      <header className="quality-doc-header">
        <h4 className="quality-doc-path">{text(report.path, 4096)}</h4>
        <span className="quality-doc-tags">
          {status && (
            <Tag tone={Object.hasOwn(statusTones, status) ? statusTones[status] : 'neutral'}>
              {statusKey ? t(statusKey) : status}
            </Tag>
          )}
          {typeof report.written === 'boolean' && (
            <Tag tone={report.written ? 'accent' : 'neutral'}>
              {t(
                report.written
                  ? 'quality.report.fileWritten'
                  : 'quality.report.fileUnchanged',
              )}
            </Tag>
          )}
          {findings.length > 0 && (
            <Tag tone="accent">
              {t(findings.length === 1 ? 'quality.report.findingOne' : 'quality.report.findingCount', { value1: findings.length })}
            </Tag>
          )}
        </span>
      </header>
      {reason && <p className="plugin-report-meta">{reason}</p>}
      {typeof report.error === 'string' && (
        <p role="status" className="plugin-report-error">
          {text(report.error)}
        </p>
      )}
      {!!findings.length && (
        <ul className="quality-doc-findings" aria-label={t('quality.report.findings')}>
          {findings.slice(0, 100).map((finding, index) => (
            <li key={index}>{text(finding)}</li>
          ))}
        </ul>
      )}
      {findings.length > 100 && <p className="plugin-report-note">{t('automation.outputTruncated')}</p>}
      {Array.isArray(report.findings) && !findings.length && (
        <p className="plugin-report-meta">{t('quality.report.noFindings')}</p>
      )}
      <div className="quality-doc-actions">
        <ReportText
          label={t('quality.report.diff')}
          value={report.diff}
          truncated={report.diffTruncated === true}
          diff
        />
        <ReportText
          label={t('quality.report.proposal')}
          value={report.proposedRewrite}
        />
        <Model report={report} />
      </div>
    </article>
  );
}

export function canRenderContentQualityActionOutput({
  action,
  output,
}: PluginActionOutputContext) {
  const report = record(output);
  if (!report) return false;
  if (action === 'afterTurn') return Array.isArray(report.documents);
  if (action === 'reviewDocument') return typeof report.path === 'string';
  return (
    (action === 'rewriteReply' || action === 'testConnection') &&
    typeof report.status === 'string'
  );
}

export function ContentQualityActionOutput({
  action,
  output,
}: PluginActionOutputContext) {
  const { t } = useI18n();
  const report = record(output);
  if (!report) return null;
  if (action === 'afterTurn' && Array.isArray(report.documents)) {
    const documents = report.documents
      .map(record)
      .filter((value): value is Report => Boolean(value));
    const reply = record(report.reply);
    return (
      <div className="quality-report">
        <ReportStatus report={report} hideCompleted />
        {reply && (
          <div className="quality-report-reply">
            <span className="quality-report-label">{t('quality.report.reply')}</span>
            <div>
              <ReportStatus report={reply} />
              <Model report={reply} />
            </div>
          </div>
        )}
        {typeof report.documentScanError === 'string' && (
          <p role="status" className="plugin-report-error">
            {t('quality.report.scanError')}: {text(report.documentScanError)}
          </p>
        )}
        {!documents.length && <p className="plugin-report-meta">{t('quality.report.noDocuments')}</p>}
        {!!documents.length && (
          <div className="quality-docs">
            {documents.slice(0, 5).map((document, index) => (
              <DocumentReport key={index} report={document} />
            ))}
          </div>
        )}
        {(report.documentsTruncated === true || documents.length > 5) && (
          <p className="plugin-report-note">{t('quality.report.moreDocuments')}</p>
        )}
      </div>
    );
  }
  if (action === 'reviewDocument' && typeof report.path === 'string')
    return <DocumentReport report={report} />;
  if (
    (action === 'rewriteReply' || action === 'testConnection') &&
    typeof report.status === 'string'
  )
    return (
      <div className="quality-report">
        <ReportStatus report={report} />
        <Model report={report} />
      </div>
    );
  return null;
}
