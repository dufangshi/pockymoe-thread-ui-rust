import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { copyText } from '../shell/terminalClipboard';

export type CopyState = 'idle' | 'copied' | 'failed';

/** Copies `value`; returns the state to show. Shared by every copy control. */
export function useCopy() {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (value: string) => {
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1500 : 3000);
    return ok;
  };
  return { state, copy };
}

/** The one copy control: a two-page icon that turns into a check when copied, or
    a red warning with "Copy failed" beside it; either is announced. */
export function CopyButton({ value, label, className, onCopied }: {
  value: string | (() => string);
  /** What it copies, e.g. "Copy path". */
  label: string;
  className?: string | undefined;
  onCopied?: (() => void) | undefined;
}) {
  useI18n();
  const { state, copy } = useCopy();
  const text = state === 'copied' ? translate('common.copied') : state === 'failed' ? translate('common.copyFailed') : label;
  return (
    <button type="button" className={`copy-button${className ? ` ${className}` : ''}`} data-state={state}
      aria-label={label} title={text}
      onClick={async (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (await copy(typeof value === 'function' ? value() : value)) onCopied?.();
      }}>
      {state === 'copied' ? <Check aria-hidden="true" /> : state === 'failed' ? <TriangleAlert aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {state === 'failed' ? <span className="copy-button-note" aria-hidden="true">{text}</span> : null}
      <span className="copy-button-status" role="status">{state === 'idle' ? '' : text}</span>
    </button>
  );
}
