import { translate as t } from '../../i18n';
import { SquareSplitHorizontal, SquareTerminal, Trash2 } from 'lucide-react';
import { useRef, type KeyboardEvent, type MouseEvent } from 'react';

import { statusLabel } from './shellPresentation';
import type { TerminalLayout } from './terminalLayout';

/** `running`: alive on the device but not attached in this view (hidden group). */
export type TerminalStatus = 'connected' | 'connecting' | 'running' | 'disconnected';

export interface TerminalTabEntry {
  id: string;
  label: string;
  status: TerminalStatus;
  /** cwd and a recognizable shell id for hover/long-press details. */
  detail: string;
}

/** VS Code's tab list widths: icon-only below the midpoint, actions above 105px. */
export const TERMINAL_TABS_NARROW = 46;
export const TERMINAL_TABS_DEFAULT = 148;
export const TERMINAL_TABS_MAX = 500;
const TERMINAL_TABS_MIDPOINT = 63;

export function splitPrefix(index: number, count: number) {
  if (count < 2) return '';
  return index === 0 ? '┌' : index === count - 1 ? '└' : '├';
}

export function TerminalStatusDot({ status }: { status: TerminalStatus }) {
  const label = status === 'connected'
    ? t('workbench.terminalStatusConnected')
    : status === 'connecting' ? t('workbench.terminalConnecting')
      : status === 'running' ? statusLabel('running') : t('workbench.terminalDisconnected');
  return <span className="terminal-status-dot" data-status={status} role="img" aria-label={label} title={label} />;
}

export function TerminalTabs({
  layout,
  entries,
  width,
  busy,
  renamingId,
  renameDraft,
  onRenameDraft,
  onSubmitRename,
  onCancelRename,
  onSelect,
  onStartRename,
  onSplit,
  onKill,
  onFocusTerminal,
  onContextMenu,
  canSplit,
}: {
  layout: TerminalLayout;
  entries: Map<string, TerminalTabEntry>;
  width: number;
  busy: boolean;
  renamingId: string | null;
  renameDraft: string;
  onRenameDraft: (value: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onSelect: (id: string) => void;
  onStartRename: (id: string) => void;
  onSplit: (id: string) => void;
  onKill: (id: string) => void;
  onFocusTerminal: () => void;
  onContextMenu: (id: string, event: MouseEvent | KeyboardEvent) => void;
  canSplit: (id: string) => boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  const hasText = width >= TERMINAL_TABS_MIDPOINT;
  const order = layout.groups.flatMap(group => group.shellIds);
  const moveFocus = (id: string, direction: 1 | -1) => {
    const next = order[(order.indexOf(id) + direction + order.length) % order.length];
    if (!next) return;
    onSelect(next);
    list.current?.querySelector<HTMLElement>(`[data-shell-id="${next}"]`)?.focus();
  };
  return (
    <div
      ref={list}
      role="tablist"
      aria-orientation="vertical"
      aria-label={t('workbench.terminalTabs')}
      className={`terminal-tabs ${hasText ? 'has-text' : 'is-narrow'}`}
      data-testid="terminal-tabs"
    >
      {layout.groups.flatMap(group => group.shellIds.map((id, index) => {
        const entry = entries.get(id);
        if (!entry) return null;
        const active = layout.activeShellId === id;
        const prefix = splitPrefix(index, group.shellIds.length);
        const accessibleName = group.shellIds.length > 1
          ? t('workbench.terminalSplitPosition', { value1: entry.label, value2: index + 1, value3: group.shellIds.length })
          : entry.label;
        return (
          <div
            key={id}
            role="tab"
            aria-selected={active}
            aria-label={accessibleName}
            tabIndex={active ? 0 : -1}
            title={`${accessibleName}\n${entry.detail}`}
            className={`terminal-tab ${active ? 'is-active' : ''}`}
            data-shell-id={id}
            onClick={() => onSelect(id)}
            onDoubleClick={() => onStartRename(id)}
            onContextMenu={(event) => { event.preventDefault(); onSelect(id); onContextMenu(id, event); }}
            onKeyDown={(event) => {
              if (renamingId === id) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); moveFocus(id, event.key === 'ArrowDown' ? 1 : -1); }
              else if (event.key === 'Enter') { event.preventDefault(); onFocusTerminal(); }
              else if (event.key === 'F2') { event.preventDefault(); onStartRename(id); }
              else if (event.key === 'Delete') { event.preventDefault(); onKill(id); }
              else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) { event.preventDefault(); onContextMenu(id, event); }
            }}
          >
            {prefix && <span className="terminal-tab-prefix" aria-hidden="true">{prefix}</span>}
            <SquareTerminal size={14} className="terminal-tab-icon" aria-hidden="true" />
            {hasText && (renamingId === id ? (
              <form className="terminal-tab-rename" onSubmit={(event) => { event.preventDefault(); onSubmitRename(); }}>
                <input
                  aria-label={t('workbench.terminalName')}
                  value={renameDraft}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => onRenameDraft(event.currentTarget.value)}
                  onBlur={onSubmitRename}
                  onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancelRename(); } }}
                />
              </form>
            ) : (
              <span className="terminal-tab-label">{entry.label}</span>
            ))}
            <TerminalStatusDot status={entry.status} />
            {hasText && renamingId !== id && (
              <span className="terminal-tab-actions">
                {canSplit(id) && (
                  <button type="button" tabIndex={-1} disabled={busy} aria-label={t('workbench.terminalSplitNamed', { value1: entry.label })} title={t('workbench.terminalSplit')}
                    onClick={(event) => { event.stopPropagation(); onSplit(id); }}>
                    <SquareSplitHorizontal size={14} />
                  </button>
                )}
                <button type="button" tabIndex={-1} disabled={busy} className="is-danger" aria-label={t('workbench.terminalKillNamed', { value1: entry.label })} title={t('workbench.terminalKill')}
                  onClick={(event) => { event.stopPropagation(); onKill(id); }}>
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </div>
        );
      }))}
    </div>
  );
}
