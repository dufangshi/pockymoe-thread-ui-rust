import { useI18n } from '../i18n';
import type { PluginActionOutputContext } from './plugin-types';
import { usePlugins } from './usePlugins';

const OUTPUT_LIMIT = 24_000;

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
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
        {json.slice(0, OUTPUT_LIMIT)}
      </pre>
      {json.length > OUTPUT_LIMIT && <p>{t('automation.outputTruncated')}</p>}
    </>
  );
  return (
    <details
      open
      className="plugin-action-output space-y-2"
      aria-label={t('automation.pluginOutput')}
    >
      <summary className="cursor-pointer font-medium">
        {t('automation.pluginOutput')}
      </summary>
      {rendered ?? raw}
      {rendered && (
        <details>
          <summary className="cursor-pointer">
            {t('automation.rawOutput')}
          </summary>
          {raw}
        </details>
      )}
    </details>
  );
}
