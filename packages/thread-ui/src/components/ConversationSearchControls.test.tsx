import { describe, expect, it } from 'vitest';
import { plainSearchText, searchHighlightParts } from './ConversationSearchControls';

describe('literal search excerpt highlighting', () => {
  it('maps Unicode case expansions and emoji back to the displayed text', () => {
    expect(searchHighlightParts('🙂 İSTANBUL 中文 100% _', 'i\u0307stanbul 中文')).toEqual({
      before: '🙂 ', match: 'İSTANBUL 中文', after: ' 100% _',
    });
    expect(searchHighlightParts('🙂 中文', '🙂')).toEqual({ before: '', match: '🙂', after: ' 中文' });
  });
  it('keeps unmatched excerpts intact and bounds long context without breaking characters', () => {
    expect(searchHighlightParts('hello', 'missing')).toEqual({ before: 'hello', match: '', after: '' });
    const parts = searchHighlightParts(`${'中'.repeat(300)}100% _${'🙂'.repeat(300)}`, '100% _');
    expect(parts.before).toBe(`…${'中'.repeat(80)}`);
    expect(parts.match).toBe('100% _');
    expect(parts.after).toBe(`${'🙂'.repeat(180)}…`);
  });
});

describe('plainSearchText', () => {
  it('drops Markdown marks and link targets but keeps the words', () => {
    expect(plainSearchText('已合入 `main`，**22 项**已修复。[PR #145](https://github.com/x/y/pull/145) · ![图](a.png)'))
      .toBe('已合入 main，22 项已修复。PR #145 · 图');
    expect(plainSearchText('## 标题\n> 引用 *强调* 和 snake_case_name')).toBe('标题 引用 强调 和 snake_case_name');
  });
});
