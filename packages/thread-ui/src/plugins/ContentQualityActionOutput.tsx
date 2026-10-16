import { useI18n, type TranslationKey } from '../i18n';
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

function ReportStatus({ report }: { report: Report }) {
  const { t } = useI18n();
  const status = text(report.status);
  const reason = text(report.reason);
  const statusKey = Object.hasOwn(statusKeys, status)
    ? statusKeys[status]
    : undefined;
  const reasonKey = Object.hasOwn(reasonKeys, reason)
    ? reasonKeys[reason]
    : undefined;
  return (
    <>
      {status && (
        <p>
          {statusKey ? t(statusKey) : status}
          {reason ? ` · ${reasonKey ? t(reasonKey) : reason}` : ''}
        </p>
      )}
      {typeof report.model === 'string' && (
        <p>
          {t('quality.model')}: {text(report.model)}
        </p>
      )}
      {typeof report.error === 'string' && (
        <p role="status" className="plugin-settings-error">
          {text(report.error)}
        </p>
      )}
    </>
  );
}

function ReportText({
  label,
  value,
  truncated,
}: {
  label: string;
  value: unknown;
  truncated?: boolean;
}) {
  const { t } = useI18n();
  if (typeof value !== 'string' || !value) return null;
  return (
    <details>
      <summary className="cursor-pointer">{label}</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
        {text(value, 12000)}
      </pre>
      {(truncated || value.length > 12000) && (
        <p>{t('automation.outputTruncated')}</p>
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
  return (
    <article className="space-y-2 rounded border border-[var(--theme-border)] p-3">
      <h4 className="break-words font-semibold">{text(report.path, 4096)}</h4>
      <ReportStatus report={report} />
      {typeof report.written === 'boolean' && (
        <p>
          {t(
            report.written
              ? 'quality.report.fileWritten'
              : 'quality.report.fileUnchanged',
          )}
        </p>
      )}
      {!!findings.length && (
        <div>
          <p className="font-medium">{t('quality.report.findings')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {findings.slice(0, 100).map((finding, index) => (
              <li key={index} className="whitespace-pre-wrap break-words">
                {text(finding)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {findings.length > 100 && <p>{t('automation.outputTruncated')}</p>}
      {Array.isArray(report.findings) && !findings.length && (
        <p>{t('quality.report.noFindings')}</p>
      )}
      <ReportText
        label={t('quality.report.diff')}
        value={report.diff}
        truncated={report.diffTruncated === true}
      />
      <ReportText
        label={t('quality.report.proposal')}
        value={report.proposedRewrite}
      />
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
      <div className="space-y-3">
        <ReportStatus report={report} />
        {reply && (
          <div>
            <p className="font-medium">{t('quality.report.reply')}</p>
            <ReportStatus report={reply} />
          </div>
        )}
        {typeof report.documentScanError === 'string' && (
          <p role="status" className="plugin-settings-error">
            {t('quality.report.scanError')}: {text(report.documentScanError)}
          </p>
        )}
        {!documents.length && <p>{t('quality.report.noDocuments')}</p>}
        {documents.slice(0, 5).map((document, index) => (
          <DocumentReport key={index} report={document} />
        ))}
        {(report.documentsTruncated === true || documents.length > 5) && (
          <p>{t('quality.report.moreDocuments')}</p>
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
    return <ReportStatus report={report} />;
  return null;
}
