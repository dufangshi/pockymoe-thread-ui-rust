import type { ThreadTurnDto } from '@pockymoe/shared';
import { translate } from '../../i18n';
export function HarnessSwitchDivider({ turn, previous }: { turn: ThreadTurnDto; previous?: ThreadTurnDto }) {
  const change=turn.items.find(item=>item.harnessSwitch)?.harnessSwitch;
  const from=change?.fromAgentId ?? previous?.agentId;
  const to=change?.agentId ?? turn.agentId;
  if(!from || !to || (!change && from===to)) return null;
  const fromLabel=[from,change?.fromModel].filter(Boolean).join(' · ');
  const toLabel=[to,change?.model ?? turn.model].filter(Boolean).join(' · ');
  return <div className="thread-harness-switch" role="separator">
    <span>{translate('chat.switchedHarness',{from:fromLabel,to:toLabel})}</span>
    {change && <><span> · {translate('chat.handoffTurnCount',{count:change.turns})}</span><p>{translate('chat.handoffSettingsReset')}</p></>}
  </div>;
}
