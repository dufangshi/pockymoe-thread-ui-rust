import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { translate } from '../../i18n';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { useModalFocus } from '../menu/useModalFocus';
import type { MapScope } from './types';

export function PhoneMapMenu({ scope, setScope, onRefresh, hours }: { scope: MapScope; setScope: (scope: MapScope) => void; onRefresh: () => void; hours: number }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const close = (restore = true) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useMenuKeyboard(menu, open, close);
  useModalFocus(menu, open);
  return <>
    <button ref={trigger} type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapActions')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal aria-hidden="true" /></button>
    {open && createPortal(<div className="thread-map-phone-menu-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={menu} className="thread-map-phone-menu" role="menu" aria-label={translate('workbench.threadMapActions')}>
        {(['all', 'active', 'week'] as const).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={value === scope} onClick={() => { setScope(value); close(); }}>{translate(value === 'all' ? 'workbench.threadMapScopeAll' : value === 'active' ? 'workbench.threadMapScopeActive' : 'workbench.threadMapScopeWeek')}</button>)}
        <button type="button" role="menuitem" onClick={() => { onRefresh(); close(); }}>{translate('workbench.threadMapRefreshLayout')}</button>
        <div className="thread-map-phone-info">{translate('workbench.threadMapLegendSize')} · {translate('workbench.threadMapLegendColor', { hours })}</div>
      </div>
    </div>, document.body)}
  </>;
}
