import { translate, useI18n } from '../i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X } from 'lucide-react';
import type { WorkbenchThread } from './MatterWorkbench';
import { navigationStatusLabel } from './StatusMark';

const statusLabels: Record<string, string> = new Proxy({}, { get: (_, status) => navigationStatusLabel(String(status)) });

// This is a navigation indicator. The parent's own execution state stays intact.
export function threadGroupActivity(root: WorkbenchThread, children: WorkbenchThread[] = []) {
  const running = children.filter(child => child.status === 'running').length;
  const label = statusLabels[root.status] ?? root.status;
  if (running && (root.status === 'idle' || root.status === 'unread')) {
    return {
      status: 'agents-running',
      label: translate('workbench.agentThreadsRunning', { label, count: running }),
    };
  }
  return { status: root.status, label };
}

export function groupThreads(threads: WorkbenchThread[]) {
  const keys = new Set(threads.map(t => t.key));
  const groups = threads.filter(t => !t.rootKey || t.rootKey === t.key || !keys.has(t.rootKey))
    .map(root => ({ root, children: threads.filter(t => t.key !== root.key && t.rootKey === root.key) }));
  return groups;
}

export function GroupedThreadTabs({ threads, currentKey, onNavigate, onClose, onThreadMenu, onPrefetch }: {
  threads: WorkbenchThread[]; currentKey: string; onNavigate: (href: string) => void;
  /** Tabs that can be closed (the desktop's open conversations): a ✕, and a middle click. */
  onClose?: ((rootKey: string) => void) | undefined;
  /** Right-click or the menu key on a tab opens the conversation's menu here. */
  onThreadMenu?: ((thread: WorkbenchThread, x: number, y: number, returnFocus?: HTMLElement) => void) | undefined;
  /** Warm a conversation before it is opened, so the switch shows it at once. */
  onPrefetch?: ((href: string) => void) | undefined;
}) {
  useI18n();
  const [menu, setMenu] = useState<{ key: string; left: number; top: number } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => { setMenu(null); }, [currentKey]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(null); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    const resize = () => setMenu(null);
    window.addEventListener('resize', resize);
    popup.current?.querySelector<HTMLAnchorElement>('[aria-current="page"], a')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); window.removeEventListener('resize', resize); };
  }, [menu]);
  const groups = groupThreads(threads);
  const activeMenu = groups.find(group => group.root.key === menu?.key);
  // Where each tab's icon and agent slot are, measured: a theme decides whether an
  // icon shows and how big it is. A shown icon carries the status on its corner;
  // the agent count sits in the slot right after it.
  const groupNodes = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    const measure = () => {
      for (const group of groupNodes.current.values()) {
        const tab = group.querySelector<HTMLElement>(':scope > .matter-group-tab');
        if (!tab) continue;
        const base = group.getBoundingClientRect(), link = tab.getBoundingClientRect();
        const avatar = tab.querySelector<HTMLElement>(':scope > .matter-thread-avatar')?.getBoundingClientRect();
        const shown = Boolean(avatar && avatar.width > 0);
        group.toggleAttribute('data-avatar', shown);
        if (shown) {
          tab.style.setProperty('--tab-icon-right', `${avatar!.right - link.left}px`);
          tab.style.setProperty('--tab-icon-bottom', `${avatar!.bottom - link.top}px`);
        }
        const slot = tab.querySelector<HTMLElement>(':scope > .matter-tab-agents-slot');
        const badge = group.querySelector<HTMLElement>(':scope > .matter-group-toggle');
        if (slot && badge) {
          slot.style.width = `${badge.offsetWidth}px`;
          group.style.setProperty('--tab-agents-x', `${slot.getBoundingClientRect().left - base.left}px`);
        }
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    for (const group of groupNodes.current.values()) observer?.observe(group);
    return () => observer?.disconnect();
  });
  return <>
    {groups.map(({ root, children }) => {
      const selected = children.find(child => child.key === currentKey);
      const active = root.key === currentKey || !!selected;
      const activity = threadGroupActivity(root, children);
      return <div key={root.key} ref={node => { if (node) groupNodes.current.set(root.key, node); else groupNodes.current.delete(root.key); }}
        className="matter-thread-group" data-reorder-key={root.key} style={{ display: 'flex', flexShrink: 0, minWidth: 0 }}>
        <a className="matter-group-tab" href={root.href} aria-current={active ? 'page' : undefined}
          title={`${selected ? `${root.title} · ${selected.title}` : root.title}\n${activity.label}`}
          onClick={event => { event.preventDefault(); onNavigate(root.href); }}
          onPointerEnter={onPrefetch ? () => onPrefetch(root.href) : undefined}
          onPointerDown={onPrefetch ? () => onPrefetch(root.href) : undefined}
          onAuxClick={onClose ? event => { if (event.button === 1) { event.preventDefault(); onClose(root.key); } } : undefined}
          onContextMenu={onThreadMenu ? event => { if (event.defaultPrevented) return; event.preventDefault(); onThreadMenu(root, event.clientX, event.clientY, event.currentTarget); } : undefined}
          onKeyDown={onThreadMenu ? event => {
            if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            onThreadMenu(root, box.left, box.bottom + 4, event.currentTarget);
          } : undefined}>
          {root.agent && <span className="matter-thread-avatar" data-agent={root.agent} aria-hidden="true" />}
          <span className="matter-status-dot" role="img" aria-label={activity.label} data-status={activity.status} />
          {children.length > 0 && <span className="matter-tab-agents-slot" aria-hidden="true" />}
          <span>{root.title}{selected ? ` · ${selected.title}` : ''}</span>
        </a>
        {children.length > 0 && <button className="matter-group-toggle is-badge" aria-label={translate("workbench.agentThreads", { value1: root.title, value2: children.length })}
          aria-expanded={menu?.key === root.key} aria-controls="matter-agent-threads" onClick={event => {
            const bounds = event.currentTarget.getBoundingClientRect(); trigger.current = event.currentTarget;
            setMenu(menu?.key === root.key ? null : { key: root.key, left: Math.max(8, Math.min(bounds.left, window.innerWidth - 296)), top: bounds.bottom + 4 });
          }}><Bot aria-hidden="true" />{children.length}</button>}
        {onClose && <button type="button" className="matter-tab-close" aria-label={translate('workbench.closeTab', { title: root.title })}
          title={translate('workbench.closeTab', { title: root.title })} onClick={() => onClose(root.key)}><X aria-hidden="true" /></button>}
      </div>;
    })}
    {menu && activeMenu && createPortal(<div ref={popup} id="matter-agent-threads" className="matter-agent-threads-menu" role="region" aria-label={translate("workbench.agentThreads_187f89", { value1: activeMenu.root.title })}
      style={{ position: 'fixed', left: menu.left, top: menu.top, zIndex: 1000, width: 'min(280px, calc(100vw - 16px))', maxHeight: 'min(420px, 65dvh)', overflowY: 'auto', background: 'var(--theme-surface)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border)', borderRadius: 8, padding: 6, boxShadow: '0 8px 24px #0004' }}>
      {[activeMenu.root, ...activeMenu.children].map(thread => {
        const activity = threadGroupActivity(thread, thread.key === activeMenu.root.key ? activeMenu.children : []);
        return <a key={thread.key} href={thread.href} className="matter-agent-threads-item"
        aria-current={thread.key === currentKey ? 'page' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 4, background: thread.key === currentKey ? 'var(--theme-hover)' : undefined, color: 'inherit' }}
        onClick={event => { event.preventDefault(); setMenu(null); onNavigate(thread.href); }}>
        {thread.agent && <span className="matter-thread-avatar" data-agent={thread.agent} aria-hidden="true" />}
        <span className="matter-status-dot" role="img" aria-label={activity.label} data-status={activity.status} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.title}</span>
      </a>; })}
    </div>, document.body)}
  </>;
}
