import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { HarnessSwitchDivider } from './HarnessSwitchDivider';
const turn = {id:'turn',agentId:'claude',model:'Fable',items:[{id:'prompt',kind:'userMessage',text:'continue',harnessSwitch:{fromAgentId:'codex',fromModel:'GPT',agentId:'claude',model:'Fable',turns:12}}]} as ThreadTurnDto;
describe('harness switch divider',()=>{
 it('shows the saved switch, models, transferred turns and settings note',()=>{
  const html=renderToStaticMarkup(<HarnessSwitchDivider turn={turn}/>);
  expect(html).toContain('Switched from codex · GPT to claude · Fable');
  expect(html).toContain('12 turns handed over');
  expect(html).toContain('approval mode retained');
 });
 it('does not label unchanged agents as a switch',()=>{
  expect(renderToStaticMarkup(<HarnessSwitchDivider turn={{...turn,items:[]}} previous={{...turn,items:[]}}/>)).toBe('');
 });
});
