import { translate } from '../i18n';

/** The Supervisor's placeholder title for a thread nobody has written to yet. */
export const DEFAULT_THREAD_TITLE = 'New thread';

/** A thread's title as shown: the Supervisor's English placeholder in the reader's language. */
export function displayThreadTitle(title: string): string;
export function displayThreadTitle(title: string | null | undefined): string | undefined;
export function displayThreadTitle(title: string | null | undefined) {
  if (title == null) return undefined;
  return title === DEFAULT_THREAD_TITLE ? translate('workbench.newThreadTitle') : title;
}
