// @vitest-environment jsdom
import { createRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { serializeEditorPrompt } from './contentEditablePrompt';
import { useComposerPromptDomSync } from './useComposerPromptDomSync';
import type { PromptSegment } from './composerUtils';

it('updates an asynchronous image preview without replacing dictation text or moving its selection', () => {
  const editor = document.createElement('div');
  editor.tabIndex = 0;
  editor.innerHTML = '<span style="color:inherit">dictated text</span><span data-segment-type="attachment" data-client-id="photo" data-placeholder="[PHOTO a.png]" contenteditable="false"></span> tail';
  document.body.append(editor);
  const dictated = editor.firstChild!.firstChild!;
  const editorRef = createRef<HTMLDivElement>();
  editorRef.current = editor;
  const segments: PromptSegment[] = [
    { type: 'text', key: 'before', text: 'dictated text' },
    { type: 'attachment', key: 'photo', attachment: { clientId: 'photo', placeholder: '[PHOTO a.png]', kind: 'photo', originalName: 'a.png', file: new File([], 'a.png') } },
    { type: 'text', key: 'after', text: ' tail' },
  ];
  const pending = { current: null };
  const inserted = { current: [] };
  const preview = { current: '' };
  function Harness({ url }: { url: string }) {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false,
      prompt: 'dictated text[PHOTO a.png] tail', promptSegments: segments,
      attachmentPreviewUrls: url ? { photo: url } : {}, previewSignature: url,
      pendingSelectionRef: pending, pendingInsertedAttachmentIdsRef: inserted,
      selectionSnapshotRef: pending, renderedPreviewSignatureRef: preview,
      serializeEditorPrompt: () => serializeEditorPrompt(editor), restoreSelection: () => { throw new Error('Native selection must not be restored'); },
      editorTextRef: { current: null }, adoptEditorText: () => {},
    });
    return null;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<Harness url="" />));
  editor.focus();
  const range = document.createRange();
  range.setStart(dictated, 3); range.collapse(true);
  window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
  flushSync(() => root.render(<Harness url="blob:preview" />));
  expect(editor.firstChild!.firstChild).toBe(dictated);
  expect(window.getSelection()?.anchorNode).toBe(dictated);
  expect(window.getSelection()?.anchorOffset).toBe(3);
  expect(editor.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
  expect(serializeEditorPrompt(editor)).toBe('dictated text[PHOTO a.png] tail');
  flushSync(() => root.unmount());
  editor.remove();
});

function mountSync(editor: HTMLDivElement, options: { editorText: string | null; adopt?: () => void; restore?: (selection: unknown) => void; snapshot?: { start: number; end: number } | null }) {
  const editorRef = createRef<HTMLDivElement>();
  editorRef.current = editor;
  const editorTextRef = { current: options.editorText };
  const snapshot = { current: options.snapshot ?? null };
  function Harness({ prompt }: { prompt: string }) {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false, prompt,
      promptSegments: prompt ? [{ type: 'text', key: 'text', text: prompt }] : [], attachmentPreviewUrls: {}, previewSignature: '',
      pendingSelectionRef: { current: null }, pendingInsertedAttachmentIdsRef: { current: [] },
      selectionSnapshotRef: snapshot, renderedPreviewSignatureRef: { current: '' },
      serializeEditorPrompt: () => serializeEditorPrompt(editor), restoreSelection: options.restore ?? (() => {}),
      editorTextRef, adoptEditorText: options.adopt ?? (() => {}),
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  return { render: (prompt: string) => flushSync(() => root.render(<Harness prompt={prompt} />)), unmount: () => { flushSync(() => root.unmount()); editor.remove(); }, editorTextRef };
}

it('leaves the editor alone when a keyboard has moved past the text the state came from', () => {
  // A voice keyboard wrote "raw words", the editor reported it, and the keyboard
  // is now deleting it to insert the tidied text: the state is one step behind.
  const editor = document.createElement('div');
  editor.tabIndex = 0;
  editor.textContent = 'earlier. raw wo';
  document.body.append(editor);
  editor.focus();
  const node = editor.firstChild!;
  const adopt = vi.fn();
  const sync = mountSync(editor, { editorText: 'earlier. raw words', adopt, restore: () => { throw new Error('The caret must stay where the keyboard has it'); } });
  sync.render('earlier. raw words');
  expect(editor.firstChild).toBe(node);
  expect(editor.textContent).toBe('earlier. raw wo');
  // The newer text is taken into the state instead.
  expect(adopt).toHaveBeenCalledTimes(1);
  sync.unmount();
});

it('still applies a change that did not come from the editor, and never leaves the caret at the start', () => {
  const editor = document.createElement('div');
  editor.tabIndex = 0;
  editor.textContent = 'typed text';
  document.body.append(editor);
  editor.focus();
  const restore = vi.fn();
  const sync = mountSync(editor, { editorText: 'typed text', restore });
  sync.render('typed text');
  expect(restore).not.toHaveBeenCalled();
  // Sent: the host clears the draft. That is not the editor's own text.
  sync.render('');
  expect(editor.textContent).toBe('');
  // A quote added from outside, with no caret position known: it goes to the end.
  sync.render('typed text and a quote');
  expect(editor.textContent).toBe('typed text and a quote');
  expect(restore).toHaveBeenLastCalledWith({ start: 22, end: 22 });
  expect(sync.editorTextRef.current).toBeNull();
  sync.unmount();
});

it('rebuilds an unfocused editor from the state even when the text came from it', () => {
  const editor = document.createElement('div');
  editor.textContent = 'stale';
  document.body.append(editor);
  const adopt = vi.fn();
  const sync = mountSync(editor, { editorText: 'current', adopt });
  sync.render('current');
  expect(editor.textContent).toBe('current');
  expect(adopt).not.toHaveBeenCalled();
  sync.unmount();
});
