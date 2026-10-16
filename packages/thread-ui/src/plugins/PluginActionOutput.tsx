import { useI18n } from '../i18n';
import type { PluginActionOutputContext } from './plugin-types';
import { usePlugins } from './usePlugins';

const OUTPUT_LIMIT = 24_000;

/** A plugin's own report when it renders one, otherwise bounded JSON; raw JSON stays one click away. */
export function PluginActionOutput({
  pluginId,
  action,
  output,
}: PluginActionOutputContext & { pluginId: string }) {
  const { t } = useI18n();
  const plugins = usePlugins();
  const rendered = plugins.renderActionOutput(pluginId, { action, output });
  let json: string;
  try {
    json = JSON.stringify(output, null, 2) ?? String(output);
  } catch {
    json = String(output);
  }
  const raw = (
    <>
      <pre className="plugin-report-pre">{json.slice(0, OUTPUT_LIMIT)}</pre>
      {json.length > OUTPUT_LIMIT && <p className="plugin-report-note">{t('automation.outputTruncated')}</p>}
    </>
  );
  return (
    <section className="plugin-action-output" aria-label={t('automation.pluginOutput')}>
      {rendered ?? raw}
      {rendered && (
        <details className="plugin-report-disclosure">
          <summary>{t('automation.rawOutput')}</summary>
          {raw}
        </details>
      )}
    </section>
  );
}
