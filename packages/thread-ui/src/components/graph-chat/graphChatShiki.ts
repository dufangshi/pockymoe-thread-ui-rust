import type { HighlighterCore } from 'shiki/core';

/** Shiki theme whose token colors are CSS variables (`--shiki-token-*`), so a theme
 *  preset can define its syntax palette in CSS for both color modes. */
export const CSS_VARIABLES_SYNTAX_THEME = 'pockymoe-css-variables';

/** The Shiki theme for code: the theme's CSS palette when it declares
 *  `code.cssSyntaxPalette`. */
export function syntaxThemeFor(dark: boolean, cssPalette: boolean) {
  if (cssPalette) return CSS_VARIABLES_SYNTAX_THEME;
  return dark ? 'ayu-dark' : 'github-light-default';
}

/** Grammar modules, loaded when a block in that language is first shown. All of
 *  them together are over 2 MB; a conversation uses one or two, or none. */
const GRAMMARS: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  csv: () => import('shiki/langs/csv.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
};
/** The names people write after a fence, for the grammars above. */
const ALIASES: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', mts: 'typescript', cts: 'typescript',
  py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', yml: 'yaml', md: 'markdown', htm: 'html',
  rb: 'ruby', rs: 'rust', golang: 'go', 'c++': 'cpp', cc: 'cpp', hpp: 'cpp', h: 'c', cs: 'csharp', 'c#': 'csharp',
  svg: 'xml', jsonc: 'json', json5: 'json',
};
const grammarOf = (language: string) => {
  const name = language.trim().toLowerCase();
  const known = ALIASES[name] ?? name;
  return known in GRAMMARS ? known : null;
};

let corePromise: Promise<HighlighterCore> | null = null;
const loading = new Map<string, Promise<void>>();

function core() {
  corePromise ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light-default.mjs'),
    import('shiki/themes/ayu-dark.mjs'),
  ]).then(([{ createHighlighterCore, createCssVariablesTheme }, { createJavaScriptRegexEngine }, light, dark]) =>
    createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [
        light.default,
        dark.default,
        createCssVariablesTheme({ name: CSS_VARIABLES_SYNTAX_THEME, variablePrefix: '--shiki-', fontStyle: true }),
      ],
      langs: [],
    }));
  return corePromise;
}

/**
 * The highlighter with the grammars for `languages` loaded. Without a list it
 * loads every grammar (file previews and diffs of unknown content). A language
 * it has no grammar for is shown as plain text by the caller.
 */
export async function getGraphChatHighlighter(languages?: readonly string[]) {
  const highlighter = await core();
  const wanted = languages
    ? [...new Set(languages.map(grammarOf).filter((name): name is string => name !== null))]
    : Object.keys(GRAMMARS);
  await Promise.all(wanted.map((name) => {
    let pending = loading.get(name);
    if (!pending) {
      pending = GRAMMARS[name]!()
        .then((grammar) => highlighter.loadLanguage(grammar.default as Parameters<HighlighterCore['loadLanguage']>[0]))
        .catch(() => { loading.delete(name); });
      loading.set(name, pending);
    }
    return pending;
  }));
  return highlighter;
}

/** The languages named on the fences of a Markdown text. */
export function fencedLanguages(markdown: string): string[] {
  const names = new Set<string>();
  for (const match of markdown.matchAll(/^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*([\w#+.-]+)/gm)) names.add(match[1]!);
  return [...names];
}
/** Whether a Markdown text has a fenced block at all. */
export const hasFence = (markdown: string) => /^[ \t]{0,3}(?:`{3,}|~{3,})/m.test(markdown);

// Finished blocks are highlighted once. A streaming answer renders again on
// every piece, and without this each render highlighted every block again.
const highlighted = new Map<string, string>();
/** Highlighted HTML for a block, remembered for the blocks last shown. */
export function highlightCode(highlighter: HighlighterCore, code: string, lang: string, theme: string): string {
  const key = `${theme}\n${lang}\n${code}`;
  const known = highlighted.get(key);
  if (known !== undefined) {
    highlighted.delete(key);
    highlighted.set(key, known);
    return known;
  }
  let html: string;
  try {
    html = highlighter.codeToHtml(code, { lang, theme });
  } catch {
    html = highlighter.codeToHtml(code, { lang: 'text', theme });
  }
  // Large blocks are cheap to keep only in small numbers.
  if (code.length < 200_000) {
    highlighted.set(key, html);
    if (highlighted.size > 300) highlighted.delete(highlighted.keys().next().value!);
  }
  return html;
}
