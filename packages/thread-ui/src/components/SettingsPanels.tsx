import { UserRound } from 'lucide-react';
import { translate, useI18n } from '../i18n';
import { useId, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';

export type SettingsSection = { id: string; label: string; description?: string; account?: boolean; content: ReactNode };

export function SettingsPanels({ sections, initialId, selected: selectedId, onSelect, scroll }: {
  sections: SettingsSection[];
  initialId?: string;
  /** Held by the owner when the panels may remount while open. */
  selected?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  /** The panel's scroll offset, kept by the owner across such a remount. */
  scroll?: MutableRefObject<number> | undefined;
}) {
  useI18n();
  const [ownSelected, setOwnSelected] = useState(initialId ?? sections[0]?.id);
  const selected = selectedId ?? ownSelected;
  const setSelected = (id: string) => {
    if (scroll) scroll.current = 0;
    setOwnSelected(id);
    onSelect?.(id);
  };
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (scroll?.current && panel.current) panel.current.scrollTop = scroll.current;
  }, [scroll]);
  const scope = useId();
  const active = sections.find((section) => section.id === selected) ?? sections[0];
  // Phones lay the tabs out in one scrolling row: say how many are past the edge.
  const nav = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ before: false, after: 0, middle: 0 });
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element) return;
    const measure = () => {
      if (element.scrollWidth <= element.clientWidth + 1) {
        setOverflow((current) => (current.before || current.after ? { before: false, after: 0, middle: 0 } : current));
        return;
      }
      const edge = element.getBoundingClientRect().right - 8;
      const after = [...element.querySelectorAll<HTMLElement>('[role=tab]')].filter((tab) => tab.getBoundingClientRect().right > edge).length;
      const before = element.scrollLeft > 4;
      const middle = Math.round(element.offsetTop + element.offsetHeight / 2);
      setOverflow((current) => (current.before === before && current.after === after && current.middle === middle ? current : { before, after, middle }));
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => { element.removeEventListener('scroll', measure); observer?.disconnect(); };
  }, [sections.length]);
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element || element.scrollWidth <= element.clientWidth + 1) return;
    const tab = element.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!tab) return;
    const box = element.getBoundingClientRect(), own = tab.getBoundingClientRect();
    if (own.left < box.left) element.scrollLeft -= box.left - own.left + 16;
    else if (own.right > box.right - 44) element.scrollLeft += own.right - box.right + 52;
  }, [active?.id]);
  if (!active) return null;
  return <div className="settings-workspace">
    <nav ref={nav} className="settings-navigation" role="tablist" aria-label={translate("settings.settingsCategories")}
      data-more-before={overflow.before || undefined} data-more-after={overflow.after > 0 || undefined}>
      {sections.map((section, index) => <button
        key={section.id} type="button" role="tab" id={`${scope}-${section.id}`}
        aria-controls={`${scope}-panel`} aria-selected={active.id === section.id}
        tabIndex={active.id === section.id ? 0 : -1}
        onClick={() => setSelected(section.id)}
        onKeyDown={(event) => {
          let next = index;
          if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % sections.length;
          else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + sections.length - 1) % sections.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = sections.length - 1;
          else return;
          event.preventDefault();
          setSelected(sections[next]!.id);
          document.getElementById(`${scope}-${sections[next]!.id}`)?.focus();
        }}
      ><span>{section.label}</span>{section.account && <span className="settings-account-mark" title={translate('settings.accountScope')} aria-label={translate('settings.accountScope')}><UserRound size={13} aria-hidden="true" /></span>}</button>)}
    </nav>
    {/* Touch reaches the hidden tabs by swiping or by this chip; keys already move with the arrows. */}
    {overflow.after > 0 && <button type="button" className="settings-navigation-more" tabIndex={-1} style={{ top: overflow.middle }}
      aria-label={translate('settings.moreCategories', { count: overflow.after })} title={translate('settings.moreCategories', { count: overflow.after })}
      onClick={() => nav.current?.scrollBy({ left: nav.current.clientWidth * 0.7, behavior: 'smooth' })}>+{overflow.after}</button>}
    <section key={active.id} ref={panel} className="settings-panel" role="tabpanel" id={`${scope}-panel`} aria-labelledby={`${scope}-${active.id}`} tabIndex={0}
      onScroll={scroll ? (event) => { scroll.current = event.currentTarget.scrollTop; } : undefined}>
      <header className="settings-panel-heading"><h3>{active.label}</h3>{active.description && <p>{active.description}</p>}</header>
      {active.content}
    </section>
  </div>;
}
