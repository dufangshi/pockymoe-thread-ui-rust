import { translate, useI18n } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';
import { getGraphChatHighlighter } from './graph-chat/graphChatShiki';
import { languageForPath } from './graph-workspace/workspaceTree';
import { useAppShellNav } from '../app-shell/AppShellNavContext';

/** `compact` hides file headers: the caller names a single file, and several
    files get one short label each. Headers still select the highlighter. */
export function DiffDetail({ text, compact = false, formatPath }: { text: string; compact?: boolean; formatPath?: (path: string) => string }) {
  useI18n();
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const theme = useAppShellNav()?.effectiveTheme ?? (document.documentElement.dataset.themeEffective === 'light' ? 'light' : 'dark');
  useEffect(() => {
    let active = true;
    void getGraphChatHighlighter().then(value => { if (active) setHighlighter(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const rows = useMemo(() => {
    let oldLine = 0, newLine = 0, path = '', inHunk = false;
    const lines = text.split('\n');
    // "--- a" followed by "+++ b" is a file header; inside a hunk "--- x" is a removed "-- x".
    const header = (index: number) => {
      const line = lines[index]!;
      return line.startsWith('diff ') || line.startsWith('index ')
        || (line.startsWith('--- ') && lines[index + 1]?.startsWith('+++ '))
        || (line.startsWith('+++ ') && lines[index - 1]?.startsWith('--- '));
    };
    const files = new Set(lines.filter((line, index) => line.startsWith('+++ ') && header(index)));
    return lines.flatMap((line, index) => {
      if (header(index)) {
        inHunk = false;
        if (line.startsWith('+++ ')) path = line.slice(4).replace(/^b\//, '');
        if (compact) {
          return line.startsWith('+++ ') && files.size > 1
            ? [{ line, kind: 'file', code: formatPath ? formatPath(path) : path, oldNumber: null, newNumber: null, tokens: undefined }]
            : [];
        }
      }
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); inHunk = true; }
      const kind = !hunk && inHunk ? (line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : line.startsWith(' ') ? 'context' : 'meta') : 'meta';
      const code = kind === 'meta' ? line : line.slice(1);
      const oldNumber = kind === 'remove' || kind === 'context' ? oldLine++ : null;
      const newNumber = kind === 'add' || kind === 'context' ? newLine++ : null;
      const language = languageForPath(path);
      const lang = language && highlighter?.getLoadedLanguages().includes(language) ? language : 'text';
      const tokens = kind !== 'meta' ? highlighter?.codeToTokens(code, { lang, theme: theme === 'light' ? 'github-light-default' : 'ayu-dark' }).tokens[0] : undefined;
      return [{ line, kind, code, oldNumber, newNumber, tokens }];
    });
  }, [text, highlighter, theme, compact, formatPath]);
  // A new file has no old lines; its empty number column is dropped.
  const oldColumn = rows.some(row => row.oldNumber !== null);
  return <pre className="thread-diff" aria-label={translate("files.fileChanges")} data-highlighted={Boolean(highlighter)}>
    {rows.map((row, index) => <div key={index} className={`thread-diff-line is-${row.kind}`}>
      {oldColumn ? <span className="thread-diff-number">{row.oldNumber}</span> : null}<span className="thread-diff-number">{row.newNumber}</span>
      <span className="thread-diff-sign">{row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}</span>
      <code>{row.tokens?.map((token, i) => <span key={i} style={{ color: theme === 'light' && token.color ? `color-mix(in oklch, ${token.color} 65%, var(--theme-fg))` : token.color }}>{token.content}</span>) ?? row.code}</code>
    </div>)}
  </pre>;
}
