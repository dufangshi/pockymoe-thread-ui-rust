import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { translate, useI18n } from '../../i18n';
import { themeAgentName } from '../themeAgent';
import { MiddleName } from '../copy/MiddleName';
import { Tooltip, TooltipContent, TooltipTrigger } from '../graph-ui/Tooltip';

export type DescribeHandoffModel = (agentId: string, model: string) => string | undefined;
export function HarnessSwitchDivider({ turn, previous, describeModel, entry }: { entry?: import('@pockymoe/shared').ThreadHistoryItemDto; turn: ThreadTurnDto; previous?: ThreadTurnDto; describeModel?: DescribeHandoffModel | undefined }) {
  useI18n();
  const [open, setOpen] = useState(false);
  const openAtPointerDown = useRef(false);
  const change = entry?.harnessSwitch ?? turn.items.find(item => item.harnessSwitch)?.harnessSwitch;
  const from = change?.fromAgentId ?? previous?.agentId;
  const to = change?.agentId ?? turn.agentId;
  if (!from || !to || (!change && from === to)) return null;
  const label = (agent: string, model?: string | null) => [themeAgentName(agent), model ? describeModel?.(agent, model) || model : null].filter(Boolean).join(' · ');
  const fromLabel = label(from, change?.fromModel ?? previous?.model);
  const toLabel = label(to, change?.model ?? turn.model);
  const count = change ? translate('chat.handoffTurnCount', { count: change.turns }) : null;
  const fullLabel = [translate('chat.switchedHarness', { from: fromLabel, to: toLabel }), count].filter(Boolean).join(' · ');
  return <div className="thread-harness-switch">
    <span className="thread-harness-switch-label" role="separator" aria-label={fullLabel}>
      <MiddleName name={fromLabel} /><span aria-hidden="true">→</span><MiddleName name={toLabel} />
      {count && <span className="thread-harness-switch-count">· {count}</span>}
    </span>
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" className="thread-harness-switch-info" aria-label={translate('chat.handoffDetails')} aria-expanded={open}
          onPointerDown={() => { openAtPointerDown.current = open; }}
          onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(current => !(event.detail !== 0 ? openAtPointerDown.current : current)); }}>
          <Info size={14} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} collisionPadding={12} className="thread-harness-switch-tip"
        style={{ background: 'var(--theme-panel)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border)', maxWidth: 'min(360px, calc(100vw - 24px))', zIndex: 100 }}>
        <div>{fullLabel}</div>
        {change && <div>{translate('chat.handoffSettingsReset')}</div>}
      </TooltipContent>
    </Tooltip>
  </div>;
}
