import { translate, useI18n } from '../../i18n';
import {
  useLayoutEffect,
  type MutableRefObject,
  type RefObject,
} from 'react';

import {
  attachmentDisplayLabel,
  basenameFromAttachmentPath,
  type PromptSegment,
  type PromptSelectionRange,
} from './composerUtils';
import { FILE_GLYPH_SVG, fileBadge, fileFamily, shortFileName } from '../attachments/attachmentFiles';
import { restoreSelectionAfterInsertedAttachments } from './contentEditablePrompt';

interface UseComposerPromptDomSyncInput {
  promptRef: RefObject<HTMLDivElement | null>;
  isShellView: boolean;
  prompt: string;
  promptSegments: PromptSegment[];
  attachmentPreviewUrls: Record<string, string>;
  previewSignature: string;
  pendingSelectionRef: MutableRefObject<PromptSelectionRange | null>;
  pendingInsertedAttachmentIdsRef: MutableRefObject<string[]>;
  selectionSnapshotRef: MutableRefObject<PromptSelectionRange | null>;
  renderedPreviewSignatureRef: MutableRefObject<string>;
  serializeEditorPrompt: () => string;
  restoreSelection: (selection: PromptSelectionRange | null) => void;
}

// The same tile as a sent prompt's attachment: a glyph (or a photo's thumbnail)
// over its shortened name. Tapping it opens its card (see ComposerPromptEditor),
// which reads the details kept on the token.
function createPromptAttachmentToken(
  segment: Extract<PromptSegment, { type: 'attachment' }>,
  attachmentPreviewUrls: Record<string, string>,
) {
  const { attachment } = segment;
  const name = basenameFromAttachmentPath(attachment.originalName || attachmentDisplayLabel(attachment)) || attachmentDisplayLabel(attachment);
  const family = fileFamily(name, attachment.kind, attachment.file?.type);
  const token = document.createElement('span');
  token.dataset.segmentType = 'attachment';
  token.dataset.clientId = attachment.clientId;
  token.dataset.placeholder = attachment.placeholder;
  token.dataset.family = family;
  token.dataset.kind = attachment.kind;
  token.dataset.name = name;
  if (attachment.file) token.dataset.size = String(attachment.file.size);
  token.contentEditable = 'false';
  token.className = 'attachment-tile';
  token.setAttribute('role', 'button');
  token.setAttribute('aria-label', translate('chat.attachmentDetails', { name }));
  token.title = name;
  token.tabIndex = 0;

  const icon = document.createElement('span');
  icon.className = 'attachment-tile-icon';
  const previewUrl = attachment.kind === 'photo' ? attachmentPreviewUrls[attachment.clientId] : undefined;
  if (previewUrl) {
    const image = document.createElement('img');
    image.src = previewUrl;
    image.alt = '';
    image.draggable = false;
    icon.append(image);
  } else {
    const glyph = document.createElement('span');
    glyph.className = 'attachment-tile-glyph';
    glyph.innerHTML = FILE_GLYPH_SVG;
    icon.append(glyph);
    const badge = fileBadge(name);
    if (badge) {
      const mark = document.createElement('b');
      mark.textContent = badge;
      icon.append(mark);
    }
  }
  const label = document.createElement('span');
  label.className = 'attachment-tile-name';
  label.textContent = shortFileName(name);
  token.append(icon, label);
  return token;
}

function buildPromptFragment(
  promptSegments: PromptSegment[],
  attachmentPreviewUrls: Record<string, string>,
) {
  const fragment = document.createDocumentFragment();

  for (const segment of promptSegments) {
    if (segment.type === 'text') {
      fragment.append(
        document.createTextNode(segment.text === ' ' ? '\u00a0' : segment.text),
      );
      continue;
    }

    fragment.append(createPromptAttachmentToken(segment, attachmentPreviewUrls));
  }

  return fragment;
}

export function useComposerPromptDomSync({
  promptRef,
  isShellView,
  prompt,
  promptSegments,
  attachmentPreviewUrls,
  previewSignature,
  pendingSelectionRef,
  pendingInsertedAttachmentIdsRef,
  selectionSnapshotRef,
  renderedPreviewSignatureRef,
  serializeEditorPrompt,
  restoreSelection,
}: UseComposerPromptDomSyncInput) {
  useI18n();
  useLayoutEffect(() => {
    const editor = promptRef.current;
    if (!editor || isShellView || editor.dataset.imeComposing === 'true') {
      return;
    }

    const pendingSelection = pendingSelectionRef.current;
    const shouldSyncDom = serializeEditorPrompt() !== prompt;

    if (shouldSyncDom) {
      editor.replaceChildren(
        buildPromptFragment(promptSegments, attachmentPreviewUrls),
      );
    } else if (renderedPreviewSignatureRef.current !== previewSignature) {
      // A thumbnail becoming available must not replace the text nodes tracked
      // by native dictation/autocorrection, or disturb its live selection.
      const attachments = new Map(promptSegments.flatMap(segment =>
        segment.type === 'attachment' ? [[segment.attachment.clientId, segment] as const] : [],
      ));
      for (const token of editor.querySelectorAll<HTMLElement>('[data-segment-type="attachment"]')) {
        const segment = attachments.get(token.dataset.clientId ?? '');
        if (segment) token.replaceWith(createPromptAttachmentToken(segment, attachmentPreviewUrls));
      }
    }
    renderedPreviewSignatureRef.current = previewSignature;

    if (pendingSelection !== null) {
      editor.focus();
      if (
        !restoreSelectionAfterInsertedAttachments(
          editor,
          pendingInsertedAttachmentIdsRef.current,
        )
      ) {
        restoreSelection(pendingSelection);
      }
      selectionSnapshotRef.current = pendingSelection;
    } else if (document.activeElement === editor && shouldSyncDom) {
      restoreSelection(selectionSnapshotRef.current);
    }

    pendingSelectionRef.current = null;
    pendingInsertedAttachmentIdsRef.current = [];
  }, [
    attachmentPreviewUrls,
    isShellView,
    previewSignature,
    prompt,
    promptRef,
    promptSegments,
    pendingInsertedAttachmentIdsRef,
    pendingSelectionRef,
    renderedPreviewSignatureRef,
    restoreSelection,
    selectionSnapshotRef,
    serializeEditorPrompt,
  ]);
}
