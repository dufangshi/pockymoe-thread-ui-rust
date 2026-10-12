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

let graphChatHighlighterPromise: Promise<HighlighterCore> | null = null;

export function getGraphChatHighlighter() {
  graphChatHighlighterPromise ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light-default.mjs'),
    import('shiki/themes/ayu-dark.mjs'),
    import('shiki/langs/javascript.mjs'),
    import('shiki/langs/typescript.mjs'),
    import('shiki/langs/tsx.mjs'),
    import('shiki/langs/jsx.mjs'),
    import('shiki/langs/python.mjs'),
    import('shiki/langs/json.mjs'),
    import('shiki/langs/bash.mjs'),
    import('shiki/langs/shellscript.mjs'),
    import('shiki/langs/yaml.mjs'),
    import('shiki/langs/toml.mjs'),
    import('shiki/langs/markdown.mjs'),
    import('shiki/langs/html.mjs'),
    import('shiki/langs/css.mjs'),
    import('shiki/langs/sql.mjs'),
    import('shiki/langs/csv.mjs'),
    import('shiki/langs/ruby.mjs'),
    import('shiki/langs/rust.mjs'),
    import('shiki/langs/go.mjs'),
    import('shiki/langs/java.mjs'),
    import('shiki/langs/c.mjs'),
    import('shiki/langs/cpp.mjs'),
    import('shiki/langs/csharp.mjs'),
    import('shiki/langs/xml.mjs'),
  ]).then(
    ([
      { createHighlighterCore, createCssVariablesTheme },
      { createJavaScriptRegexEngine },
      ayuLight,
      ayuDark,
      javascript,
      typescript,
      tsx,
      jsx,
      python,
      json,
      bash,
      shellscript,
      yaml,
      toml,
      markdown,
      html,
      css,
      sql,
      csv,
      ruby,
      rust,
      go,
      java,
      c,
      cpp,
      csharp,
      xml,
    ]) =>
      createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        themes: [
          ayuLight.default,
          ayuDark.default,
          createCssVariablesTheme({ name: CSS_VARIABLES_SYNTAX_THEME, variablePrefix: '--shiki-', fontStyle: true }),
        ],
        langs: [
          javascript.default,
          typescript.default,
          tsx.default,
          jsx.default,
          python.default,
          json.default,
          bash.default,
          shellscript.default,
          yaml.default,
          toml.default,
          markdown.default,
          html.default,
          css.default,
          sql.default,
          csv.default,
          ruby.default,
          rust.default,
          go.default,
          java.default,
          c.default,
          cpp.default,
          csharp.default,
          xml.default,
        ],
      }),
  );

  return graphChatHighlighterPromise;
}
