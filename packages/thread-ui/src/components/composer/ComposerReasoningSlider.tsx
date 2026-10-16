import * as Slider from '@radix-ui/react-slider';
import { useEffect, useState, type CSSProperties } from 'react';
import type { ModelOptionDto, ReasoningEffortDto } from '@pockymoe/shared';
import { translate } from '../../i18n';
import { formatReasoningEffortLabel } from './composerUtils';

const effortOrder = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
];
const effortColors = [
  '#64a8f5',
  '#5e9fe8',
  '#48b9b5',
  '#56b987',
  '#d2b354',
  '#e09863',
  '#cc7c9a',
  '#a787df',
];

export function ComposerReasoningSlider({
  efforts,
  effort,
  defaultEffort,
  disabled,
  onCommit,
}: {
  efforts: ModelOptionDto['supportedReasoningEfforts'];
  effort: ReasoningEffortDto | null | undefined;
  defaultEffort: ReasoningEffortDto | null | undefined;
  disabled: boolean;
  onCommit: (effort: ReasoningEffortDto) => void;
}) {
  // Known levels have a semantic order; opaque ACP values retain catalog order.
  const options = [...efforts];
  if (options.every((entry) => effortOrder.includes(entry.reasoningEffort)))
    options.sort((a, b) => {
      const left = effortOrder.indexOf(a.reasoningEffort);
      const right = effortOrder.indexOf(b.reasoningEffort);
      return (
        (left < 0 ? effortOrder.length : left) -
        (right < 0 ? effortOrder.length : right)
      );
    });
  const selection = Math.max(
    0,
    options.findIndex(
      (entry) => entry.reasoningEffort === (effort ?? defaultEffort),
    ),
  );
  const [preview, setPreview] = useState(selection);
  const [interacting, setInteracting] = useState(false);
  const signature = options
    .map((entry) => entry.reasoningEffort)
    .join('\u001f');
  useEffect(() => {
    setPreview(selection);
    setInteracting(false);
  }, [selection, effort, signature]);
  const index = Math.min(preview, options.length - 1);
  const option = options[index];
  if (!option) return null;
  const colorIndex = effortOrder.indexOf(option.reasoningEffort);
  const color =
    effortColors[
      colorIndex >= 0
        ? colorIndex
        : Math.round(
            (index / Math.max(1, options.length - 1)) *
              (effortColors.length - 1),
          )
    ]!;
  const label = formatReasoningEffortLabel(
    interacting || index !== selection ? option.reasoningEffort : effort,
  );
  const choose = (next: number) => {
    const chosen = options[next];
    if (disabled || !chosen) return;
    setPreview(next);
    setInteracting(false);
    if (chosen.reasoningEffort !== effort) onCommit(chosen.reasoningEffort);
  };

  return (
    <section
      className="composer-reasoning"
      data-effort={option.reasoningEffort}
      data-interacting={interacting}
      style={{ '--effort-color': color } as CSSProperties}
    >
      <div className="composer-reasoning-heading">
        <span>{translate('chat.effort')}</span>
        <span className="composer-reasoning-value" key={label}>
          {label}
        </span>
      </div>
      <Slider.Root
        className="composer-reasoning-slider"
        title={option.description || undefined}
        min={0}
        max={Math.max(1, options.length - 1)}
        step={1}
        value={[index]}
        disabled={disabled || options.length < 2}
        onValueChange={(value) => {
          setPreview(value[0] ?? 0);
          setInteracting(true);
        }}
        onValueCommit={(value) => choose(value[0] ?? 0)}
        onPointerCancel={() => {
          setPreview(selection);
          setInteracting(false);
        }}
      >
        <Slider.Track className="composer-reasoning-track">
          <Slider.Range className="composer-reasoning-range" />
        </Slider.Track>
        <Slider.Thumb
          className="composer-reasoning-thumb"
          aria-label={translate('chat.effort')}
          aria-valuetext={label}
        />
        {/* The level names are part of the slider: a press or drag anywhere on
            the track or the names moves it, not only on the thin track. */}
        <span className="composer-reasoning-stops" aria-hidden="true">
          {options.map((entry, stop) => (
            <span
              key={entry.reasoningEffort}
              data-current={entry.reasoningEffort === effort || undefined}
              data-preview={stop === index || undefined}
              style={{
                left: `calc(${(stop / Math.max(1, options.length - 1)) * 100}% + ${11 - (22 * stop) / Math.max(1, options.length - 1)}px)`,
              }}
            >
              <i />
              {formatReasoningEffortLabel(entry.reasoningEffort)}
            </span>
          ))}
        </span>
      </Slider.Root>
    </section>
  );
}
