import { CircleAlert, CircleCheck, CircleDashed, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PluginDto, PluginRunDto, PluginStatusDto, PluginStatusItemDto } from '@pockymoe/shared';
import { useI18n, type TranslationKey } from '../i18n';
import { CopyButton } from '../components/copy/CopyButton';
import { ErrorMark } from '../components/copy/ErrorMark';
import { useDevicePlugins } from './ThreadPluginScope';

const HEALTH: Record<string, { icon: typeof CircleCheck; label: TranslationKey }> = {
  ok: { icon: CircleCheck, label: 'settings.healthOk' },
  needs_reauth: { icon: TriangleAlert, label: 'settings.healthNeedsReauth' },
  transient: { icon: CircleAlert, label: 'settings.healthTransient' },
  notConfigured: { icon: CircleDashed, label: 'settings.healthNotConfigured' },
};

/** One status, told apart by shape and always named in text (ui-principles §6). */
function HealthMark({ item }: { item: PluginStatusItemDto }) {
  const { t } = useI18n();
  const known = HEALTH[item.status] ?? HEALTH.transient!;
  const Icon = known.icon;
  return <span className="installed-plugin-health" data-status={HEALTH[item.status] ? item.status : 'transient'}>
    <Icon size={15} aria-hidden="true" />
    <span>{item.statusText || t(known.label)}</span>
  </span>;
}

function statusOf(output: unknown): PluginStatusDto | null {
  if (!output || typeof output !== 'object') return null;
  const value = output as PluginStatusDto;
  return Array.isArray(value.sections) || typeof value.summary === 'string' ? value : null;
}

function time(value: string | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Settings for a plugin installed from git: read-only status from its `status`
 * action, recent runs and where the code came from. Its connections are managed by
 * the plugin itself, usually through its own thread.
 */
export function InstalledPluginPanel({ plugin }: { plugin: PluginDto }) {
  const { t, locale } = useI18n();
  const adapter = useDevicePlugins().adapter;
  const actions = plugin.capabilities.actions ?? [];
  const canStatus = plugin.enabled && actions.includes('status') && !!adapter?.runPluginAction;
  const [status, setStatus] = useState<PluginStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<PluginRunDto[] | null>(null);

  const refresh = useCallback(async () => {
    if (adapter?.fetchPluginRuns) {
      adapter.fetchPluginRuns(plugin.id).then(setRuns, () => setRuns(prev => prev ?? []));
    }
    if (!canStatus) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adapter!.runPluginAction!(plugin.id, 'status', {});
      setStatus(statusOf(result.output));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [adapter, canStatus, plugin.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const install = plugin.capabilities.install;
  const permissions = plugin.capabilities.permissions ?? [];
  return <div className="installed-plugin-panel">
    {canStatus && <section aria-labelledby="installed-plugin-status">
      <header className="installed-plugin-heading">
        <h3 id="installed-plugin-status">{t('settings.installedStatus')}</h3>
        <button type="button" className="installed-plugin-refresh" onClick={() => void refresh()} disabled={loading}
          aria-label={t('settings.installedRefresh')}>
          <RefreshCw size={14} aria-hidden="true" />
          <span>{loading ? t('settings.installedLoading') : t('settings.installedRefresh')}</span>
        </button>
      </header>
      {error && <ErrorMark message={t('settings.installedStatusFailed')} detail={error} onRetry={() => void refresh()} />}
      {status?.summary && <p className="installed-plugin-summary">{status.summary}</p>}
      {status?.sections?.map(section => <div key={section.title} className="installed-plugin-group">
        <h4>{section.title}</h4>
        <ul>
          {section.items.map(item => <li key={item.label}>
            <span className="installed-plugin-label">{item.label}</span>
            <HealthMark item={item} />
            {item.detail && <span className="installed-plugin-detail">{item.detail}</span>}
          </li>)}
        </ul>
      </div>)}
      <p className="plugin-settings-hint">{t('settings.installedReadOnly')}</p>
    </section>}

    <section aria-labelledby="installed-plugin-runs">
      <h3 id="installed-plugin-runs">{t('settings.installedRuns')}</h3>
      {runs && !runs.length && <p className="plugin-settings-hint">{t('settings.installedNoRuns')}</p>}
      {!!runs?.length && <ul className="installed-plugin-runs">
        {runs.slice(0, 6).map(run => <li key={run.id} data-state={run.state}>
          <span>{time(run.startedAt, locale)}</span>
          <span>{run.action}</span>
          <span>{t(run.trigger === 'schedule' ? 'settings.runSchedule' : 'settings.runManual')}</span>
          <span>{t(run.state === 'completed' ? 'settings.runCompleted' : 'settings.runFailed')}</span>
          {run.error && <span className="installed-plugin-run-error">{run.error}</span>}
        </li>)}
      </ul>}
    </section>

    <section aria-labelledby="installed-plugin-details">
      <h3 id="installed-plugin-details">{t('settings.installedDetails')}</h3>
      <dl className="installed-plugin-details">
        <dt>{t('settings.installedVersion')}</dt><dd>{plugin.version}</dd>
        <dt>{t('settings.installedPermissions')}</dt>
        <dd>{permissions.length
          ? permissions.map(p => <span key={p} className="installed-plugin-permission">
            {p === 'pockymoeCli' ? t('settings.permissionPockymoeCli') : p}
          </span>)
          : t('settings.installedNoPermissions')}</dd>
        {install?.source && <><dt>{t('settings.installedSource')}</dt>
          <dd className="installed-plugin-source"><span>{install.source}</span><CopyButton value={install.source} label={t('settings.installedCopySource')} /></dd></>}
        {install?.commit && <><dt>{t('settings.installedCommit')}</dt>
          <dd className="installed-plugin-source"><code>{install.commit.slice(0, 12)}</code><CopyButton value={install.commit} label={t('settings.installedCopyCommit')} /></dd></>}
        {install?.updatedAt && <><dt>{t('settings.installedUpdated')}</dt><dd>{time(install.updatedAt, locale)}</dd></>}
      </dl>
    </section>
  </div>;
}
