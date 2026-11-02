import { translate } from '../../i18n';
import { confirmAsync } from '../menu/confirmAsync';

/** OSC 8 links are untrusted terminal output. Keep xterm's HTTP(S)-only policy. */
export async function activateTerminalLink(_event: MouseEvent, uri: string): Promise<void> {
  try {
    if (!['http:', 'https:'].includes(new URL(uri).protocol)) return;
  } catch { return; }
  if (await confirmAsync({
    title: translate('files.terminalOpenLinkTitle'),
    description: uri,
    confirmLabel: translate('files.terminalOpenLink'),
    tone: 'primary',
  })) {
    // Give native popup handlers the destination. xterm's default opens a blank
    // window first; hosts deny that window, so its later location assignment is lost.
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}
