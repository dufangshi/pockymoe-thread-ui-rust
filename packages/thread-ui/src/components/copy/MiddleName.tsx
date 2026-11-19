import type { ReactNode } from 'react';
/** A file name that shortens in the middle only when it must, keeping its end
    and extension: `very-long-report-na…draft-3.md`. Used by the tree, the file
    tabs and attachments (docs/ui-principles.md §14). */
export function MiddleName({ name, className, ranges }: { name: string; className?: string; ranges?: ReadonlyArray<{ start: number; end: number }> | undefined }) {
  // Matched characters (a filter) stay marked wherever the name is cut.
  const part = (start: number, end: number): ReactNode => {
    if (!ranges?.length) return name.slice(start, end);
    const out: ReactNode[] = [];
    let at = start;
    for (const range of ranges) {
      const from = Math.max(range.start, start), to = Math.min(range.end, end);
      if (to <= from) continue;
      if (from > at) out.push(name.slice(at, from));
      out.push(<mark key={from} className="middle-name-match">{name.slice(from, to)}</mark>);
      at = to;
    }
    if (at < end) out.push(name.slice(at, end));
    return out;
  };
  const dot = name.lastIndexOf('.');
  const keep = Math.min(name.length, dot > 0 && name.length - dot <= 12 ? Math.max(8, name.length - dot + 5) : 8);
  if (name.length <= keep + 2) {
    // A short name that still does not fit (a narrow column, a wide font) loses
    // its base, never its extension: `diagr….drawio`, not `diagram.draw…`.
    const split = dot > 0 && name.length > 8 && name.length - dot <= 12 ? dot : name.length;
    return (
      <span className={`middle-name${className ? ` ${className}` : ''}`}>
        <span className="middle-name-head">{part(0, split)}</span>
        {split < name.length ? <span className="middle-name-tail">{part(split, name.length)}</span> : null}
      </span>
    );
  }
  return (
    <span className={`middle-name${className ? ` ${className}` : ''}`}>
      <span className="middle-name-head">{part(0, name.length - keep)}</span>
      <span className="middle-name-tail">{part(name.length - keep, name.length)}</span>
    </span>
  );
}
