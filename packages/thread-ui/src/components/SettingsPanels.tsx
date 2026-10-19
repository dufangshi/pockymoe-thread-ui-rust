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
  if (!active) return null;
  return <div className="settings-workspace">
    <nav className="settings-navigation" role="tablist" aria-label={translate("settings.settingsCategories")}>
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
    <section key={active.id} ref={panel} className="settings-panel" role="tabpanel" id={`${scope}-panel`} aria-labelledby={`${scope}-${active.id}`} tabIndex={0}
      onScroll={scroll ? (event) => { scroll.current = event.currentTarget.scrollTop; } : undefined}>
      <header className="settings-panel-heading"><h3>{active.label}</h3>{active.description && <p>{active.description}</p>}</header>
      {active.content}
    </section>
  </div>;
}
