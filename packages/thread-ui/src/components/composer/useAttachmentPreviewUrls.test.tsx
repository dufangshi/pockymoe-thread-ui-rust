/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComposerAttachmentDraft } from './composerUtils';
import {
  useAttachmentPreviewUrls,
  type AttachmentPreviewMap,
} from './useAttachmentPreviewUrls';

let latestPreviewUrls: AttachmentPreviewMap | null = null;

function makeAttachment(
  clientId: string,
  kind: 'photo' | 'file',
): ComposerAttachmentDraft {
  const extension = kind === 'photo' ? 'png' : 'txt';
  return {
    clientId,
    kind,
    originalName: `${clientId}.${extension}`,
    placeholder: `[${kind.toUpperCase()} ${clientId}.${extension}]`,
    file: new File(['content'], `${clientId}.${extension}`, {
      type: kind === 'photo' ? 'image/png' : 'text/plain',
    }),
  };
}

function HookHarness({
  attachments,
  isShellView,
}: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  latestPreviewUrls = useAttachmentPreviewUrls({ attachments, isShellView });
  return null;
}

function renderHookHarness(input: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<HookHarness {...input} />);
  });

  return {
    rerender(nextInput: {
      attachments: ComposerAttachmentDraft[];
      isShellView: boolean;
    }) {
      flushSync(() => {
        root.render(<HookHarness {...nextInput} />);
      });
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useAttachmentPreviewUrls', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let nextUrlId = 0;
    createObjectUrl = vi.fn(() => {
      nextUrlId += 1;
      return `blob:preview-${nextUrlId}`;
    });
    revokeObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    latestPreviewUrls = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestPreviewUrls = null;
    vi.restoreAllMocks();
  });

  it('creates preview URLs only for photo attachments and reuses cached URLs', async () => {
    const photo = makeAttachment('photo-a', 'photo');
    const file = makeAttachment('file-a', 'file');
    const harness = renderHookHarness({
      attachments: [photo, file],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledWith(photo.file);

    harness.rerender({
      attachments: [photo, file],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('revokes URLs for removed photos and on unmount', async () => {
    const firstPhoto = makeAttachment('photo-a', 'photo');
    const secondPhoto = makeAttachment('photo-b', 'photo');
    const harness = renderHookHarness({
      attachments: [firstPhoto, secondPhoto],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({
        'photo-a': 'blob:preview-1',
        'photo-b': 'blob:preview-2',
      });
    });

    harness.rerender({
      attachments: [secondPhoto],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-b': 'blob:preview-2' });
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1');

    harness.unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-2');
  });

  it('clears and revokes preview URLs while shell view is active', async () => {
    const photo = makeAttachment('photo-a', 'photo');
    const harness = renderHookHarness({
      attachments: [photo],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });

    harness.rerender({
      attachments: [photo],
      isShellView: true,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({});
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1');

    harness.rerender({
      attachments: [photo],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-2' });
    });
    harness.unmount();
  });
});
