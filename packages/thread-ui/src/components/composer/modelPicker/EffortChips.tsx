import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ModelOptionDto, ReasoningEffortDto } from '@pockymoe/shared';
import { translate, useI18n } from '../../../i18n';
import { formatReasoningEffortLabel, REASONING_EFFORT_ORDER, reasoningEffortColor } from '../composerUtils';

/** Known levels in their semantic order; opaque ACP values keep the catalog's order. */
export function orderedEfforts(efforts: ModelOptionDto['supportedReasoningEfforts']) {
  const options = [...efforts];
  if (options.every((entry) => REASONING_EFFORT_ORDER.includes(entry.reasoningEffort))) {
    options.sort((a, b) => REASONING_EFFORT_ORDER.indexOf(a.reasoningEffort) - REASONING_EFFORT_ORDER.indexOf(b.reasoningEffort));
  }
  return options;
}

/**
 * A model's reasoning levels as one row of chips (a radio group): the chosen
 * level filled in its effort colour. ←/→ (and Home/End) move and choose, like
 * a slider; only the chosen chip is in the tab and arrow order of the menu.
 */
export function EffortChips({ efforts, value, defaultEffort, disabled, onChange }: {
  efforts: ModelOptionDto['supportedReasoningEfforts'];
  /** The chosen level; null shows the model's default as chosen. */
  value: ReasoningEffortDto | null | undefined;
  defaultEffort: ReasoningEffortDto | null | undefined;
  disabled: boolean;
  onChange: (effort: ReasoningEffortDto) => void;
}) {
  useI18n();
  const group = useRef<HTMLDivElement>(null);
  const options = orderedEfforts(efforts);
  const chosen = value ?? defaultEffort ?? null;
  const selected = Math.max(0, options.findIndex((entry) => entry.reasoningEffort === chosen));
  if (!options.length) return null;
  const choose = (index: number) => {
    const next = options[(index + options.length) % options.length];
    if (!next || disabled) return;
    if (next.reasoningEffort !== chosen) onChange(next.reasoningEffort);
    requestAnimationFrame(() => group.current?.querySelector<HTMLElement>(`[data-effort="${CSS.escape(next.reasoningEffort)}"]`)?.focus());
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const move = ({ ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: options.length - 1 } as Record<string, number>)[event.key];
    if (move === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    choose(event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? move : Math.max(0, Math.min(options.length - 1, move)));
  };
  return (
    <div className="model-picker-effort">
      <span className="model-picker-effort-label">{translate('chat.effort')}</span>
      <div ref={group} className="model-picker-effort-chips" role="radiogroup" aria-label={translate('chat.effort')} onKeyDown={onKeyDown}>
        {options.map((entry, index) => {
          const checked = index === selected;
          return (
            <button
              key={entry.reasoningEffort}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              title={entry.description || undefined}
              data-effort={entry.reasoningEffort}
              className="model-picker-effort-chip"
              style={{ '--effort-color': reasoningEffortColor(entry.reasoningEffort, index, options.length) } as CSSProperties}
              onClick={() => choose(index)}
            >
              {formatReasoningEffortLabel(entry.reasoningEffort)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
