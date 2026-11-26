import { translate, useI18n } from '../../i18n';
import { setTerminalPreferences, useTerminalPreferences, type TerminalPreferences } from './terminalPreferences';
import { isMacPlatform } from '../shortcuts';

/** Settings > Terminal: clipboard keys and the mouse, kept in this browser. */
export function TerminalSettings() {
  useI18n();
  const preferences = useTerminalPreferences();
  const mac = isMacPlatform();
  const choice = <K extends 'ctrlV' | 'rightClick'>(key: K, label: string, options: [TerminalPreferences[K], string][]) => (
    <fieldset className="terminal-settings-choice">
      <legend>{label}</legend>
      {options.map(([value, text]) => (
        <label key={value}>
          <input type="radio" name={`terminal-${key}`} checked={preferences[key] === value}
            onChange={() => setTerminalPreferences({ [key]: value } as Partial<TerminalPreferences>)} />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
  const toggle = (key: 'copyOnSelect' | 'pasteWarning' | 'allowProgramClipboard', label: string, hint: string) => (
    <label className="terminal-settings-toggle">
      <span><b>{label}</b><small>{hint}</small></span>
      <input type="checkbox" checked={preferences[key]} onChange={event => setTerminalPreferences({ [key]: event.target.checked })} />
    </label>
  );
  return (
    <div className="terminal-settings">
      {toggle('copyOnSelect', translate('files.terminalCopyOnSelect'), translate('files.terminalCopyOnSelectHint'))}
      {toggle('allowProgramClipboard', translate('files.terminalProgramClipboard'), translate('files.terminalProgramClipboardHint'))}
      {/* On a Mac ⌘V pastes and Ctrl+V is always the terminal's key, so there is
          nothing to choose (§19). */}
      {!mac && choice('ctrlV', 'Ctrl+V', [
        ['smart', translate('files.terminalCtrlVSmart')],
        ['paste', translate('files.terminalCtrlVPaste')],
      ])}
      {choice('rightClick', translate('files.terminalRightClick'), [
        ['menu', translate('files.terminalRightClickMenu')],
        ['copyPaste', translate('files.terminalRightClickCopyPaste')],
      ])}
      {toggle('pasteWarning', translate('files.terminalPasteWarning'), translate('files.terminalPasteWarningHint'))}
      <p className="terminal-settings-note">{translate(mac ? 'files.terminalKeysNoteMac' : 'files.terminalKeysNote')}</p>
    </div>
  );
}
