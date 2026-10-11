import { describe, expect, it } from 'vitest';

import {
  composerAgentKey,
  attachmentDisplayLabel,
  buildAttachmentInsertionText,
  buildAttachmentInsertionDraft,
  buildAttachmentPlaceholder,
  buildComposerAttachmentDrafts,
  buildComposerSubmitInput,
  clampPercent,
  classifyAttachmentKind,
  deriveComposerSettingsUpdateDecision,
  derivePromptDropAction,
  derivePromptFileDragAction,
  derivePromptKeyDownAction,
  derivePromptPasteAction,
  draftSignature,
  formatGoalTokenBudgetThousands,
  formatModelContextTitle,
  normalizeAttachmentLabel,
  normalizePromptText,
  parseGoalTokenBudgetThousands,
  parseMcpServerName,
  parseMcpServerNameFromBlock,
  renderHttpMcpBlock,
  tokenizePrompt,
  upsertMcpServerBlock,
  type ComposerAttachmentDraft,
} from './composerUtils';

function file(name: string, type: string) {
  return new File(['content'], name, { type });
}

function attachment(
  clientId: string,
  placeholder: string,
  originalName = `${clientId}.txt`,
): ComposerAttachmentDraft {
  return {
    clientId,
    kind: 'file',
    originalName,
    placeholder,
    file: file(originalName, 'text/plain'),
  };
}

describe('composer utilities', () => {
  it('maps harness labels to theme avatar keys', () => {
    expect(composerAgentKey('Claude Code')).toBe('claude');
    expect(composerAgentKey('codex')).toBe('codex');
    expect(composerAgentKey('GitHub Copilot CLI')).toBe('copilot');
    expect(composerAgentKey('Gemini CLI')).toBe('gemini');
    expect(composerAgentKey('Grok Build')).toBe('grok');
    expect(composerAgentKey('DeepSeek Harness')).toBe('deepseek');
    expect(composerAgentKey('dsh')).toBe('deepseek');
    expect(composerAgentKey('Gemini CLI')).toBe('gemini');
    expect(composerAgentKey('acp')).toBeUndefined();
    expect(composerAgentKey(null)).toBeUndefined();
  });

  it('normalizes non-breaking spaces in prompt text', () => {
    expect(normalizePromptText('hello\u00a0world')).toBe('hello world');
  });

  it('tokenizes prompt text and prefers longer attachment placeholders', () => {
    const shortAttachment = attachment('short', '[FILE a]');
    const longAttachment = attachment('long', '[FILE a long]');

    const segments = tokenizePrompt('see [FILE a long] then [FILE a]', [
      shortAttachment,
      longAttachment,
    ]);

    expect(segments.map((segment) => segment.type)).toEqual([
      'text',
      'attachment',
      'text',
      'attachment',
    ]);
    expect(segments[1]).toMatchObject({
      type: 'attachment',
      attachment: { clientId: 'long' },
    });
    expect(segments[3]).toMatchObject({
      type: 'attachment',
      attachment: { clientId: 'short' },
    });
  });

  it('builds stable draft signatures from prompt and attachment metadata', () => {
    const first = draftSignature({
      prompt: 'hello',
      attachments: [attachment('a', '[FILE a]')],
    });
    const second = draftSignature({
      prompt: 'hello',
      attachments: [attachment('a', '[FILE a]')],
    });
    const changed = draftSignature({
      prompt: 'hello',
      attachments: [attachment('b', '[FILE b]')],
    });

    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it('builds trimmed non-shell submit input with active attachments only', () => {
    const activeAttachment = attachment('active', '[FILE active.txt]');
    const inactiveAttachment = attachment('inactive', '[FILE inactive.txt]');

    expect(
      buildComposerSubmitInput({
        prompt: '  inspect [FILE active.txt]  ',
        attachments: [activeAttachment, inactiveAttachment],
        isShellView: false,
      }),
    ).toEqual({
      prompt: 'inspect [FILE active.txt]',
      attachments: [activeAttachment],
    });
  });

  it('omits attachments from non-shell submit input when none are active', () => {
    expect(
      buildComposerSubmitInput({
        prompt: '  plain prompt  ',
        attachments: [attachment('unused', '[FILE unused.txt]')],
        isShellView: false,
      }),
    ).toEqual({ prompt: 'plain prompt' });
  });

  it('returns null for empty non-shell submit input', () => {
    expect(
      buildComposerSubmitInput({
        prompt: '   ',
        attachments: [attachment('unused', '[FILE unused.txt]')],
        isShellView: false,
      }),
    ).toBeNull();
  });

  it('preserves shell submit input and ignores attachments', () => {
    expect(
      buildComposerSubmitInput({
        prompt: '  pnpm test  ',
        attachments: [attachment('unused', '[FILE unused.txt]')],
        isShellView: true,
      }),
    ).toEqual({ prompt: '  pnpm test  ' });
  });

  it('derives paste actions for files, text, HTML fallback, and ignored empty input', () => {
    const pastedFile = file('drop.txt', 'text/plain');

    expect(
      derivePromptPasteAction({
        files: [pastedFile],
        plainText: '',
        htmlText: '',
        htmlToText: () => '',
      }),
    ).toEqual({
      type: 'append-files',
      preventDefault: true,
      files: [pastedFile],
    });
    expect(
      derivePromptPasteAction({
        files: [],
        plainText: 'plain',
        htmlText: '<b>html</b>',
        htmlToText: () => 'html',
      }),
    ).toEqual({
      type: 'insert-text',
      preventDefault: true,
      text: 'plain',
    });
    expect(
      derivePromptPasteAction({
        files: [],
        plainText: '',
        htmlText: '<b>html</b>',
        htmlToText: () => 'html',
      }),
    ).toEqual({
      type: 'insert-text',
      preventDefault: true,
      text: 'html',
    });
    expect(
      derivePromptPasteAction({
        files: [],
        plainText: '',
        htmlText: '',
        htmlToText: () => '',
      }),
    ).toEqual({ type: 'ignore', preventDefault: false });
  });

  it('derives drag/drop file transfer actions', () => {
    const droppedFile = file('drop.txt', 'text/plain');

    expect(derivePromptFileDragAction(false)).toEqual({
      type: 'ignore',
      preventDefault: false,
      activateDragTarget: false,
    });
    expect(derivePromptFileDragAction(true)).toEqual({
      type: 'accept-files',
      preventDefault: true,
      activateDragTarget: true,
    });
    expect(derivePromptDropAction([])).toEqual({
      type: 'ignore',
      preventDefault: false,
      activateDragTarget: false,
    });
    expect(derivePromptDropAction([droppedFile])).toEqual({
      type: 'accept-files',
      preventDefault: true,
      activateDragTarget: true,
      files: [droppedFile],
    });
  });

  it('derives prompt keyboard submit shortcut behavior', () => {
    expect(
      derivePromptKeyDownAction({
        key: 'a',
        metaKey: true,
        ctrlKey: false,
        busy: false,
        disabled: false,
      }),
    ).toEqual({ preventDefault: false, submit: false });
    expect(
      derivePromptKeyDownAction({
        key: 'Enter',
        metaKey: false,
        ctrlKey: false,
        busy: false,
        disabled: false,
      }),
    ).toEqual({ preventDefault: false, submit: false });
    expect(
      derivePromptKeyDownAction({
        key: 'Enter',
        metaKey: true,
        ctrlKey: false,
        busy: true,
        disabled: false,
      }),
    ).toEqual({ preventDefault: true, submit: false });
    expect(
      derivePromptKeyDownAction({
        key: 'Enter',
        metaKey: false,
        ctrlKey: true,
        busy: false,
        disabled: false,
      }),
    ).toEqual({ preventDefault: true, submit: true });
  });

  it.each([
    ['ctrlEnter', false, false, false, false, false],
    ['ctrlEnter', true, false, false, true, false],
    ['ctrlEnter', true, true, false, true, true],
    ['ctrlEnter', false, true, false, false, false],
    ['enter', false, false, false, true, false],
    ['enter', false, true, false, false, false],
    ['enter', true, false, false, true, true],
    ['enter', true, true, false, false, false],
    ['enter', false, false, true, false, false],
  ] as const)('maps %s ctrl=%s shift=%s alt=%s to send/steer', (sendShortcut, ctrlKey, shiftKey, altKey, submit, steer) => {
    const action = derivePromptKeyDownAction({ key: 'Enter', sendShortcut, ctrlKey, shiftKey, altKey, metaKey: false, busy: false, disabled: false });
    expect(action.submit).toBe(submit);
    expect(action.preventDefault).toBe(submit);
    expect(Boolean(action.steer)).toBe(steer);
    expect(derivePromptKeyDownAction({ key: 'Enter', sendShortcut, ctrlKey, shiftKey, altKey, metaKey: false, busy: true, disabled: false }).submit).toBe(false);
  });

  it('supports Command with both shortcut modes and blocks disabled submission', () => {
    expect(derivePromptKeyDownAction({ key: 'Enter', sendShortcut: 'enter', ctrlKey: false, metaKey: true, busy: false, disabled: false })).toEqual({ preventDefault: true, submit: true, steer: true });
    expect(derivePromptKeyDownAction({ key: 'Enter', ctrlKey: false, metaKey: true, shiftKey: true, busy: false, disabled: true })).toEqual({ preventDefault: true, submit: false, steer: true });
  });

  it('derives settings update optimistic mode and rollback behavior', () => {
    expect(
      deriveComposerSettingsUpdateDecision({
        nextMode: 'plan',
        previousOptimisticMode: 'default',
      }),
    ).toEqual({
      optimisticMode: 'plan',
      rollbackMode: 'default',
      shouldRollbackMode: true,
      closeMenuOnSuccess: true,
    });
    expect(
      deriveComposerSettingsUpdateDecision({
        nextMode: undefined,
        previousOptimisticMode: 'plan',
      }),
    ).toEqual({
      optimisticMode: null,
      rollbackMode: null,
      shouldRollbackMode: false,
      closeMenuOnSuccess: true,
    });
    expect(
      deriveComposerSettingsUpdateDecision({
        nextMode: 'default',
        previousOptimisticMode: null,
      }),
    ).toEqual({
      optimisticMode: 'default',
      rollbackMode: null,
      shouldRollbackMode: true,
      closeMenuOnSuccess: true,
    });
  });

  it('parses and formats goal token budgets in thousands', () => {
    expect(parseGoalTokenBudgetThousands('')).toBeNull();
    expect(parseGoalTokenBudgetThousands('12.5')).toBe(12_500);
    expect(Number.isNaN(parseGoalTokenBudgetThousands('-1'))).toBe(true);
    expect(formatGoalTokenBudgetThousands(null)).toBe('');
    expect(formatGoalTokenBudgetThousands(12_000)).toBe('12');
    expect(formatGoalTokenBudgetThousands(12_500)).toBe('12.5');
  });

  it('validates MCP server names and reads names from TOML blocks', () => {
    expect(parseMcpServerName(' valid_name-1 ')).toBe('valid_name-1');
    expect(parseMcpServerName('bad name')).toBeNull();
    expect(
      parseMcpServerNameFromBlock(
        '\n[mcp_servers.example]\ncommand = "node"\n',
      ),
    ).toBe('example');
    expect(parseMcpServerNameFromBlock('[mcp_servers.bad.name]')).toBeNull();
  });

  it('renders and upserts HTTP MCP blocks while preserving unrelated sections', () => {
    const block = renderHttpMcpBlock('docs', ' https://example.test/mcp ');
    expect(block).toBe('[mcp_servers.docs]\nurl = "https://example.test/mcp"\n');

    const config = [
      '[profile]',
      'name = "default"',
      '',
      '[mcp_servers.docs]',
      'url = "https://old.example/mcp"',
      '',
      '[mcp_servers.other]',
      'command = "node"',
      '',
    ].join('\n');

    expect(upsertMcpServerBlock(config, 'docs', block)).toBe(
      [
        '[profile]',
        'name = "default"',
        '',
        '[mcp_servers.docs]',
        'url = "https://example.test/mcp"',
        '',
        '[mcp_servers.other]',
        'command = "node"',
        '',
      ].join('\n'),
    );
    expect(upsertMcpServerBlock('', 'docs', block)).toBe(block);
  });

  it('formats model context labels and clamps percentages', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(44.6)).toBe(45);
    expect(clampPercent(120)).toBe(100);
    expect(formatModelContextTitle(null, null)).toBe('Select model');
    expect(formatModelContextTitle('gpt-test', null)).toBe(
      'gpt-test · context unavailable',
    );
    expect(
      formatModelContextTitle('gpt-test', {
        availability: 'available',
        tokensInContextWindow: 12_500,
        modelContextWindow: 100_000,
        remainingPercent: 87.4,
        updatedAt: null,
      }),
    ).toBe('gpt-test · 12.5k used / 100k · 87.5k left · 87% context left');
  });

  it('normalizes attachment labels and detects attachment kind', () => {
    expect(normalizeAttachmentLabel(' [bad]\nname ')).toBe('bad name');
    expect(normalizeAttachmentLabel('')).toBe('attachment');
    expect(classifyAttachmentKind(file('photo.png', 'image/png'))).toBe('photo');
    expect(classifyAttachmentKind(file('notes.txt', 'text/plain'))).toBe('file');
    expect(
      attachmentDisplayLabel(attachment('photo', '[PHOTO nested/name.png]')),
    ).toBe('nested/name.png');
    expect(attachmentDisplayLabel(attachment('path', '[FILE report]', '/tmp/a.txt'))).toBe(
      'report',
    );
  });

  it('allocates unique attachment placeholders', () => {
    const usedPlaceholders = new Set(['[FILE report.txt]']);

    expect(
      buildAttachmentPlaceholder('file', 'report.txt', usedPlaceholders),
    ).toBe('[FILE report.txt (2)]');
    expect(
      buildAttachmentPlaceholder('photo', 'diagram.png', usedPlaceholders),
    ).toBe('[PHOTO diagram.png]');
  });

  it('builds attachment insertion text with surrounding spaces only when needed', () => {
    expect(
      buildAttachmentInsertionText(
        'beforeafter',
        { start: 6, end: 6 },
        ['[FILE a.txt]'],
      ),
    ).toBe(' [FILE a.txt] ');
    expect(
      buildAttachmentInsertionText(
        'before after',
        { start: 7, end: 7 },
        ['[FILE a.txt]'],
      ),
    ).toBe('[FILE a.txt] ');
    expect(
      buildAttachmentInsertionText(
        'before ',
        { start: 7, end: 7 },
        ['[FILE a.txt]'],
      ),
    ).toBe('[FILE a.txt] ');
  });

  it('builds composer attachment drafts with normalized labels and duplicate suffixes', () => {
    let nextId = 0;
    const usedPlaceholders = new Set(['[PHOTO image.png]']);
    const drafts = buildComposerAttachmentDrafts({
      files: [
        file('image.png', 'image/png'),
        file('notes.txt', 'text/plain'),
      ],
      kindForFile: (entry) => classifyAttachmentKind(entry),
      usedPlaceholders,
      buildClientId: () => {
        nextId += 1;
        return `attachment-${nextId}`;
      },
    });

    expect(drafts.map((draft) => draft.clientId)).toEqual([
      'attachment-1',
      'attachment-2',
    ]);
    expect(drafts.map((draft) => draft.kind)).toEqual(['photo', 'file']);
    expect(drafts.map((draft) => draft.placeholder)).toEqual([
      '[PHOTO image.png (2)]',
      '[FILE notes.txt]',
    ]);
    expect(usedPlaceholders.has('[PHOTO image.png (2)]')).toBe(true);
    expect(usedPlaceholders.has('[FILE notes.txt]')).toBe(true);
  });

  it('builds attachment insertion drafts and caret positions for picked files', () => {
    let nextId = 0;
    const result = buildAttachmentInsertionDraft({
      prompt: 'see this',
      attachments: [attachment('existing', '[FILE old.txt]')],
      files: [file('report.txt', 'text/plain')],
      selection: { start: 4, end: 8 },
      kindForFile: () => 'file',
      buildClientId: () => {
        nextId += 1;
        return `new-${nextId}`;
      },
    });

    expect(result.draft.prompt).toBe('see [FILE report.txt] ');
    expect(result.draft.attachments.map((entry) => entry.clientId)).toEqual([
      'existing',
      'new-1',
    ]);
    expect(result.selection).toEqual({
      start: 'see [FILE report.txt]'.length,
      end: 'see [FILE report.txt]'.length,
    });
    expect(result.insertedAttachmentIds).toEqual(['new-1']);
  });

  it('builds dropped attachment drafts with ordered photos before files', () => {
    let nextId = 0;
    const droppedFiles = [
      file('notes.txt', 'text/plain'),
      file('image.png', 'image/png'),
    ];
    const orderedFiles = [
      ...droppedFiles.filter((entry) => classifyAttachmentKind(entry) === 'photo'),
      ...droppedFiles.filter((entry) => classifyAttachmentKind(entry) === 'file'),
    ];

    const result = buildAttachmentInsertionDraft({
      prompt: 'prompt',
      attachments: [attachment('existing', '[PHOTO image.png]')],
      files: orderedFiles,
      selection: null,
      kindForFile: classifyAttachmentKind,
      buildClientId: () => {
        nextId += 1;
        return `drop-${nextId}`;
      },
    });

    expect(result.draft.prompt).toBe(
      'prompt [PHOTO image.png (2)] [FILE notes.txt] ',
    );
    expect(result.draft.attachments.slice(1).map((entry) => entry.kind)).toEqual([
      'photo',
      'file',
    ]);
    expect(result.insertedAttachmentIds).toEqual(['drop-1', 'drop-2']);
  });
});
