import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { translate } from '../../i18n';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { useModalFocus } from '../menu/useModalFocus';
import type { MapScope } from './types';

export function PhoneMapMenu({ scope, setScope, onRefresh, list, onToggleList, destinations, onGoTo }: {
  scope: MapScope; setScope: (scope: MapScope) => void; onRefresh: () => void;
  list: boolean; onToggleList: () => void;
  destinations: { id: string; label: string }[]; onGoTo: (id: string) => void;
}) {
  const [open, setOpen] = useState(false), [goTo, setGoTo] = useState(false);
  const menu = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const close = (restore = true) => { setOpen(false); setGoTo(false); if (restore) trigger.current?.focus(); };
  useMenuKeyboard(menu, open, close);
  useModalFocus(menu, open);
  const showDestinations = () => { setGoTo(true); requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()); };
  return <>
    <button ref={trigger} type="button" className="thread-map-icon-button" aria-label={translate('workbench.threadMapActions')} aria-haspopup="menu" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}><MoreHorizontal aria-hidden="true" /></button>
    {open && createPortal(<div className="thread-map-phone-menu-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={menu} className="thread-map-phone-menu" role="menu" aria-label={translate(goTo ? 'workbench.threadMapGoTo' : 'workbench.threadMapActions')}>
        {goTo ? <>
          <button type="button" role="menuitem" onClick={() => { setGoTo(false); requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()); }}>{translate('workbench.threadMapBack')}</button>
          {destinations.map(item => <button type="button" role="menuitem" key={item.id} onClick={() => { onGoTo(item.id); close(); }}>{item.label}</button>)}
        </> : <>
          {(['all', 'active', 'week'] as const).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={value === scope} onClick={() => { setScope(value); close(); }}>{translate(value === 'all' ? 'workbench.threadMapScopeAll' : value === 'active' ? 'workbench.threadMapScopeActive' : 'workbench.threadMapScopeWeek')}</button>)}
          <button type="button" role="menuitem" onClick={showDestinations}>{translate('workbench.threadMapGoTo')}</button>
          <button type="button" role="menuitemcheckbox" aria-checked={list} onClick={() => { onToggleList(); close(); }}>{translate('workbench.threadMapListView')}</button>
          <button type="button" role="menuitem" onClick={() => { onRefresh(); close(); }}>{translate('workbench.threadMapRefreshLayout')}</button>
        </>}
      </div>
    </div>, document.body)}
  </>;
}
