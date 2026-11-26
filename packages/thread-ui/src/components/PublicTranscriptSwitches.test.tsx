import { renderToStaticMarkup } from 'react-dom/server';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { expect, it } from 'vitest';
import { PublicTranscript, transcriptSnapshot } from './PublicTranscript';
it.each([null,'turn'])('exports consecutive switches anchored at %s', (anchor) => {
  const turns: ThreadTurnDto[] = anchor ? [{id:anchor,items:[],status:'completed',startedAt:null,error:null}] : [];
  const snapshot = transcriptSnapshot('Thread', turns, 'light');
  snapshot.harnessSwitches = ['one', 'two'].map(id => ({ id, kind: 'harnessSwitch' as const, text: '', afterTurnId: anchor, harnessSwitch: { fromAgentId: 'codex', agentId: 'claude', turns: 0 } }));
  const html = renderToStaticMarkup(<PublicTranscript snapshot={snapshot} />);
  expect(html.match(/class="thread-harness-switch"/g)).toHaveLength(2);
  expect(snapshot.turnCount).toBe(turns.length);
});
