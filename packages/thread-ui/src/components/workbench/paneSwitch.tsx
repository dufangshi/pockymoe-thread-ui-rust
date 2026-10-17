import { createContext, useContext, useEffect } from 'react';
import { translate as t } from '../../i18n';

export type WorkbenchPane = 'primary' | 'reference';

/** A phone split shows one conversation at a time; the composer switches it. */
export interface WorkbenchPaneSwitch {
  pane: WorkbenchPane;
  active: WorkbenchPane;
  titles: Record<WorkbenchPane, string>;
  /** Each pane's thread status, shown beside its title. */
  marks?: Partial<Record<WorkbenchPane, string | undefined>>;
  select: (pane: WorkbenchPane) => void;
  /** A rendered switch claims its pane, so the panels need no fallback there. */
  claim: (pane: WorkbenchPane) => () => void;
}

export const WorkbenchPaneSwitchContext = createContext<WorkbenchPaneSwitch | null>(null);

export function useWorkbenchPaneSwitch() {
  const value = useContext(WorkbenchPaneSwitchContext);
  const claim = value?.claim;
  const pane = value?.pane;
  useEffect(() => (claim && pane ? claim(pane) : undefined), [claim, pane]);
  return value;
}

function PaneGlyph({ side }: { side: WorkbenchPane }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="thread-pane-switch-glyph">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x={side === 'primary' ? 3.4 : 8.35} y="4.4" width="4.25" height="7.2" rx="1.1" fill="currentColor" />
    </svg>
  );
}

/** Left (primary) or right (reference) conversation of a phone split. */
export function WorkbenchPaneSwitchButton({ target, value }: { target: WorkbenchPane; value: WorkbenchPaneSwitch }) {
  const title = value.titles[target];
  return (
    <button
      type="button"
      className="thread-pane-switch"
      data-side={target}
      aria-pressed={value.active === target}
      aria-label={t(target === 'primary' ? 'workbench.showLeftConversation' : 'workbench.showRightConversation', { value1: title })}
      title={title}
      onClick={() => value.select(target)}
    >
      {target === 'primary' && <PaneGlyph side="primary" />}
      <span>{title}</span>
      {target === 'reference' && <PaneGlyph side="reference" />}
    </button>
  );
}
