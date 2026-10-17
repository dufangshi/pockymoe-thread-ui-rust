import { translate, useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, TriangleAlert } from 'lucide-react';
import { copyText } from './shell/terminalClipboard';
import { useMenuKeyboard } from './menu/useMenuKeyboard';
import { useLongPress } from './menu/useLongPress';

/** A workspace file named in a reply. A click opens it; a right click, a long
    press or the keyboard's menu key opens its menu (open, copy path). */
export function WorkspaceFileLink({path, line, children, onOpen, className = 'thread-inline-link'}: {
  path: string; line?: number | undefined; children: ReactNode;
  onOpen: (input: {path: string; line?: number}) => void; className?: string;
}) {
  useI18n();
  const [menu, setMenu] = useState<{x: number; y: number} | null>(null);
  const [copy, setCopy] = useState<'copied' | 'failed' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const displayPath = path.startsWith('/') || /^[a-z]:/i.test(path) ? path : `./${path.replace(/^\.\//, '')}`;
  // What "Copy path" gives: the workspace path, with the line as editors write it.
  const copyValue = path.replace(/^\.\//, '') + (line ? `:${line}` : '');
  const close = (restoreFocus: boolean) => { setMenu(null); setCopy(null); if (restoreFocus) linkRef.current?.focus(); };
  useMenuKeyboard(menuRef, Boolean(menu), close);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) close(false); };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [menu]);
  const show = (x: number, y: number) => { setCopy(null); setMenu({ x: Math.min(x, window.innerWidth - 190), y: Math.min(y, window.innerHeight - 100) }); };
  const press = useLongPress(({ x, y }) => show(x, y));
  const open = () => {setMenu(null);onOpen({path,...(line ? {line} : {})});};
  return <>
    <a ref={linkRef} data-file-link="" href={displayPath.split('/').map(encodeURIComponent).join('/') + (line ? `#L${line}` : '')} title={copyValue} className={className}
      {...press}
      onClick={event=>{event.preventDefault();open();}}
      onContextMenu={event=>{event.preventDefault();show(event.clientX, event.clientY);}}>{children}</a>
    {menu && createPortal(<div ref={menuRef} role="menu" aria-label={translate("files.fileLink")} className="thread-workspace-link-menu" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      <button type="button" role="menuitem" onClick={open}>{translate("files.openFile")}</button>
      <button type="button" role="menuitem" data-copy-state={copy ?? undefined} onClick={async () => {
        const ok = await copyText(copyValue);
        setCopy(ok ? 'copied' : 'failed');
        if (ok) window.setTimeout(() => close(true), 700);
      }}>
        {copy === 'copied' ? <Check aria-hidden="true" /> : copy === 'failed' ? <TriangleAlert aria-hidden="true" /> : null}
        {copy === 'copied' ? translate('common.copied') : copy === 'failed' ? translate('common.copyFailed') : translate('common.copyPath')}
      </button>
      <span className="copy-button-status" role="status">{copy === 'copied' ? translate('common.copied') : copy === 'failed' ? translate('common.copyFailed') : ''}</span>
    </div>, linkRef.current?.closest('.thread-ui-shell') ?? document.body)}
  </>;
}
