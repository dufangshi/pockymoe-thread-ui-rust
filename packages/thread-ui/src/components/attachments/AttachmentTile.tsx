import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { translate, useI18n } from '../../i18n';
import { FolderOpen, Maximize2 } from 'lucide-react';
import { GraphWorkspaceImageLightbox } from '../ZoomableImage';
import { shellThemeProps } from '../themeHooks';
import { PathChip } from '../copy/PathChip';
import { FILE_GLYPH_SVG, fileBadge, fileFamily, fileKindLabel, formatFileSize, shortFileName, type FileFamily } from './attachmentFiles';

/** The face of an attachment: a file glyph in its family's color with its
    extension (or a photo's thumbnail) over its shortened name. */
export function AttachmentFace({ name, family, thumbnail }: { name: string; family: FileFamily; thumbnail?: string | null | undefined }) {
  const badge = fileBadge(name);
  return <>
    <span className="attachment-tile-icon">
      {thumbnail
        ? <img src={thumbnail} alt="" draggable={false} loading="lazy" />
        : <><span className="attachment-tile-glyph" dangerouslySetInnerHTML={{ __html: FILE_GLYPH_SVG }} />{badge ? <b>{badge}</b> : null}</>}
    </span>
    <span className="attachment-tile-name">{shortFileName(name)}</span>
  </>;
}

/** What a tapped attachment says about itself, with what can be done with it: a
    photo leads with its preview (tap it for full size), a file with its glyph. */
export function AttachmentCard({ name, family, size, path, thumbnail, onView, actions }: {
  name: string;
  family: FileFamily;
  size?: number | undefined;
  path?: string | undefined;
  thumbnail?: string | null | undefined;
  onView?: (() => void) | undefined;
  actions?: ReactNode;
}) {
  useI18n();
  const info = (
    <div className="attachment-card-info">
      <strong title={name}>{name}</strong>
      <span>{[fileKindLabel(name, family), size !== undefined ? formatFileSize(size) : null].filter(Boolean).join(' · ')}</span>
      {path && path !== name ? <PathChip path={path} className="attachment-card-path" /> : null}
    </div>
  );
  return (
    <div className="attachment-card" data-family={family}>
      {thumbnail ? <>
        {onView
          ? <button type="button" className="attachment-card-preview" aria-label={translate('chat.attachmentView')} onClick={onView}><img src={thumbnail} alt="" draggable={false} /></button>
          : <span className="attachment-card-preview"><img src={thumbnail} alt="" draggable={false} /></span>}
        {info}
      </> : (
        <div className="attachment-card-head">
          <span className="attachment-tile-icon">
            <span className="attachment-tile-glyph" dangerouslySetInnerHTML={{ __html: FILE_GLYPH_SVG }} />{fileBadge(name) ? <b>{fileBadge(name)}</b> : null}
          </span>
          {info}
        </div>
      )}
      {actions ? <div className="attachment-card-actions">{actions}</div> : null}
    </div>
  );
}

/** The card's "View full size" action. */
export const ViewAction = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="is-primary" onClick={onClick}><Maximize2 aria-hidden="true" />{translate('chat.attachmentView')}</button>
);

/** A small card floating by an anchor (below it, or above where there is no room).
    It follows the anchor as the page scrolls or the composer grows; a press
    outside, Escape, or the anchor leaving the screen closes it. */
export function FloatingCard({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    let frame = 0;
    const position = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!anchor.isConnected) { close.current(); return; }
        const box = anchor.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) { close.current(); return; }
        const own = card.current?.getBoundingClientRect();
        const width = own?.width ?? 260, height = own?.height ?? 120;
        const below = box.bottom + 6 + height <= window.innerHeight - 8;
        setPlace({
          left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
          top: below ? box.bottom + 6 : Math.max(8, box.top - 6 - height),
        });
      });
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(document.body);
    if (card.current) observer?.observe(card.current);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [anchor]);
  // The card's first action takes focus, so Tab continues inside it.
  useEffect(() => { card.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!card.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) close.current();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close.current(); anchor.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor]);
  const { themeClass, ...theme } = shellThemeProps(anchor);
  return createPortal(
    <div ref={card} role="dialog" aria-modal="false" className={`thread-ui-shell attachment-float ${themeClass}`} {...theme}
      style={{ left: place?.left ?? -9999, top: place?.top ?? -9999 }}>
      {children}
    </div>,
    document.body,
  );
}

/** A photo or file in a sent prompt: a tile that opens its card. */
export function MessageAttachment({ kind, path, name, thumbnailUrl, fullUrl, onOpenFile }: {
  kind: 'photo' | 'file';
  path: string;
  name: string;
  thumbnailUrl?: string | null | undefined;
  fullUrl?: string | undefined;
  onOpenFile?: ((input: { path: string }) => void) | undefined;
}) {
  useI18n();
  const tile = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const family = fileFamily(name, kind);
  const full = kind === 'photo' ? fullUrl ?? thumbnailUrl : null;
  const view = full ? () => { setOpen(false); setViewing(true); } : undefined;
  return (
    <>
      <button ref={tile} type="button" className="attachment-tile" data-family={family} data-kind={kind} aria-expanded={open}
        aria-label={translate('chat.attachmentDetails', { name })} title={name} onClick={() => setOpen(value => !value)}>
        <AttachmentFace name={name} family={family} thumbnail={kind === 'photo' ? thumbnailUrl : null} />
      </button>
      {open && tile.current ? (
        <FloatingCard anchor={tile.current} onClose={() => setOpen(false)}>
          <AttachmentCard name={name} family={family} path={path} thumbnail={kind === 'photo' ? thumbnailUrl : null} onView={view}
            actions={view || onOpenFile ? <>
              {view ? <ViewAction onClick={view} /> : null}
              {onOpenFile ? <button type="button" onClick={() => { setOpen(false); onOpenFile({ path }); }}><FolderOpen aria-hidden="true" />{translate('chat.attachmentOpenInFiles')}</button> : null}
            </> : null} />
        </FloatingCard>
      ) : null}
      {viewing && full ? <GraphWorkspaceImageLightbox src={full} alt={name} onClose={() => { setViewing(false); tile.current?.focus({ preventScroll: true }); }} /> : null}
    </>
  );
}
