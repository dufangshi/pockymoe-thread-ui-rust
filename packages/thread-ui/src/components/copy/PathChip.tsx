import { useState } from 'react';
import { translate, useI18n } from '../../i18n';
import { CopyButton } from './CopyButton';

/** Splits a path into the part that may shorten and its last segment. */
export function splitPath(path: string) {
  const trimmed = path.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return cut < 0 ? { head: '', tail: path } : { head: path.slice(0, cut + 1), tail: path.slice(cut + 1) };
}

/** A displayed path: monospace, shortened in the middle (its start and last
    segment stay), with a copy button. Tapping it shows the whole path. */
export function PathChip({ path, display, copyValue, label, className }: {
  path: string;
  /** What to show when it differs from the path (e.g. `~` for home). */
  display?: string | undefined;
  /** What to copy when it differs from the path. */
  copyValue?: string | undefined;
  /** The copy button's name; "Copy path" by default. */
  label?: string | undefined;
  className?: string | undefined;
}) {
  useI18n();
  const [whole, setWhole] = useState(false);
  const { head, tail } = splitPath(display ?? path);
  return (
    <span className={`path-chip${whole ? ' is-whole' : ''}${className ? ` ${className}` : ''}`} title={path}>
      <button type="button" className="path-chip-text" aria-expanded={whole}
        aria-label={translate('common.pathShowWhole', { path })} onClick={() => setWhole(value => !value)}>
        {head ? <span className="path-chip-head">{head}</span> : null}
        <span className="path-chip-tail">{tail}</span>
      </button>
      <CopyButton value={copyValue ?? path} label={label ?? translate('common.copyPath')} />
    </span>
  );
}
