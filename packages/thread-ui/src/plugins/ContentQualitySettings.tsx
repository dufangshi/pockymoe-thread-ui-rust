import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n';
import type {
  PluginSettingsContext,
  PluginSettingsSnapshot,
  UpstreamConnectionProtocol,
} from './plugin-types';

/** Wire formats the Content Quality backend can call. */
const connectionProtocols: UpstreamConnectionProtocol[] = [
  'openai_chat',
  'openai_responses',
  'anthropic',
  'gemini',
];

const presets = [
  'concise',
  'clear',
  'technical',
  'beginner',
  'copyedit',
] as const;
const details = ['short', 'balanced', 'detailed'] as const;
/**
 * Polishing context limits. Runtimes without the `replyContextLimits` capability
 * ignore them and still read the whole history.
 */
const contextLimits = {
  replyContextTurns: { min: 1, max: 1000 },
  replyContextMaxChars: { min: 1, max: 10_000_000 },
} as const;
type QualitySettings = {
  connectionId: string;
  connectionFile: string;
  model: string;
  language: string;
  preset: (typeof presets)[number];
  detail: (typeof details)[number];
  readerBackground: string;
  minReplyChars: number;
  replyContextTurns: number;
  replyContextMaxChars: number;
  autoReplies: boolean;
  autoDocuments: boolean;
  documentMode: 'review' | 'rewrite';
};

const defaults: QualitySettings = {
  connectionId: '',
  connectionFile: '',
  model: '',
  language: 'zh-CN',
  preset: 'clear',
  detail: 'balanced',
  readerBackground: '',
  minReplyChars: 800,
  replyContextTurns: 5,
  replyContextMaxChars: 10000,
  autoReplies: true,
  autoDocuments: false,
  documentMode: 'review',
};

function readValues(snapshot: PluginSettingsSnapshot): QualitySettings {
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !snapshot.values ||
    typeof snapshot.values !== 'object' ||
    Array.isArray(snapshot.values)
  ) {
    throw new Error('Invalid plugin settings snapshot');
  }
  const values = { ...defaults };
  for (const key of [
    'connectionId',
    'connectionFile',
    'model',
    'language',
    'readerBackground',
  ] as const) {
    if (typeof snapshot.values[key] === 'string')
      values[key] = snapshot.values[key];
  }
  if (presets.includes(snapshot.values.preset as QualitySettings['preset']))
    values.preset = snapshot.values.preset as QualitySettings['preset'];
  if (details.includes(snapshot.values.detail as QualitySettings['detail']))
    values.detail = snapshot.values.detail as QualitySettings['detail'];
  if (typeof snapshot.values.autoReplies === 'boolean')
    values.autoReplies = snapshot.values.autoReplies;
  if (typeof snapshot.values.autoDocuments === 'boolean')
    values.autoDocuments = snapshot.values.autoDocuments;
  if (
    typeof snapshot.values.minReplyChars === 'number' &&
    Number.isSafeInteger(snapshot.values.minReplyChars) &&
    snapshot.values.minReplyChars >= 0
  )
    values.minReplyChars = snapshot.values.minReplyChars;
  for (const key of ['replyContextTurns', 'replyContextMaxChars'] as const) {
    const value = snapshot.values[key];
    if (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= contextLimits[key].min &&
      value <= contextLimits[key].max
    )
      values[key] = value;
  }
  if (
    snapshot.values.documentMode === 'review' ||
    snapshot.values.documentMode === 'rewrite'
  )
    values.documentMode = snapshot.values.documentMode;
  return values;
}

function isConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  return (
    ('statusCode' in error && error.statusCode === 409) ||
    ('status' in error && error.status === 409)
  );
}

/** Whether the runtime applies context limits; unknown when no descriptor is given. */
function contextLimitsSupport(plugin: PluginSettingsContext['plugin']) {
  if (!plugin) return undefined;
  const flagged = (value: unknown) =>
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { replyContextLimits?: unknown }).replyContextLimits === true;
  return flagged(plugin.capabilities) || flagged(plugin);
}

export function ContentQualitySettings({
  load,
  save,
  connections,
  plugin,
}: PluginSettingsContext) {
  const { t } = useI18n();
  const scope = useId();
  const [values, setValues] = useState<QualitySettings | null>(null);
  // Values this form does not edit are saved back unchanged.
  const [stored, setStored] = useState<Record<string, unknown>>({});
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<
    | 'loading'
    | 'ready'
    | 'saving'
    | 'saved'
    | 'loadError'
    | 'saveError'
    | 'conflict'
  >('loading');
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setStatus('loading');
    try {
      const snapshot = await load();
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setStored(snapshot.values);
      setRevision(snapshot.revision);
      setStatus('ready');
    } catch {
      if (id === requestId.current) setStatus('loadError');
    }
  }, [load]);

  const cancelPending = useCallback(() => {
    ++requestId.current;
  }, []);
  useEffect(() => {
    void reload();
    return cancelPending;
  }, [reload, cancelPending]);

  function update<K extends keyof QualitySettings>(
    key: K,
    value: QualitySettings[K],
  ) {
    setValues((current) => (current ? { ...current, [key]: value } : current));
    setStatus((current) =>
      current === 'saved' || current === 'saveError' ? 'ready' : current,
    );
  }

  async function submit() {
    if (
      !values ||
      status === 'loading' ||
      status === 'saving' ||
      status === 'conflict' ||
      status === 'loadError'
    )
      return;
    const id = ++requestId.current;
    setStatus('saving');
    try {
      const body: Record<string, unknown> = { ...stored, ...values };
      // Supervisors before saved connections reject an unknown connectionId.
      if (!values.connectionId && !('connectionId' in stored))
        delete body.connectionId;
      // A runtime that declares context limits always gets them (defaults included);
      // one known to lack them never gets new ones (stored values pass through).
      // When support is unknown, send them only once stored or changed, so an
      // untouched form still saves on a runtime that would reject the keys.
      for (const key of [
        'replyContextTurns',
        'replyContextMaxChars',
      ] as const) {
        if (limitsSupported === true) continue;
        if (limitsSupported === false) {
          if (key in stored) body[key] = stored[key];
          else delete body[key];
        } else if (!(key in stored) && values[key] === defaults[key])
          delete body[key];
      }
      const snapshot = await save({ revision, values: body });
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setStored(snapshot.values);
      setRevision(snapshot.revision);
      setStatus('saved');
    } catch (error) {
      if (id === requestId.current)
        setStatus(isConflict(error) ? 'conflict' : 'saveError');
    }
  }

  function field(
    key: keyof QualitySettings,
    label: string,
    control: ReactNode,
    hint?: string,
  ) {
    return (
      <div className="plugin-settings-field">
        <label htmlFor={`${scope}-${key}`}>{label}</label>
        {control}
        {hint && <p id={`${scope}-${key}-hint`}>{hint}</p>}
      </div>
    );
  }

  const busy = status === 'loading' || status === 'saving';
  const limitsSupported = contextLimitsSupport(plugin);
  const error =
    status === 'loadError' || status === 'saveError' || status === 'conflict';
  return (
    <form
      className="plugin-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      aria-busy={busy}
    >
      {values && (
        <fieldset disabled={busy} className="plugin-settings-fields">
          {/* Only saved connections are offered here. Older stored values (a profile
              file, its model) are not shown but are saved back unchanged. */}
          <div
            className="plugin-settings-field"
            role="group"
            aria-labelledby={`${scope}-connection`}
            aria-describedby={`${scope}-connection-hint`}
          >
            <span id={`${scope}-connection`}>{t('quality.connection')}</span>
            {connections?.renderPicker({
              connectionId: values.connectionId,
              model: values.model,
              protocols: connectionProtocols,
              disabled: busy,
              onChange: (next) => {
                update('connectionId', next.connectionId);
                update('model', next.model);
              },
            })}
            <p id={`${scope}-connection-hint`}>
              {t(
                !connections
                  ? 'quality.connectionUnavailable'
                  : values.connectionId
                    ? 'quality.connectionHint'
                    : values.connectionFile
                      ? 'quality.connectionLegacyHint'
                      : 'quality.connectionEmpty',
              )}
            </p>
          </div>
          {field(
            'language',
            t('quality.language'),
            <input
              id={`${scope}-language`}
              aria-describedby={`${scope}-language-hint`}
              value={values.language}
              maxLength={64}
              required
              onChange={(event) => update('language', event.target.value)}
            />,
            t('quality.languageHint'),
          )}
          {field(
            'preset',
            t('quality.preset'),
            <select
              id={`${scope}-preset`}
              aria-describedby={`${scope}-preset-hint`}
              value={values.preset}
              onChange={(event) =>
                update(
                  'preset',
                  event.target.value as QualitySettings['preset'],
                )
              }
            >
              {presets.map((preset) => (
                <option key={preset} value={preset}>
                  {t(`quality.preset.${preset}`)}
                </option>
              ))}
            </select>,
            t(`quality.preset.${values.preset}.description`),
          )}
          {field(
            'detail',
            t('quality.detail'),
            <select
              id={`${scope}-detail`}
              value={values.detail}
              onChange={(event) =>
                update(
                  'detail',
                  event.target.value as QualitySettings['detail'],
                )
              }
            >
              {details.map((detail) => (
                <option key={detail} value={detail}>
                  {t(`quality.detail.${detail}`)}
                </option>
              ))}
            </select>,
          )}
          {field(
            'readerBackground',
            t('quality.readerBackground'),
            <textarea
              id={`${scope}-readerBackground`}
              aria-describedby={`${scope}-readerBackground-hint`}
              rows={3}
              value={values.readerBackground}
              maxLength={2000}
              onChange={(event) =>
                update('readerBackground', event.target.value)
              }
            />,
            t('quality.readerBackgroundHint'),
          )}
          {field(
            'minReplyChars',
            t('quality.minReplyChars'),
            <input
              id={`${scope}-minReplyChars`}
              aria-describedby={`${scope}-minReplyChars-hint`}
              type="number"
              min={0}
              max={65536}
              step={1}
              required
              value={
                Number.isNaN(values.minReplyChars) ? '' : values.minReplyChars
              }
              onChange={(event) =>
                update('minReplyChars', event.target.valueAsNumber)
              }
            />,
            t('quality.minReplyCharsHint'),
          )}
          {field(
            'replyContextTurns',
            t('quality.replyContextTurns'),
            <input
              id={`${scope}-replyContextTurns`}
              aria-describedby={`${scope}-replyContextTurns-hint`}
              disabled={limitsSupported === false}
              type="number"
              min={contextLimits.replyContextTurns.min}
              max={contextLimits.replyContextTurns.max}
              step={1}
              required
              value={
                Number.isNaN(values.replyContextTurns)
                  ? ''
                  : values.replyContextTurns
              }
              onChange={(event) =>
                update('replyContextTurns', event.target.valueAsNumber)
              }
            />,
            t(
              limitsSupported === false
                ? 'quality.contextLimitsNeedUpdate'
                : 'quality.replyContextTurnsHint',
            ),
          )}
          {field(
            'replyContextMaxChars',
            t('quality.replyContextMaxChars'),
            <input
              id={`${scope}-replyContextMaxChars`}
              aria-describedby={`${scope}-replyContextMaxChars-hint`}
              disabled={limitsSupported === false}
              type="number"
              min={contextLimits.replyContextMaxChars.min}
              max={contextLimits.replyContextMaxChars.max}
              step={1}
              required
              value={
                Number.isNaN(values.replyContextMaxChars)
                  ? ''
                  : values.replyContextMaxChars
              }
              onChange={(event) =>
                update('replyContextMaxChars', event.target.valueAsNumber)
              }
            />,
            t('quality.replyContextMaxCharsHint'),
          )}
          <div className="plugin-settings-field">
            <label
              className="plugin-settings-checkbox"
              htmlFor={`${scope}-autoReplies`}
            >
              <input
                id={`${scope}-autoReplies`}
                aria-describedby={`${scope}-autoReplies-hint`}
                type="checkbox"
                checked={values.autoReplies}
                onChange={(event) =>
                  update('autoReplies', event.target.checked)
                }
              />
              <span>{t('quality.autoReplies')}</span>
            </label>
            <p id={`${scope}-autoReplies-hint`}>
              {t('quality.autoRepliesHint')}
            </p>
          </div>
          <div className="plugin-settings-field">
            <label
              className="plugin-settings-checkbox"
              htmlFor={`${scope}-autoDocuments`}
            >
              <input
                id={`${scope}-autoDocuments`}
                aria-describedby={`${scope}-autoDocuments-hint`}
                type="checkbox"
                checked={values.autoDocuments}
                onChange={(event) =>
                  update('autoDocuments', event.target.checked)
                }
              />
              <span>{t('quality.autoDocuments')}</span>
            </label>
            <p id={`${scope}-autoDocuments-hint`}>
              {t('quality.autoDocumentsHint')}
            </p>
          </div>
          {field(
            'documentMode',
            t('quality.documentMode'),
            <select
              id={`${scope}-documentMode`}
              aria-describedby={`${scope}-documentMode-hint`}
              value={values.documentMode}
              onChange={(event) =>
                update(
                  'documentMode',
                  event.target.value as QualitySettings['documentMode'],
                )
              }
            >
              <option value="review">{t('quality.documentMode.review')}</option>
              <option value="rewrite">
                {t('quality.documentMode.rewrite')}
              </option>
            </select>,
            t('quality.documentModeHint'),
          )}
        </fieldset>
      )}
      {status !== 'ready' && (
        <p
          role={error ? 'alert' : 'status'}
          className={error ? 'plugin-settings-error' : undefined}
        >
          {t(
            status === 'loading'
              ? 'quality.loading'
              : status === 'saving'
                ? 'quality.saving'
                : status === 'saved'
                  ? 'quality.saved'
                  : status === 'conflict'
                    ? 'quality.conflict'
                    : status === 'loadError'
                      ? 'quality.loadError'
                      : 'quality.saveError',
          )}
        </p>
      )}
      <div className="plugin-settings-actions">
        <button
          type="submit"
          className="plugin-settings-save"
          disabled={
            !values || busy || status === 'conflict' || status === 'loadError'
          }
        >
          {t('quality.save')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          aria-describedby={`${scope}-reload-hint`}
        >
          {t('quality.reload')}
        </button>
      </div>
      <p id={`${scope}-reload-hint`} className="plugin-settings-hint">
        {t('quality.reloadHint')}
      </p>
    </form>
  );
}
