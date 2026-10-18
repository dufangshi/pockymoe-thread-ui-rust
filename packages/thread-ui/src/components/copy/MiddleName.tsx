/** A file name that shortens in the middle only when it must, keeping its end
    and extension: `very-long-report-na…draft-3.md`. Used by the tree, the file
    tabs and attachments (docs/ui-principles.md §14). */
export function MiddleName({ name, className }: { name: string; className?: string }) {
  const keep = Math.min(name.length, Math.max(8, name.length - name.lastIndexOf('.') + 5));
  if (name.length <= keep + 2) return <span className={`middle-name${className ? ` ${className}` : ''}`}><span className="middle-name-head">{name}</span></span>;
  return (
    <span className={`middle-name${className ? ` ${className}` : ''}`}>
      <span className="middle-name-head">{name.slice(0, -keep)}</span>
      <span className="middle-name-tail">{name.slice(-keep)}</span>
    </span>
  );
}
