import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useMenuKeyboard } from './menu/useMenuKeyboard';

export type ConversationSearchScope = 'thread' | 'workspace' | 'device';

/** Where a search looks: a small menu of our own at the field's start (§3
    keyboard). The host supplies labels and permissions; it never infers access. */
export function ConversationSearchScopePicker({ value, onChange, labels, allowGlobal }: {
  value: ConversationSearchScope;
  onChange: (scope: ConversationSearchScope) => void;
  labels: { scope: string; thread: string; workspace: string; device: string };
  allowGlobal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const scopes: ConversationSearchScope[] = allowGlobal ? ['thread', 'workspace', 'device'] : ['thread'];
  const name = (scope: ConversationSearchScope) => labels[scope];
  useMenuKeyboard(menu, open, (restore) => { setOpen(false); if (restore) trigger.current?.focus(); });
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  // One place to look needs no menu; the label still says where it is.
  if (scopes.length < 2) return <span className="workbench-search-scope is-fixed">{name(value)}</span>;
  return <div ref={root} className="workbench-search-scope-picker">
    <button ref={trigger} type="button" className="workbench-search-scope" aria-label={`${labels.scope}: ${name(value)}`}
      aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span>{name(value)}</span><ChevronDown aria-hidden="true" />
    </button>
    {open && <div ref={menu} role="menu" aria-label={labels.scope} className="workbench-search-scope-menu">
      {scopes.map(scope => <button key={scope} type="button" role="menuitemradio" aria-checked={scope === value}
        onClick={() => { setOpen(false); if (scope !== value) onChange(scope); }}>
        <Check aria-hidden="true" /><span>{name(scope)}</span>
      </button>)}
    </div>}
  </div>;
}

/** Map folded offsets to original Unicode characters (e.g. İ → i + ◌̇). */
export function searchHighlightParts(text: string, query: string) {
  const foldedQuery = query.trim().toLowerCase();
  const found = foldedQuery ? text.toLowerCase().indexOf(foldedQuery) : -1;
  if (found < 0) return { before: text, match: '', after: '' };
  const chars = Array.from(text);
  let folded = 0, first = -1, last = 0;
  for (let i = 0; i < chars.length; i++) {
    const next = folded + chars[i]!.toLowerCase().length;
    if (next > found && first < 0) first = i;
    if (folded < found + foldedQuery.length) last = i + 1;
    folded = next;
    if (folded >= found + foldedQuery.length) break;
  }
  const start = Math.max(0, first - 80), finish = Math.min(chars.length, last + 180);
  return {
    before: `${start ? '…' : ''}${chars.slice(start, first).join('')}`,
    match: chars.slice(first, last).join(''),
    after: `${chars.slice(last, finish).join('')}${finish < chars.length ? '…' : ''}`,
  };
}

export function ConversationSearchExcerpt({ text, query }: { text: string; query: string }) {
  const parts = searchHighlightParts(text, query);
  return <p>{parts.before}{parts.match && <mark>{parts.match}</mark>}{parts.after}</p>;
}
