import { describe, expect, it } from 'vitest';
import type { ThreadTurnDto } from '@pockymoe/shared';
import { aggregatePeerWorkTurn, groupPeerWorkTurns, peerWorkPreview } from './peerWork';
const task: ThreadTurnDto = {id:'task',error:null,status:'completed',startedAt:'2026-10-12T00:00:00Z',items:[{id:'user',kind:'userMessage',text:'Task'}]};
const child: ThreadTurnDto = {...task,id:'child',items:[{id:'wake',kind:'userMessage',text:'System envelope',peerWork:{taskTurnId:'task',messages:[{id:'q',kind:'question',subject:'Question?'}]}}]};
describe('peer work', () => {
  it('groups contiguous causal rounds but preserves new human tasks and pagination orphans', () => {
    expect(groupPeerWorkTurns([task,child,{...child,id:'child2'}])).toMatchObject([{turn:{id:'task'},continuations:[{id:'child'},{id:'child2'}]}]);
    expect(groupPeerWorkTurns([task,{...task,id:'human'},child])).toHaveLength(3);
    expect(groupPeerWorkTurns([child])).toMatchObject([{turn:{id:'child'},continuations:[]}]);
  });
  it('adds actual billed usage without estimating missing totals or changing physical records', () => {
    const total = {inputTokens:100,outputTokens:20,totalTokens:120,cachedInputTokens:0,reasoningOutputTokens:0};
    const price = {currency:'USD' as const,totalUsd:0.4,inputUsd:0.2,outputUsd:0.2,cachedInputUsd:0,cacheWriteInputUsd:0,pricingModelKey:'model',pricingTierKey:'standard' as const};
    const root = {...task,tokenUsage:{total,last:total,modelContextWindow:null},priceEstimate:price};
    const followup = {...child,tokenUsage:{total,last:total,modelContextWindow:null},priceEstimate:price,status:'inProgress' as const};
    const aggregate = aggregatePeerWorkTurn(root,[followup]);
    expect(aggregate.tokenUsage?.total.totalTokens).toBe(240);
    expect(aggregate.priceEstimate?.totalUsd).toBe(0.8);
    expect(aggregate.status).toBe('inProgress');
    expect(root.priceEstimate.totalUsd).toBe(0.4);
    expect(aggregatePeerWorkTurn(root,[child]).priceEstimate).toBeNull();
    expect(aggregatePeerWorkTurn(root,[child]).tokenUsage).toBeNull();
  });
  it('merges live text by identity, ignores empty deltas, and only promotes a terminal final', () => {
    const progress = {id:'progress',kind:'agentMessage' as const,text:'Checking',responsePhase:'commentary' as const};
    expect(peerWorkPreview({...child,status:'inProgress',items:[...child.items,progress]},[{...progress,text:'Checking the new version'}])?.text).toBe('Checking the new version');
    expect(peerWorkPreview({...child,items:[...child.items,progress]})).toBeNull();
    expect(peerWorkPreview({...child,items:[...child.items,{...progress,responsePhase:'final'}]})?.text).toBe('Checking');
  });
});
