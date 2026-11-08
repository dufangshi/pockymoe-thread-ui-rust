import { X } from 'lucide-react';
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
}

export function ComposerUploadProgress({ progress, onCancel }: {
  progress: ComposerUploadProgressState;
  onCancel?: (() => void) | undefined;
}) {
  useI18n();
  const { name, loaded, total, index, count, retrying } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
  return (
    <div className="thread-composer-upload" data-retrying={retrying || undefined}>
      <div className="thread-composer-upload-line">
        <MiddleName name={name} className="thread-composer-upload-name" />
        <small>
          {count > 1 ? `${index}/${count} · ` : ''}
          {retrying ? translate('chat.uploadReconnecting') : `${formatFileSize(loaded)} / ${formatFileSize(total)} · ${percent}%`}
        </small>
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
