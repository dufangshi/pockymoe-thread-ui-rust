import { translate, useI18n } from '../../i18n';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ClipboardPaste, TextSelect } from 'lucide-react';

/** Phone key bar: keys a soft keyboard lacks, then paste and text selection
    (a long press on the terminal selects too). Sessions live in the title bar. */
export function ShellTouchControls({ enabled, ctrl, onCtrl, onInput, onFocus, onPaste, onSelect }: {
  enabled: boolean; ctrl: boolean; onCtrl: () => void;
  onInput: (data: string) => void; onFocus: () => void;
  onPaste?: () => void; onSelect?: () => void;
}) {
  useI18n();
  const keys = [
    ['Esc', '\x1b'], ['Tab', '\t'], ['↑', '\x1b[A'], ['↓', '\x1b[B'],
    ['←', '\x1b[D'], ['→', '\x1b[C'],
  ] as const;
  const icons = { '↑': ArrowUp, '↓': ArrowDown, '←': ArrowLeft, '→': ArrowRight };
  return <div className="shell-touch-controls" role="toolbar" aria-label={translate("files.terminalControls")}>
    <button type="button" aria-label={translate("files.controlModifier")} aria-pressed={ctrl} disabled={!enabled} onPointerDown={e => e.preventDefault()} onClick={() => { onCtrl(); onFocus(); }}>Ctrl</button>
    {keys.map(([label, data]) => {
      const Icon = icons[label as keyof typeof icons];
      return <button key={label} type="button" aria-label={translate("files.terminal", { value1: label })} disabled={!enabled} onPointerDown={e => e.preventDefault()} onClick={() => { onInput(data); onFocus(); }}>{Icon ? <Icon size={17} /> : label}</button>;
    })}
    {onPaste && <button type="button" className="shell-touch-clipboard" aria-label={translate('files.terminalPaste')} title={translate('files.terminalPaste')} disabled={!enabled} onClick={onPaste}><ClipboardPaste size={17} /></button>}
    {onSelect && <button type="button" aria-label={translate('files.terminalSelectText')} title={translate('files.terminalSelectText')} onPointerDown={e => e.preventDefault()} onClick={onSelect}><TextSelect size={17} /></button>}
  </div>;
}
