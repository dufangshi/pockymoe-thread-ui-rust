import { createContext, useContext, useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { translate, useI18n } from '../i18n';
import { ErrorMark } from './copy/ErrorMark';

export type ImageResolver = (src: string) => string | Promise<string>;
const ImageRecoveryContext = createContext<ImageResolver>(src => src);
export const ImageRecoveryProvider = ImageRecoveryContext.Provider;

/** One bounded recovery policy for thumbnails, inline images and lightboxes.
 * The wrapper owns the error action, outside any caller's image button/link. */
export function RecoverableImage(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
  src: string;
  resolveSrc?: ImageResolver | undefined;
  renderImage?: ((image: ReactNode) => ReactNode) | undefined;
}) {
  return <ImageAttempt key={props.src} {...props} />;
}
function ImageAttempt({ src, resolveSrc, renderImage = image => image, ...props }: Parameters<typeof RecoverableImage>[0]) {
  useI18n();
  const refresh = useContext(ImageRecoveryContext);
  const latest = useRef({ resolveSrc, refresh });
  latest.current = { resolveSrc, refresh };
  const [state, setState] = useState({ url: src, attempt: 0, phase: 'loading' });
  const [cycle, setCycle] = useState(0);
  const failed = useRef(false);
  failed.current = state.phase === 'waiting' || state.phase === 'failed';
  const retry = () => {
    if (!failed.current) return;
    setCycle(value => value + 1);
    setState(current => ({ ...current, attempt: 0, phase: 'waiting' }));
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
    const timer = window.setTimeout(async () => {
      try {
        // Resolve again, never retain a failed blob or an old authorization URL.
        const resolved = await (latest.current.resolveSrc?.(src) ?? src);
        const fresh = await latest.current.refresh(resolved);
        let url = fresh;
        const parsed = new URL(fresh, window.location.href);
        if (['http:', 'https:'].includes(parsed.protocol)) {
          parsed.searchParams.set('_imageRetry', `${Date.now()}-${cycle}-${state.attempt + 1}`);
          url = parsed.href;
        }
        if (!cancelled) setState({ url, attempt: state.attempt + 1, phase: 'loading' });
      } catch {
        if (!cancelled) setState(current => ({ ...current, attempt: current.attempt + 1 }));
      }
    }, [300, 900][state.attempt]);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [src, state.phase, state.attempt, cycle]);
  const unavailable = state.phase === 'failed';
  return <span className="recoverable-image" data-image-state={state.phase}>
    {renderImage(unavailable
      ? <span className="image-unavailable" role="img" aria-label={props.alt || translate('chat.imageUnavailable')}><ImageOff aria-hidden="true" /></span>
      : <img {...props} key={`${cycle}-${state.attempt}`} src={state.url}
          style={{ ...props.style, visibility: state.phase === 'ready' ? props.style?.visibility : 'hidden' }}
          onLoad={() => setState(current => ({ ...current, phase: 'ready' }))}
          onError={() => setState(current => current.phase === 'waiting' || current.phase === 'failed' ? current : { ...current, phase: 'waiting' })} />)}
    {unavailable ? <span className="image-recovery-error"><ErrorMark message={translate('chat.imageUnavailable')} onRetry={retry} /></span> : null}
  </span>;
}
