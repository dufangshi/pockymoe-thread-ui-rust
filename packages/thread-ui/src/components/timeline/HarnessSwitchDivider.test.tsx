import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { HarnessSwitchDivider } from './HarnessSwitchDivider';
const turn = {id:'turn',agentId:'claude',model:'haiku',items:[{id:'prompt',kind:'userMessage',text:'continue',harnessSwitch:{fromAgentId:'codex',fromModel:'gpt-6.1-sol',agentId:'claude',model:'haiku',turns:12}}]} as ThreadTurnDto;
describe('harness switch divider',()=>{
 it('uses catalog labels and keeps the settings note out of the collapsed row',()=>{
  const html=renderToStaticMarkup(<HarnessSwitchDivider turn={turn} describeModel={(_agent,model)=>model==='haiku'?'Haiku 5.5':'GPT 6.1 Sol'}/>);
  expect(html).toContain('Codex · GPT 6.1 Sol → Claude · Haiku 5.5');
  expect(html).toContain('12 turns handed over');
  expect(html).toContain('Handoff details');
  expect(html).not.toContain('approval mode retained');
 });
 it('keeps unknown model names rather than inventing catalog labels',()=>{
  expect(renderToStaticMarkup(<HarnessSwitchDivider turn={turn}/>)).toContain('Codex · gpt-6.1-sol → Claude · haiku');
 });
 it('names the ACP side of a native ↔ ACP switch and counts no handover',()=>{
  const protocolTurn={...turn,agentId:'codex',model:'gpt-6.1-sol',items:[{id:'prompt',kind:'userMessage',text:'continue',harnessSwitch:{fromAgentId:'codex',fromModel:'gpt-6.1-sol',fromHarnessProtocol:'native',agentId:'codex',model:'gpt-6.1-sol',harnessProtocol:'acp',turns:3}}]} as ThreadTurnDto;
  const seen:string[]=[];
  const html=renderToStaticMarkup(<HarnessSwitchDivider turn={protocolTurn} describeModel={(agent)=>{seen.push(agent);return undefined;}}/>);
  expect(html).toContain('Codex · gpt-6.1-sol → ACP · Codex · gpt-6.1-sol');
  expect(html).not.toContain('handed over');
  expect(seen).toEqual(['codex','acp:codex']);
 });
 it('does not label unchanged agents as a switch',()=>{
  expect(renderToStaticMarkup(<HarnessSwitchDivider turn={{...turn,items:[]}} previous={{...turn,items:[]}}/>)).toBe('');
 });
});

it('renders two independent switch entries without a following turn',()=>{
 const entries=['one','two'].map(id=>({id,kind:'harnessSwitch' as const,text:'',harnessSwitch:turn.items[0]!.harnessSwitch!}));
 const html=renderToStaticMarkup(<>{entries.map(entry=><HarnessSwitchDivider key={entry.id} turn={{...turn,items:[]}} entry={entry}/>)}</>);
 expect(html.match(/class="thread-harness-switch"/g)).toHaveLength(2);
 expect(html).not.toContain('approval mode retained');
});
