import { translate, type TranslationKey } from '../../i18n';

// Turn errors the Supervisor writes itself, in English; shown in the reader's
// language. Errors from a harness are shown as they came.
const KNOWN: Record<string, TranslationKey> = {
  'Backend completion was not confirmed before the Supervisor connection ended. Reconnect to verify before continuing.': 'chat.errorCompletionUnconfirmed',
};

export function turnErrorText(error: string) {
  const key = KNOWN[error.trim()];
  return key ? translate(key) : error;
}
