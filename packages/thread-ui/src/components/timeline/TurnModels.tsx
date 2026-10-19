import { useRef, useState } from 'react';
import { Repeat } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '../graph-ui/Tooltip';
import type { TimelineTurn } from './timelineItems';
import { knownTurnModel } from './TurnUsageInline';

/** "claude-opus-5-5" reads "opus 5.5" and "gpt-6-astra" "6 astra": the vendor
    part goes, a date stamp goes, and numbered parts join into a version. */
export function shortModelName(model: string) {
  const parts = model.split('-').filter(Boolean);
  if (parts.length < 2) return model;
  const words: string[] = [];
  for (const part of parts.slice(1)) {
    if (/^\d{8}$/.test(part)) continue;
    const previous = words.at(-1);
    if (previous && /^\d+(\.\d+)*$/.test(part) && /^\d+(\.\d+)*$/.test(previous)) words[words.length - 1] = `${previous}.${part}`;
    else words.push(part);
  }
  return words.length ? words.join(' ') : model;
}

/** The model a turn ran with and its effort. A turn whose model was switched
    while it worked shows each model in the order it ran ("opus 4.7 → sonnet
    4.6"); tapping it lists how many model calls each made. */
export function TurnModels({ turn }: { turn: TimelineTurn }) {
  useI18n();
  const [open, setOpen] = useState(false);
  const openAtPointerDown = useRef(false);
  const model = knownTurnModel(turn);
  const effort = turn.reasoningEffort?.trim();
  const suffix = effort ? ` · ${effort}` : '';
  const runs = (turn.tokenUsage?.models ?? []).filter(run => run.model && run.model !== '<synthetic>' && run.calls > 0);
  if (runs.length < 2) {
    return model ? <span className="thread-turn-head-model" title={model}>{shortModelName(model)}{suffix}</span> : null;
  }
  const sequence = runs.map(run => shortModelName(run.model)).join(' → ');
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" className="thread-turn-head-model thread-turn-head-models" aria-expanded={open}
          aria-label={translate('chat.turnModelsShow', { models: sequence })}
          onPointerDown={() => { openAtPointerDown.current = open; }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            // As with the speed: toggle from the press state, since touch focus can open it first.
            const pointer = event.detail !== 0;
            setOpen(current => !(pointer ? openAtPointerDown.current : current));
          }}>
          <span>{sequence}{suffix}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} collisionPadding={12} className="thread-usage-details thread-turn-models-details"
        style={{ zIndex: 80, maxWidth: 'min(320px, calc(100vw - 24px))' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <Repeat size={14} aria-hidden="true" />
          <span>{translate('chat.turnModelsTitle')}</span>
        </div>
        <ol style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 12px', margin: 0, padding: 0, listStyle: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {runs.map((run, index) => (
            <li key={`${index}-${run.model}`} style={{ display: 'contents' }}>
              <span title={run.model} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortModelName(run.model)}</span>
              <span style={{ textAlign: 'right' }}>{translate('chat.speedRequestsValue', { count: run.calls })}</span>
            </li>
          ))}
        </ol>
        <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.45, opacity: 0.75 }}>{translate('chat.turnModelsNote')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
