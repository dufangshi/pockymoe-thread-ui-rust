import { createContext, useContext, useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { translate, useI18n } from '../i18n';
import { ErrorMark } from './copy/ErrorMark';

export type ImageResolver = (src: string) => string | Promise<string>;
const ImageRecoveryContext = createContext<ImageResolver>(src => src);
export const ImageRecoveryProvider = ImageRecoveryContext.Provider;
/** The host reads bytes through its own transport; each mounted image owns
 * at most one resulting object URL. Returning null leaves external images alone. */
export type ImageBlobReader = (src: string, signal: AbortSignal) => Promise<Blob | null>;
const ImageBlobContext = createContext<ImageBlobReader | undefined>(undefined);
export const ImageFallbackProvider = ImageBlobContext.Provider;
export type ImageFailureDiagnoser = (src: string) => Promise<string | null>;
const ImageDiagnosisContext = createContext<ImageFailureDiagnoser | undefined>(undefined);
export const ImageDiagnosisProvider = ImageDiagnosisContext.Provider;

/** One bounded recovery policy for thumbnails, inline images and lightboxes.
 * The wrapper owns the error action, outside any caller's image button/link. */
export function RecoverableImage(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
  src: string;
  resolveSrc?: ImageResolver | undefined;
  resolveFallback?: ImageResolver | undefined;
  renderImage?: ((image: ReactNode) => ReactNode) | undefined;
}) {
  return <ImageAttempt key={props.src} {...props} />;
}
function ImageAttempt({ src, resolveSrc, resolveFallback, renderImage = image => image, ...props }: Parameters<typeof RecoverableImage>[0]) {
  useI18n();
  const refresh = useContext(ImageRecoveryContext);
  const diagnose = useContext(ImageDiagnosisContext);
  const readBlob = useContext(ImageBlobContext);
  const latest = useRef({ resolveSrc, resolveFallback, refresh, diagnose, readBlob });
  latest.current = { resolveSrc, resolveFallback, refresh, diagnose, readBlob };
  const [state, setState] = useState({ url: src, attempt: 0, generation: 0, phase: 'loading' });
  const [cycle, setCycle] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const ownedUrl = useRef<string | null>(null);
  const releaseBlob = () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = null;
  };
  useEffect(() => releaseBlob, []);
  const failed = useRef(false);
  failed.current = state.phase === 'waiting' || state.phase === 'failed';
  const retry = () => {
    if (!failed.current) return;
    setReason(null);
    setCycle(value => value + 1);
    setState(current => ({ ...current, url: '', attempt: 0, phase: 'waiting' }));
  };
  useEffect(() => {
    window.addEventListener('online', retry);
    window.addEventListener('pockymoe-images-reconnected', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('pockymoe-images-reconnected', retry);
    };
  }, []);
  useEffect(() => {
    if (state.phase !== 'waiting') return;
    if (state.attempt >= 2) {
      setState(current => ({ ...current, phase: 'failed' }));
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        // Resolve again, never retain a failed blob or an old authorization URL.
        const resolver = state.attempt > 0 ? latest.current.resolveFallback ?? latest.current.resolveSrc : latest.current.resolveSrc;
        const resolved = await (resolver?.(src) ?? src);
        // Registration repair is independent of the byte read: a worker that
        // cannot start must not prevent recovery through the page transport.
        let fresh = resolved;
        if (latest.current.readBlob) {
          void Promise.resolve().then(() => latest.current.refresh(resolved)).catch(() => {});
          const blob = await latest.current.readBlob(resolved, abort.signal);
          if (cancelled) return;
          if (blob) {
            releaseBlob();
            ownedUrl.current = URL.createObjectURL(blob);
            fresh = ownedUrl.current;
          } else fresh = await latest.current.refresh(resolved);
        } else fresh = await latest.current.refresh(resolved);
        // Only a blob created by this mounted image may be reused here.
        // An optimistic preview's lease may already have been released.
        if (fresh.startsWith('blob:') && fresh !== ownedUrl.current) throw new Error('Attachment URL is not available yet');
        let url = fresh;
        const parsed = new URL(fresh, window.location.href);
        if (['http:', 'https:'].includes(parsed.protocol)) {
          parsed.searchParams.set('_imageRetry', `${Date.now()}-${cycle}-${state.attempt + 1}`);
          url = parsed.href;
        }
        if (!cancelled) setState(current => ({ url, attempt: state.attempt + 1, generation: current.generation + 1, phase: 'loading' }));
      } catch {
        if (!cancelled) setState(current => ({ ...current, attempt: current.attempt + 1 }));
      }
    }, [300, 900][state.attempt]);
    return () => { cancelled = true; abort.abort(); clearTimeout(timer); };
  }, [src, state.phase, state.attempt, cycle]);
  useEffect(() => {
    if (state.phase !== 'failed' || !latest.current.diagnose) return;
    let cancelled = false;
    void latest.current.diagnose(state.url).then(value => {
      if (!cancelled) setReason(value);
    }).catch(() => { /* Diagnosis cannot prevent manual recovery. */ });
    return () => { cancelled = true; };
  }, [state.phase, state.url]);
  const unavailable = state.phase === 'failed';
  return <span className="recoverable-image" data-image-state={state.phase}>
    {renderImage(unavailable || !state.url
      ? <span className="image-unavailable" role="img" aria-label={props.alt || translate('chat.imageUnavailable')}><ImageOff aria-hidden="true" /></span>
      : <img {...props} key={state.generation} src={state.url}
          style={{ ...props.style, visibility: state.phase === 'ready' ? props.style?.visibility : 'hidden' }}
          onLoad={() => setState(current => ({ ...current, phase: 'ready' }))}
          onError={() => setState(current => current.phase === 'waiting' || current.phase === 'failed' ? current : { ...current, phase: 'waiting' })} />)}
    {unavailable ? <span className="image-recovery-error" onPointerDown={event => event.stopPropagation()}><ErrorMark message={reason ?? translate('chat.imageUnavailable')} onRetry={retry} /></span> : null}
  </span>;
}
