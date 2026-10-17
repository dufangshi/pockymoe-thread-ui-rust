import { translate, useI18n } from '../i18n';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './menu/useModalFocus';
import { useImageViewport } from './useImageViewport';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';

export const MarkdownImageLinkContext = createContext(false);

const IMAGE_LIGHTBOX_MIN_SCALE = 0.5;
const IMAGE_LIGHTBOX_MAX_SCALE = 5;
const IMAGE_LIGHTBOX_SCALE_STEP = 0.25;

export function GraphWorkspaceImageLightbox({
  alt,
  backgroundColor,
  onClose,
  src,
}: {
  alt: string;
  backgroundColor?: string;
  onClose: () => void;
  src: string;
}) {
  const { locale: i18nLocale } = useI18n();
  const { viewportRef, scale, dragging, transform, reset: resetView, updateScale, handlers, moved } = useImageViewport();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const backdropPointer = useRef(true);
  const windowRef = useRef<HTMLDivElement | null>(null);
  // Focus starts on close and stays in the viewer; Esc closes; focus returns to the image.
  useModalFocus(windowRef, true, onClose, '.thread-graph-image-lightbox-close');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      ref={windowRef}
      className="thread-graph-image-lightbox"
      style={backgroundColor ? { backgroundColor } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={translate("files.imagePreview", { value1: alt || translate("files.workspaceImage") })}
    >
      <div
        className="thread-graph-image-lightbox-toolbar"
        role="toolbar"
        aria-label={translate("files.imageZoomControls")}
      >
        <button
          type="button"
          onClick={() => updateScale(scale - IMAGE_LIGHTBOX_SCALE_STEP)}
          disabled={scale <= IMAGE_LIGHTBOX_MIN_SCALE}
          title={translate("files.zoomOut")}
          aria-label={translate("files.zoomOut")}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="thread-graph-image-lightbox-scale"
          title={translate("files.resetZoom")}
          aria-label={translate("files.resetZoomCurrently", { value1: Math.round(scale * 100) })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{Math.round(scale * 100)}%</span>
        </button>
        <button
          type="button"
          onClick={() => updateScale(scale + IMAGE_LIGHTBOX_SCALE_STEP)}
          disabled={scale >= IMAGE_LIGHTBOX_MAX_SCALE}
          title={translate("files.zoomIn")}
          aria-label={translate("files.zoomIn")}
        >
          <Plus className="h-4 w-4" />
        </button>
        <span
          className="thread-graph-image-lightbox-divider"
          aria-hidden="true"
        />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          title={translate("files.closeImagePreview")}
          aria-label={translate("files.closeImagePreview")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={viewportRef}
        className="thread-graph-image-lightbox-viewport"
        onClick={(event) => {
          if (event.target === event.currentTarget && backdropPointer.current && !moved.current) {
            onClose();
          }
        }}
        {...handlers}
        onPointerDown={event => {
          backdropPointer.current = event.target === event.currentTarget;
          handlers.onPointerDown(event);
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={dragging ? 'is-dragging' : ''}
          style={{
            transform: transform,
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

export function ZoomableImage({
  alt,
  className,
  fullSrc,
  loading,
  src,
  width,
  height,
}: {
  alt: string;
  className?: string;
  /** Loaded only when the lightbox opens, e.g. the original of a thumbnail. */
  fullSrc?: string | undefined;
  width?: string | number;
  height?: string | number;
  loading?: 'eager' | 'lazy';
  src: string;
}) {
  const { locale: i18nLocale } = useI18n();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const insideLink = useContext(MarkdownImageLinkContext);
  // Accept dimensions only, never arbitrary inline styles from README HTML.
  const dimension = (value?: string | number) => typeof value === 'number' ? value
    : value && /^\d+(?:\.\d+)?%?$/.test(value) ? value.endsWith('%') ? value : Number(value) : undefined;
  const imageStyle = { width: dimension(width), height: dimension(height) };
  const image = <img src={src} alt={alt} className={className} loading={loading} style={imageStyle} />;

  function closeLightbox() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (insideLink) return image;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="thread-graph-zoomable-image-trigger"
        style={{ width: dimension(width) }}
        onClick={() => setOpen(true)}
        title={translate("files.openImagePreview")}
        aria-label={translate("files.openImagePreview_bdac35", { value1: alt || translate("files.workspaceImage") })}
      >
        {image}
      </button>
      {open ? (
        <GraphWorkspaceImageLightbox
          src={fullSrc || src}
          alt={alt}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  );
}

/** Direct manipulation inside the file viewer; opening a lightbox is optional. */
export function WorkspaceImagePreview({ src, alt }: { src: string; alt: string }) {
  useI18n();
  const { viewportRef, scale, dragging, transform, reset, updateScale, handlers } = useImageViewport();
  const [open, setOpen] = useState(false);
  return <div className="workspace-image-preview">
    <div className="workspace-image-controls" role="toolbar" aria-label={translate('files.imageZoomControls')}>
      <button type="button" onClick={() => updateScale(scale - .25)} disabled={scale <= IMAGE_LIGHTBOX_MIN_SCALE} aria-label={translate('files.zoomOut')}><Minus size={14} /></button>
      <button type="button" onClick={reset} aria-label={translate('files.resetZoom')}><span>{Math.round(scale * 100)}%</span></button>
      <button type="button" onClick={() => updateScale(scale + .25)} disabled={scale >= IMAGE_LIGHTBOX_MAX_SCALE} aria-label={translate('files.zoomIn')}><Plus size={14} /></button>
      <button type="button" onClick={() => setOpen(true)} aria-label={translate('files.openImagePreview')}><Maximize2 size={14} /></button>
    </div>
    <div ref={viewportRef} className="workspace-image-viewport" {...handlers}>
      <img src={src} alt={alt} draggable={false} className={dragging ? 'is-dragging' : ''} style={{ transform }} />
    </div>
    {open && <GraphWorkspaceImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
  </div>;
}
