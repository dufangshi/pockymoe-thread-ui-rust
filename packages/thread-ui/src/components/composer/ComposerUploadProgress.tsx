import { X } from 'lucide-react';
import { useRef } from 'react';
import { translate, useI18n } from '../../i18n';
import { formatFileSize } from '../attachments/attachmentFiles';
import { MiddleName } from '../copy/MiddleName';

/** A large attachment on its way to the device, before its prompt is sent. */
export interface ComposerUploadProgressState {
  name: string;
  loaded: number;
  total: number;
  /** The file's place among those of this prompt, from 1. */
  index: number;
  count: number;
  /** The connection dropped and it will continue by itself. */
  retrying?: boolean;
  /** The prompt that goes once the files are there, on one line, with each
      attachment named. The composer itself is empty meanwhile. */
  preview?: string;
}

function remaining(seconds: number) {
  if (seconds < 60) return translate('chat.uploadAboutSeconds', { value1: Math.max(1, Math.round(seconds)) });
  return translate('chat.uploadAboutMinutes', { value1: Math.round(seconds / 60) });
}

export function ComposerUploadProgress({ progress, onCancel }: {
  progress: ComposerUploadProgressState;
  onCancel?: (() => void) | undefined;
}) {
  useI18n();
  const { name, loaded, total, index, count, retrying, preview } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
  // The rate since this file started, for "about N minutes" once it is known.
  const started = useRef<{ name: string; at: number; loaded: number } | null>(null);
  if (!started.current || started.current.name !== name) started.current = { name, at: Date.now(), loaded };
  const elapsed = (Date.now() - started.current.at) / 1000;
  const rate = elapsed > 2 ? (loaded - started.current.loaded) / elapsed : 0;
  // Every figure says what it counts (no bare "2/2").
  const parts = [
    count > 1 ? translate('chat.uploadFileOf', { value1: index, value2: count }) : null,
    retrying
      ? translate('chat.uploadReconnecting')
      : loaded === 0
        ? translate('chat.uploadStarting')
        : `${formatFileSize(loaded)} / ${formatFileSize(total)} · ${percent}%`,
    !retrying && rate > 0 && loaded < total ? remaining((total - loaded) / rate) : null,
  ].filter(Boolean);
  return (
    <div className="thread-composer-upload" data-retrying={retrying || undefined}>
      {preview ? (
        <p className="thread-composer-upload-preview">
          <span>{translate('chat.uploadWaitingToSend')}</span>
          {preview}
        </p>
      ) : null}
      <div className="thread-composer-upload-line">
        <MiddleName name={name} className="thread-composer-upload-name" />
        <small>{parts.join(' · ')}</small>
        {onCancel ? (
          <button type="button" className="thread-composer-upload-cancel" onClick={onCancel}
            aria-label={translate('chat.uploadCancel', { value1: name })} title={translate('chat.uploadCancel', { value1: name })}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div role="progressbar" aria-label={translate('chat.uploadProgress', { value1: name })}
        aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(loaded, total)}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
