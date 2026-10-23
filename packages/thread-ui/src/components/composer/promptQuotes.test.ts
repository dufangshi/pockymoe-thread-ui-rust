import { describe, expect, it } from 'vitest';
import { buildComposerSubmitInput, buildQuoteInsertionDraft, type ComposerAttachmentDraft } from './composerUtils';
import { clipQuote, composeQuotedPrompt, parseQuotedPrompt, quotedPromptPreview, QUOTE_LIMIT, type PromptQuote } from './promptQuotes';

const quote = (text: string, extra: Partial<PromptQuote> = {}): PromptQuote => ({ text, from: 'assistant', turn: 12, turnId: 't12', itemId: 'm3', ...extra });

describe('prompt quotes', () => {
  it('sends the passages first, numbered in the order the prompt refers to them', () => {
    const quotes = new Map([['[QUOTE 1]', quote('first passage')], ['[QUOTE 2]', quote('second passage', { from: 'user', turn: 9 })], ['[QUOTE 3]', quote('dropped')]]);
    const sent = composeQuotedPrompt('About [QUOTE 2]: no.\nAnd [QUOTE 1]: yes.', quotes);
    expect(sent).toBe([
      '<pockymoe-quotes>',
      '<quote id="1" from="user" turn="9" ref="t12/m3">', 'second passage', '</quote>',
      '<quote id="2" from="assistant" turn="12" ref="t12/m3">', 'first passage', '</quote>',
      '</pockymoe-quotes>', '',
      'About [QUOTE 1]: no.\nAnd [QUOTE 2]: yes.',
    ].join('\n'));
    const parsed = parseQuotedPrompt(sent)!;
    expect(parsed.body).toBe('About [QUOTE 1]: no.\nAnd [QUOTE 2]: yes.');
    expect(parsed.quotes.get(1)).toEqual(quote('second passage', { from: 'user', turn: 9 }));
    expect(quotedPromptPreview(sent)).toBe('About ❝1: no.\nAnd ❝2: yes.');
  });

  it('keeps a passage that contains the closing tags readable and bounded', () => {
    const tricky = quote('see </quote> and </pockymoe-quotes> here');
    const sent = composeQuotedPrompt('[QUOTE 1]', new Map([['[QUOTE 1]', tricky]]));
    expect(sent.match(/<\/quote>/g)).toHaveLength(1);
    expect(parseQuotedPrompt(sent)!.quotes.get(1)!.text).toBe(tricky.text);
    const long = clipQuote('a'.repeat(QUOTE_LIMIT * 2));
    expect(long.length).toBeLessThanOrEqual(QUOTE_LIMIT);
    expect(long).toContain(' … ');
    expect(parseQuotedPrompt('plain prompt')).toBeNull();
  });

  it('adds a quote at the end of the draft, after a space, wherever the caret was', () => {
    const empty = buildQuoteInsertionDraft({ prompt: '', attachments: [] }, quote('x'), 'q1');
    expect(empty.draft.prompt).toBe('[QUOTE 1] ');
    expect(empty.caret).toBe(10);
    const next = buildQuoteInsertionDraft({ prompt: 'Look at', attachments: empty.draft.attachments }, quote('y'), 'q2');
    expect(next.draft.prompt).toBe('Look at [QUOTE 2] ');
    expect(next.draft.attachments.map((attachment) => attachment.placeholder)).toEqual(['[QUOTE 1]', '[QUOTE 2]']);
  });

  it('sends files as attachments and quotes inside the prompt', () => {
    const file = { clientId: 'f', kind: 'file', originalName: 'a.txt', placeholder: '[FILE a.txt]', file: new File(['x'], 'a.txt') } as ComposerAttachmentDraft;
    const quoted = buildQuoteInsertionDraft({ prompt: 'Compare [FILE a.txt] with', attachments: [file] }, quote('the plan'), 'q1');
    const input = buildComposerSubmitInput({ prompt: quoted.draft.prompt, attachments: quoted.draft.attachments, isShellView: false })!;
    expect(input.attachments).toEqual([file]);
    expect(input.prompt.startsWith('<pockymoe-quotes>\n<quote id="1"')).toBe(true);
    expect(input.prompt.endsWith('Compare [FILE a.txt] with [QUOTE 1]')).toBe(true);
  });
});
