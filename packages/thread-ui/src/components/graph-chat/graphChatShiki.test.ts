import { describe, expect, it } from 'vitest';

import { CSS_VARIABLES_SYNTAX_THEME, syntaxThemeFor } from './graphChatShiki';

describe('syntaxThemeFor', () => {
  it('keeps the Classic themes and gives Plum Pocket its CSS palette in both modes', () => {
    expect(syntaxThemeFor(false, false)).toBe('github-light-default');
    expect(syntaxThemeFor(true, false)).toBe('ayu-dark');
    expect(syntaxThemeFor(false, true)).toBe(CSS_VARIABLES_SYNTAX_THEME);
    expect(syntaxThemeFor(true, true)).toBe(CSS_VARIABLES_SYNTAX_THEME);
  });
});
