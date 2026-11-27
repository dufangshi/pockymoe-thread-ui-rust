import * as Slider from '@radix-ui/react-slider';
import { useEffect, useState, type CSSProperties } from 'react';
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
 * A model's reasoning levels as one compact slider row: "Effort · high" and a
 * slim track with a tick per level. Dragging or ←/→/Home/End snaps between
 * levels; the level is committed when the drag ends (or per key step).
 */
export function EffortSlider({ efforts, value, defaultEffort, disabled, onChange }: {
  efforts: ModelOptionDto['supportedReasoningEfforts'];
  /** The chosen level; null shows the model's default as chosen. */
  value: ReasoningEffortDto | null | undefined;
  defaultEffort: ReasoningEffortDto | null | undefined;
  disabled: boolean;
  onChange: (effort: ReasoningEffortDto) => void;
}) {
  useI18n();
  const options = orderedEfforts(efforts);
  const chosen = value ?? defaultEffort ?? null;
  const selected = Math.max(0, options.findIndex((entry) => entry.reasoningEffort === chosen));
  // The level under the finger while dragging; the committed one otherwise.
  const [shown, setShown] = useState(selected);
  useEffect(() => setShown(selected), [selected]);
  if (!options.length) return null;
  const index = Math.min(shown, options.length - 1);
  const option = options[index]!;
  const label = formatReasoningEffortLabel(option.reasoningEffort);
  const last = Math.max(1, options.length - 1);
  return (
    <div
      className="model-picker-effort"
      data-effort={option.reasoningEffort}
      data-levels={options.length}
      style={{
        // The slider takes the level's colour from the effort scale; its fill passes
        // through every level's colour up to it, so a higher level reads hotter.
        '--effort-color': reasoningEffortColor(option.reasoningEffort, index, options.length),
        '--effort-scale': `linear-gradient(90deg, ${options.slice(0, index + 1)
          .map((entry, at) => reasoningEffortColor(entry.reasoningEffort, at, options.length))
          .concat(index === 0 ? [reasoningEffortColor(option.reasoningEffort, 0, options.length)] : [])
          .join(', ')})`,
      } as CSSProperties}
    >
      <span className="model-picker-effort-label">
        {translate('chat.effort')}
        <span className="model-picker-effort-value" aria-hidden="true"> · {label}</span>
      </span>
      <Slider.Root
        className="model-picker-effort-slider"
        min={0}
        max={last}
        step={1}
        value={[index]}
        disabled={disabled || options.length < 2}
        onValueChange={([next]) => setShown(next ?? index)}
        onValueCommit={([next]) => {
          const level = options[next ?? index];
          if (level && level.reasoningEffort !== chosen) onChange(level.reasoningEffort);
        }}
      >
        <Slider.Track className="model-picker-effort-track">
          <Slider.Range className="model-picker-effort-range" />
        </Slider.Track>
        <span className="model-picker-effort-ticks" aria-hidden="true">
          {options.map((entry, at) => (
            <i key={entry.reasoningEffort} data-on={at <= index || undefined} style={{ left: `${(at / last) * 100}%` }} />
          ))}
        </span>
        <span className="model-picker-effort-blocks" aria-hidden="true">
          {options.slice(1).map((entry, at) => (
            <i
              key={entry.reasoningEffort}
              data-on={at < index || undefined}
              style={{ '--block-color': reasoningEffortColor(entry.reasoningEffort, at + 1, options.length) } as CSSProperties}
            />
          ))}
        </span>
        <Slider.Thumb
          className="model-picker-effort-thumb"
          aria-label={translate('chat.effort')}
          aria-valuetext={label}
          title={option.description || undefined}
        />
      </Slider.Root>
    </div>
  );
}
