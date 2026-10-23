import { translate, useI18n } from '../../i18n';
import type {
  CollaborationModeDto,
  ModelOptionDto,
  PromptAttachmentKindDto,
  ReasoningEffortDto,
  ThreadContextUsageDto,
} from '@pockymoe/shared';
import { themeAgentKey } from '../themeAgent';
import { clipQuote, composeQuotedPrompt, QUOTE_TOKEN, quotePlaceholder, type PromptQuote } from './promptQuotes';

export type ComposerFileAttachmentDraft = {
  clientId: string;
  kind: PromptAttachmentKindDto;
  originalName: string;
  placeholder: string;
  file: File;
};
/** A passage of an earlier message, shown as a tile where it is referred to. */
export type ComposerQuoteDraft = {
  clientId: string;
  kind: 'quote';
  originalName: string;
  placeholder: string;
  quote: PromptQuote;
  file?: undefined;
};
export type ComposerAttachmentDraft = ComposerFileAttachmentDraft | ComposerQuoteDraft;
export const isQuoteDraft = (attachment: ComposerAttachmentDraft): attachment is ComposerQuoteDraft => attachment.kind === 'quote';

export interface PromptTextSegment {
  type: 'text';
  key: string;
  text: string;
}

export interface PromptAttachmentSegment {
  type: 'attachment';
  key: string;
  attachment: ComposerAttachmentDraft;
}

export type PromptSegment = PromptTextSegment | PromptAttachmentSegment;

export type ComposerDraft = {
  prompt: string;
  attachments: ComposerAttachmentDraft[];
};

export type ComposerSubmitInput = {
  prompt: string;
  /** Files only: quotes are written into the prompt. */
  attachments?: ComposerFileAttachmentDraft[];
};

export type PromptPasteAction =
  | { type: 'ignore'; preventDefault: false }
  | { type: 'insert-text'; preventDefault: true; text: string }
  | { type: 'append-files'; preventDefault: true; files: File[] };

export type PromptFileTransferAction =
  | { type: 'ignore'; preventDefault: false; activateDragTarget: false }
  | {
      type: 'accept-files';
      preventDefault: true;
      activateDragTarget: true;
      files?: File[];
    };

export type ComposerSendShortcut = 'ctrlEnter' | 'enter';

export type PromptKeyDownAction = {
  preventDefault: boolean;
  submit: boolean;
  steer?: true;
};

export type ComposerSettingsUpdateDecision = {
  optimisticMode: CollaborationModeDto | null;
  rollbackMode: CollaborationModeDto | null;
  shouldRollbackMode: boolean;
  closeMenuOnSuccess: boolean;
};

export interface PromptSelectionRange {
  start: number;
  end: number;
}

export function normalizePromptText(value: string) {
  return value.replace(/\u00a0/g, ' ');
}

export function tokenizePrompt(
  prompt: string,
  attachments: ComposerAttachmentDraft[],
): PromptSegment[] {
  if (!prompt) {
    return [];
  }

  const segments: PromptSegment[] = [];
  const placeholders = [...attachments].sort(
    (left, right) => right.placeholder.length - left.placeholder.length,
  );
  let cursor = 0;
  let textIndex = 0;

  while (cursor < prompt.length) {
    const matchingAttachment = placeholders.find((attachment) =>
      prompt.startsWith(attachment.placeholder, cursor),
    );

    if (matchingAttachment) {
      segments.push({
        type: 'attachment',
        key: `${matchingAttachment.clientId}-${cursor}`,
        attachment: matchingAttachment,
      });
      cursor += matchingAttachment.placeholder.length;
      continue;
    }

    let nextTokenIndex = prompt.length;
    for (const attachment of placeholders) {
      const candidateIndex = prompt.indexOf(attachment.placeholder, cursor);
      if (candidateIndex !== -1 && candidateIndex < nextTokenIndex) {
        nextTokenIndex = candidateIndex;
      }
    }

    const text = prompt.slice(cursor, nextTokenIndex);
    if (text) {
      segments.push({
        type: 'text',
        key: `text-${textIndex}`,
        text,
      });
      textIndex += 1;
    }
    cursor = nextTokenIndex;
  }

  return segments;
}

export function buildAttachmentPlaceholder(
  kind: PromptAttachmentKindDto,
  name: string,
  usedPlaceholders: Set<string>,
) {
  const token = kind === 'photo' ? 'PHOTO' : 'FILE';
  let suffix = 0;

  while (true) {
    const label = suffix === 0 ? name : `${name} (${suffix + 1})`;
    const placeholder = `[${token} ${label}]`;
    if (!usedPlaceholders.has(placeholder)) {
      return placeholder;
    }
    suffix += 1;
  }
}

export function buildAttachmentInsertionText(
  basePrompt: string,
  insertionPoint: { start: number; end: number },
  placeholders: string[],
) {
  const beforeChar =
    insertionPoint.start > 0 ? basePrompt[insertionPoint.start - 1] : '';
  const afterChar =
    insertionPoint.end < basePrompt.length
      ? basePrompt[insertionPoint.end]
      : '';
  const needsLeadingSpace = Boolean(beforeChar && !/\s/.test(beforeChar));
  const needsTrailingSpace = !afterChar || !/\s/.test(afterChar);
  return `${needsLeadingSpace ? ' ' : ''}${placeholders.join(' ')}${needsTrailingSpace ? ' ' : ''}`;
}

export function buildComposerAttachmentDrafts({
  files,
  kindForFile,
  usedPlaceholders,
  buildClientId,
}: {
  files: File[];
  kindForFile: (file: File) => PromptAttachmentKindDto;
  usedPlaceholders: Set<string>;
  buildClientId: () => string;
}) {
  return files.map((file) => {
    const kind = kindForFile(file);
    const originalName = normalizedAttachmentFileName(file, kind);
    const placeholder = buildAttachmentPlaceholder(
      kind,
      normalizeAttachmentLabel(originalName),
      usedPlaceholders,
    );
    usedPlaceholders.add(placeholder);
    return {
      clientId: buildClientId(),
      kind,
      originalName,
      placeholder,
      file,
    };
  });
}

export function buildAttachmentInsertionDraft({
  prompt,
  attachments,
  files,
  selection,
  kindForFile,
  buildClientId,
}: {
  prompt: string;
  attachments: ComposerAttachmentDraft[];
  files: File[];
  selection: PromptSelectionRange | null;
  kindForFile: (file: File) => PromptAttachmentKindDto;
  buildClientId: () => string;
}) {
  const usedPlaceholders = new Set<string>(
    attachments.map((entry) => entry.placeholder),
  );
  const nextAttachments = buildComposerAttachmentDrafts({
    files,
    kindForFile,
    usedPlaceholders,
    buildClientId,
  });
  const insertionPoint = selection
    ? { start: selection.start, end: selection.end }
    : { start: prompt.length, end: prompt.length };
  const insertionText = buildAttachmentInsertionText(
    prompt,
    insertionPoint,
    nextAttachments.map((entry) => entry.placeholder),
  );
  const nextPrompt = `${prompt.slice(0, insertionPoint.start)}${insertionText}${prompt.slice(
    insertionPoint.end,
  )}`;
  const trailingSpacerOffset = insertionText.endsWith(' ') ? 1 : 0;
  const nextCaret =
    insertionPoint.start + insertionText.length - trailingSpacerOffset;

  return {
    draft: {
      prompt: nextPrompt,
      attachments: [...attachments, ...nextAttachments],
    },
    selection: {
      start: nextCaret,
      end: nextCaret,
    },
    insertedAttachmentIds: nextAttachments.map(
      (attachment) => attachment.clientId,
    ),
  };
}

export function buildComposerSubmitInput({
  prompt,
  attachments,
  isShellView,
}: {
  prompt: string;
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}): ComposerSubmitInput | null {
  if (isShellView) {
    return { prompt };
  }

  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    return null;
  }

  const activeAttachments = attachments.filter((attachment) =>
    normalizedPrompt.includes(attachment.placeholder),
  );
  const files = activeAttachments.filter((attachment): attachment is ComposerFileAttachmentDraft => !isQuoteDraft(attachment));
  const quotes = new Map(activeAttachments.filter(isQuoteDraft).map((attachment) => [attachment.placeholder, attachment.quote] as const));
  const quotedPrompt = quotes.size ? composeQuotedPrompt(normalizedPrompt, quotes) : normalizedPrompt;
  return files.length > 0
    ? { prompt: quotedPrompt, attachments: files }
    : { prompt: quotedPrompt };
}

/**
 * The draft with a quote added at its end, after a space when the text before
 * it does not end in one, and a space after it to type on. Where the caret was
 * does not matter: the composer may be folded or not focused at all.
 */
export function buildQuoteInsertionDraft(draft: ComposerDraft, quote: PromptQuote, clientId: string) {
  const used = new Set(draft.attachments.map((attachment) => attachment.placeholder));
  for (const match of draft.prompt.matchAll(QUOTE_TOKEN)) used.add(match[0]);
  let n = 1;
  while (used.has(quotePlaceholder(n))) n += 1;
  const placeholder = quotePlaceholder(n);
  const text = draft.prompt.replace(/[ \t]+$/, '');
  const prefix = text && !/\s$/.test(text) ? ' ' : '';
  const prompt = `${text}${prefix}${placeholder} `;
  const attachment: ComposerQuoteDraft = { clientId, kind: 'quote', originalName: `❝${n}`, placeholder, quote: { ...quote, text: clipQuote(quote.text) } };
  return { draft: { prompt, attachments: [...draft.attachments, attachment] }, caret: prompt.length };
}

export function derivePromptPasteAction({
  files,
  plainText,
  htmlText,
  htmlToText,
}: {
  files: File[];
  plainText: string;
  htmlText: string;
  htmlToText: (value: string) => string;
}): PromptPasteAction {
  if (files.length > 0) {
    return { type: 'append-files', preventDefault: true, files };
  }

  const text = plainText || htmlToText(htmlText);
  if (!text && !htmlText) {
    return { type: 'ignore', preventDefault: false };
  }

  return { type: 'insert-text', preventDefault: true, text };
}

export function derivePromptFileDragAction(
  hasFiles: boolean,
): PromptFileTransferAction {
  return hasFiles
    ? {
        type: 'accept-files',
        preventDefault: true,
        activateDragTarget: true,
      }
    : { type: 'ignore', preventDefault: false, activateDragTarget: false };
}

export function derivePromptDropAction(files: File[]): PromptFileTransferAction {
  return files.length > 0
    ? {
        type: 'accept-files',
        preventDefault: true,
        activateDragTarget: true,
        files,
      }
    : { type: 'ignore', preventDefault: false, activateDragTarget: false };
}

export function derivePromptKeyDownAction({
  key,
  metaKey,
  ctrlKey,
  shiftKey = false,
  altKey = false,
  sendShortcut = 'ctrlEnter',
  busy,
  disabled,
}: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  sendShortcut?: ComposerSendShortcut;
  busy: boolean;
  disabled: boolean;
}): PromptKeyDownAction {
  const modifier = metaKey || ctrlKey;
  const steer = modifier && (sendShortcut === 'enter' ? !shiftKey : shiftKey);
  const send = sendShortcut === 'enter'
    ? !modifier && !shiftKey
    : modifier && !shiftKey;
  const isSubmitShortcut = key === 'Enter' && !altKey && (send || steer);
  return {
    preventDefault: isSubmitShortcut,
    submit: isSubmitShortcut && !busy && !disabled,
    ...(isSubmitShortcut && steer ? { steer: true } : {}),
  };
}

export function deriveComposerSettingsUpdateDecision({
  nextMode,
  previousOptimisticMode,
  changed = [],
}: {
  nextMode: CollaborationModeDto | null | undefined;
  previousOptimisticMode: CollaborationModeDto | null;
  /** The settings this update changes. */
  changed?: readonly string[];
}): ComposerSettingsUpdateDecision {
  return {
    optimisticMode: nextMode ?? null,
    rollbackMode: nextMode ? previousOptimisticMode : null,
    shouldRollbackMode: Boolean(nextMode),
    // A model and its reasoning effort are chosen together: the menu stays
    // open after either, so the other can follow.
    closeMenuOnSuccess: !(changed.length > 0 && changed.every((key) => key === 'model' || key === 'reasoningEffort')),
  };
}

export function draftSignature(draft: ComposerDraft) {
  return `${draft.prompt}\u001f${draft.attachments
    .map(
      (attachment) =>
        `${attachment.clientId}\u001e${attachment.kind}\u001e${attachment.placeholder}\u001e${attachment.originalName}`,
    )
    .join('\u001d')}`;
}

export function formatReasoningEffortLabel(
  value: ReasoningEffortDto | null | undefined,
) {
  if (!value) {
    return translate("chat.auto");
  }

  switch (value) {
    case 'xhigh':
      return 'xhigh';
    default:
      return value;
  }
}

/** The `data-agent` key a theme uses for the harness avatar ("Claude Code" -> "claude"). */
export function composerAgentKey(label: string | null | undefined) {
  return themeAgentKey(label);
}

export function parseGoalTokenBudgetThousands(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const thousands = Number(normalized);
  if (!Number.isFinite(thousands) || thousands <= 0) {
    return Number.NaN;
  }

  return Math.round(thousands * 1000);
}

export function formatGoalTokenBudgetThousands(value: number | null | undefined) {
  if (!value) {
    return '';
  }

  const thousands = value / 1000;
  return Number.isInteger(thousands)
    ? String(thousands)
    : String(Number(thousands.toFixed(1)));
}

export function normalizeTomlContent(value: string) {
  return value.replace(/\r\n/g, '\n');
}

export function parseMcpServerName(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function parseMcpServerNameFromBlock(value: string) {
  const lines = normalizeTomlContent(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines.find((line) => /^\[mcp_servers\.[^\]]+\]$/.test(line));
  if (!header) {
    return null;
  }

  const match = header.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)\]$/);
  return match?.[1] ?? null;
}

export function renderHttpMcpBlock(name: string, url: string) {
  return `[mcp_servers.${name}]\nurl = ${JSON.stringify(url.trim())}\n`;
}

export function upsertMcpServerBlock(
  configContent: string,
  serverName: string,
  blockContent: string,
) {
  const normalizedConfig = normalizeTomlContent(configContent);
  const trimmedBlock = `${normalizeTomlContent(blockContent).trim()}\n`;
  const lines = normalizedConfig.split('\n');
  const exactHeader = `[mcp_servers.${serverName}]`;
  const nestedPrefix = `[mcp_servers.${serverName}.`;

  let start = -1;
  let end = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? '';
    if (trimmed === exactHeader) {
      start = index;
      break;
    }
  }

  if (start >= 0) {
    for (let index = start + 1; index < lines.length; index += 1) {
      const trimmed = lines[index]?.trim() ?? '';
      if (!trimmed.startsWith('[')) {
        continue;
      }
      if (trimmed === exactHeader || trimmed.startsWith(nestedPrefix)) {
        continue;
      }
      end = index;
      break;
    }

    const before = lines.slice(0, start).join('\n').trimEnd();
    const after = lines.slice(end).join('\n').trim();
    return [before, trimmedBlock.trimEnd(), after]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .concat('\n');
  }

  const base = normalizedConfig.trimEnd();
  return base ? `${base}\n\n${trimmedBlock}` : trimmedBlock;
}

export function clampPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatContextTokenKilocount(value: number) {
  const thousands = value / 1000;
  return Number.isInteger(thousands)
    ? `${thousands}k`
    : `${Number(thousands.toFixed(1))}k`;
}

export function formatModelContextTitle(
  model: string | null | undefined,
  contextUsage: ThreadContextUsageDto | null | undefined,
) {
  if (!model) {
    return translate("chat.selectModel");
  }

  if (
    contextUsage?.availability !== 'available' ||
    typeof contextUsage.tokensInContextWindow !== 'number' ||
    typeof contextUsage.modelContextWindow !== 'number'
  ) {
    return translate("chat.contextUnavailable", { value1: model });
  }

  const usedTokens = Math.max(contextUsage.tokensInContextWindow, 0);
  const contextTokens = Math.max(contextUsage.modelContextWindow, 0);
  const remainingTokens = Math.max(contextTokens - usedTokens, 0);

  return [
    model,
    translate("chat.contextUsedSummary", { used: formatContextTokenKilocount(usedTokens), total: formatContextTokenKilocount(contextTokens) }),
    translate("chat.contextRemainingSummary", { remaining: formatContextTokenKilocount(remainingTokens) }),
    translate("chat.contextLeft", { value1: clampPercent(contextUsage.remainingPercent) }),
  ].join(' · ');
}

export function normalizedAttachmentFileName(
  file: File,
  kind: PromptAttachmentKindDto,
) {
  const trimmed = file.name.trim();
  if (trimmed) {
    return trimmed;
  }

  const fallbackExtension =
    kind === 'photo'
      ? file.type.includes('png')
        ? '.png'
        : file.type.includes('heic')
          ? '.heic'
          : file.type.includes('heif')
            ? '.heif'
            : file.type.includes('webp')
              ? '.webp'
              : '.jpg'
      : '';
  return `${kind === 'photo' ? 'photo' : 'file'}-${Date.now()}${fallbackExtension}`;
}

export function normalizeAttachmentLabel(name: string) {
  const sanitized = name
    .replace(/[\r\n[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || 'attachment';
}

export function classifyAttachmentKind(file: File): PromptAttachmentKindDto {
  return file.type.startsWith('image/') ? 'photo' : 'file';
}

export function extractFilesFromTransfer(
  items: DataTransferItemList | null | undefined,
  files: FileList | null | undefined,
) {
  const extractedFiles: File[] = [];

  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') {
        continue;
      }
      const file = item.getAsFile();
      if (file) {
        extractedFiles.push(file);
      }
    }
  }

  if (extractedFiles.length > 0) {
    return extractedFiles;
  }

  if (files) {
    return Array.from(files);
  }

  return [];
}

export function hasTransferFiles(
  items: DataTransferItemList | null | undefined,
  files: FileList | null | undefined,
) {
  return extractFilesFromTransfer(items, files).length > 0;
}

export function segmentNodeText(child: ChildNode) {
  if (
    child instanceof HTMLElement &&
    child.dataset.segmentType === 'attachment' &&
    child.dataset.placeholder
  ) {
    return child.dataset.placeholder;
  }

  return child.textContent ?? '';
}

export function basenameFromAttachmentPath(value: string) {
  const normalized = value.replace(/[\\/]+$/, '').trim();
  if (!normalized) {
    return '';
  }
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? normalized;
}

export function attachmentDisplayLabel(attachment: ComposerAttachmentDraft) {
  if (isQuoteDraft(attachment)) return attachment.originalName;
  const placeholderMatch = attachment.placeholder.match(
    /^\[(?:PHOTO|FILE)\s+(.+)\]$/,
  );
  if (placeholderMatch?.[1]) {
    return placeholderMatch[1];
  }

  return basenameFromAttachmentPath(attachment.originalName);
}

export function modelSupportsReasoningEffort(
  model: ModelOptionDto | null | undefined,
  effort: ReasoningEffortDto,
) {
  return Boolean(
    model?.supportedReasoningEfforts.some(
      (entry) => entry.reasoningEffort === effort,
    ),
  );
}

/** Reasoning levels in their semantic order, each with its colour: cool for
    light thinking, warm to hot for heavy. The slider and the label under the
    model name share it. */
export const REASONING_EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const REASONING_EFFORT_COLORS = ['#3d8bff', '#2f7cf6', '#0fb5c8', '#16b364', '#f5b000', '#ff7a1a', '#f43f7a', '#9b5cff'];
/** An unknown level takes its place on the same scale by position, when known. */
export function reasoningEffortColor(effort: string | null | undefined, index = 0, count = 1) {
  const known = REASONING_EFFORT_ORDER.indexOf(effort ?? '');
  const at = known >= 0 ? known : Math.round((index / Math.max(1, count - 1)) * (REASONING_EFFORT_COLORS.length - 1));
  return REASONING_EFFORT_COLORS[at]!;
}
