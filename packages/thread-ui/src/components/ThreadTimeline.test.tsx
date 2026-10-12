/**
 * @vitest-environment jsdom
 */
import { setLocale } from '../i18n';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreadTurnDto } from '@pockymoe/shared';

import { ThreadTimeline } from './ThreadTimeline';
import { WorkbenchContext } from './WorkbenchContext';
const shellSettings = vi.hoisted(() => ({ showReasoningSummaries: true }));
vi.mock('../app-shell/AppShellNavContext', () => ({ useAppShellNav: () => shellSettings }));
import {
  formatPreciseMessageTimestamp,
  formatLongTimestamp,
  formatShortTimestamp,
} from './threadPresentation';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(node);
  });
  return container;
}

afterEach(() => {
  shellSettings.showReasoningSummaries = true;
  if (root) {
    flushSync(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
  setLocale('en', false);
  vi.useRealTimers();
});

function completedTurn(items: ThreadTurnDto['items']): ThreadTurnDto {
  return {
    id: 'turn-1',
    startedAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 59)).toISOString(),
    status: 'completed',
    error: null,
    items,
  };
}

describe('ThreadTimeline', () => {
  it('keeps a peer round human approval accessible while the whole task remains folded', () => {
    const task = {...completedTurn([{id:'user',kind:'userMessage',text:'Task'}]),id:'task'} as ThreadTurnDto;
    const peer: ThreadTurnDto = {...completedTurn([{id:'wake:user',kind:'userMessage',text:'Wake envelope',peerWork:{taskTurnId:'task',messages:[{id:'q',kind:'question',name:'Reviewer',subject:'Scope?'}]}}]),id:'wake',status:'inProgress',hasDeferredItems:true};
    const respond=vi.fn();
    const el=render(<ThreadTimeline turns={[task,peer]} liveOutput="" onLoadTurnDetail={vi.fn()} pendingRequests={[{
      id:'approval',kind:'permissionRequest',title:'Permission',description:'Approve the peer operation',turnId:'wake',itemId:null,createdAt:'2026-10-12T00:00:00Z',
      questions:[{id:'permission',header:'Permission',question:'Allow verification?',isOther:false,isSecret:false,options:[{label:'Allow',description:'Allow verification'}]}],
    }]} onRespondToRequest={respond} />);
    expect(el.querySelector('.thread-peer-work-toggle')).toBeNull();
    expect(el.textContent).toContain('Allow verification?');
    const allow=[...el.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Allow')!;
    expect(allow).toBeDefined();
    flushSync(()=>allow.click());
    expect(respond).toHaveBeenCalled();
  });

  it('nests peer questions in task steps and loads only the selected question round', async () => {
    const task = {...completedTurn([
      {id:'user',kind:'userMessage',text:'Implement the original task'},
      {id:'handoff',kind:'agentMessage',text:'Delegated the work',responsePhase:'commentary'},
    ]),id:'task'} as ThreadTurnDto;
    const peer = (id: string, subject: string): ThreadTurnDto => ({...completedTurn([
      {id:`${id}:user`,kind:'userMessage',text:'[Pockymoe wake]',peerWork:{taskTurnId:'task',messages:[{id:`${id}:question`,kind:'question',name:'Reviewer',subject}]}},
      {id:`${id}:reply`,kind:'agentMessage',text:`Reply for ${id}`,responsePhase:'final'},
    ]),id,hasDeferredItems:true,deferredItemCount:1});
    const first = peer('first','Can sessions expire?'), second = peer('second','Which scope applies?');
    const load = vi.fn(async (id: string) => {
      const turn = id === 'first' ? first : second;
      return {...turn,hasDeferredItems:false,deferredItemCount:0,items:[
        {...turn.items[0]!,peerWork:{taskTurnId:'task',messages:[{id:`${id}:question`,kind:'question' as const,name:'Reviewer',subject:'Can sessions expire?',text:'Full question: does the registration remain valid tomorrow?'}]}},
        {id:`${id}:command`,kind:'commandExecution' as const,text:'verify-session',status:'completed' as const},
        turn.items[1]!,
      ]};
    });
    const el = render(<ThreadTimeline turns={[task,first,second]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />);
    expect(el.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    expect(el.querySelectorAll('.thread-graph-worked-summary')).toHaveLength(1);
    expect(el.textContent).toContain('Reply for second');
    expect(el.textContent).not.toContain('Reply for first');
    expect(load).not.toHaveBeenCalled();
    flushSync(() => (el.querySelector('.thread-graph-worked-summary button[aria-expanded]') as HTMLButtonElement).click());
    expect(el.querySelectorAll('.thread-peer-work-toggle')).toHaveLength(2);
    expect(load).not.toHaveBeenCalled();
    const toggle = el.querySelector('.thread-peer-work-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    flushSync(() => toggle.click());
    await vi.waitFor(() => expect(el.textContent).toContain('Full question: does the registration remain valid tomorrow?'));
    expect(load).toHaveBeenCalledExactlyOnceWith('first');
    expect(el.querySelector('.thread-peer-work-operations')?.textContent).toContain('verify-session');
    expect(el.querySelector('.thread-peer-work-operations')?.textContent).toContain('Reply for first');
    expect(el.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    flushSync(() => toggle.click());
    flushSync(() => toggle.click());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest peer progress and final outside the task fold without exposing old replies', () => {
    const task = {...completedTurn([{id:'user',kind:'userMessage',text:'Task'}]),id:'task'} as ThreadTurnDto;
    const peer: ThreadTurnDto = {...completedTurn([
      {id:'wake:user',kind:'userMessage',text:'Wake envelope',peerWork:{taskTurnId:'task',messages:[{id:'q',kind:'question',name:'Reviewer',subject:'Scope?'}]}},
      {id:'progress',kind:'agentMessage',text:'Latest peer progress',responsePhase:'commentary'},
    ]),id:'wake',status:'inProgress'};
    const props = {liveOutput:'',onLoadTurnDetail:vi.fn()};
    const el = render(<ThreadTimeline {...props} turns={[task,peer]} threadRunning activeTurnId="wake" />);
    expect(el.textContent).toContain('Latest peer progress');
    expect(el.querySelectorAll('.thread-peer-work-toggle')).toHaveLength(0);
    const next = {...peer,items:[...peer.items,{id:'new',kind:'agentMessage' as const,text:'New progress replaces old',responsePhase:'commentary' as const}]};
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[task,next]} threadRunning activeTurnId="wake" />));
    expect(el.textContent).toContain('New progress replaces old');
    expect(el.textContent).not.toContain('Latest peer progress');
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[task,{...next,status:'completed',items:[...next.items,{id:'final',kind:'agentMessage',text:'Final peer result',responsePhase:'final'}]}]} />));
    expect(el.textContent).toContain('Final peer result');
    expect(el.textContent).not.toContain('New progress replaces old');
  });

  it.each([
    ['inProgress', 'Working', '工作中'],
    ['recovering', 'Confirming status', '正在确认状态'],
    ['completed', 'Worked for 1m 12s', '工作了 1 分钟 12 秒'],
  ] as const)('refreshes the %s worked label with identical memoized props', (status, english, chinese) => {
    setLocale('en', false);
    const turn = { ...completedTurn([
      { id: 'prompt', kind: 'userMessage' as const, text: 'Keep this user message' },
      { id: 'tool', kind: 'commandExecution' as const, text: 'pwd', status: 'completed' },
      { id: 'reply', kind: 'agentMessage' as const, text: 'Keep this model reply' },
    ]), status, completedAt: '2026-07-03T20:12:11Z' };
    const element = render(<ThreadTimeline turns={[turn]} liveOutput="" autoCollapseCompletedTurns={false} />);
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(english);
    // Do not rerender or replace turn/props: the external locale subscription must update memo rows.
    flushSync(() => setLocale('zh-CN', false));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(chinese);
    expect(element.textContent).toContain('Keep this user message');
    expect(element.textContent).toContain('Keep this model reply');
    flushSync(() => setLocale('en', false));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(english);
  });

  it('lazy-loads a complete collapsed turn and keeps Worked below the user message', async () => {
    let resolveTurn!: (turn: ThreadTurnDto) => void;
    const onLoadTurnDetail = vi.fn(
      () =>
        new Promise<ThreadTurnDto>((resolve) => {
          resolveTurn = resolve;
        }),
    );
    const summaryTurn: ThreadTurnDto = {
      ...completedTurn([
        {
          id: 'user-1',
          kind: 'userMessage',
          text: 'Keep the original prompt.',
          createdAt: '2026-07-03T20:10:59.000Z',
        },
        {
          id: 'agent-final',
          kind: 'agentMessage',
          text: 'Final answer.',
          createdAt: '2026-07-03T21:19:00.000Z',
        },
      ]),
      hasDeferredItems: true,
      deferredItemCount: 3,
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        onLoadTurnDetail={onLoadTurnDetail}
        turns={[summaryTurn]}
      />,
    );

    expect(element.textContent).toContain('Keep the original prompt.');
    expect(element.textContent).toContain('Final answer.');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('3 steps');
    expect(element.textContent).not.toContain('Intermediate checkpoint.');
    const initialText = element.textContent ?? '';
    expect(initialText.indexOf('Keep the original prompt.')).toBeLessThan(
      initialText.indexOf('Worked for'),
    );

    const expandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => expandButton?.click());
    expect(onLoadTurnDetail).toHaveBeenCalledWith('turn-1');
    expect(element.textContent).toContain('Loading complete history...');

    resolveTurn({
      ...summaryTurn,
      hasDeferredItems: false,
      deferredItemCount: 0,
      items: [
        summaryTurn.items[0]!,
        {
          id: 'agent-progress',
          kind: 'agentMessage',
          text: 'Intermediate checkpoint.',
          createdAt: '2026-07-03T20:20:00.000Z',
        },
        {
          id: 'reasoning-1',
          kind: 'reasoning',
          text: 'Reasoning retained after hydration.',
          createdAt: '2026-07-03T20:21:00.000Z',
        },
        {
          id: 'command-1',
          kind: 'commandExecution',
          text: 'pnpm test',
          status: 'completed',
          createdAt: '2026-07-03T20:22:00.000Z',
        },
        summaryTurn.items[1]!,
      ],
    });

    await vi.waitFor(() => {
      expect(element.textContent).toContain('Intermediate checkpoint.');
    });
    const expandedText = element.textContent ?? '';
    expect(expandedText.indexOf('Keep the original prompt.')).toBeLessThan(
      expandedText.indexOf('Worked for'),
    );
    expect(expandedText.indexOf('Worked for')).toBeLessThan(
      expandedText.indexOf('Intermediate checkpoint.'),
    );
    expect(expandedText).toContain('Final answer.');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('3 steps');

    const collapseButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Collapse turn 1'),
    );
    flushSync(() => collapseButton?.click());
    const cachedExpandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => cachedExpandButton?.click());
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Intermediate checkpoint.');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('3 steps');
  });

  it('counts work steps individually even when commands are grouped and reasoning is hidden', () => {
    shellSettings.showReasoningSummaries = false;
    const element = render(<ThreadTimeline autoCollapseCompletedTurns liveOutput="" turns={[{
      ...completedTurn([
        {id:'prompt',kind:'userMessage',text:'Check the reports'},
        {id:'progress',kind:'agentMessage',text:'Checking reports'},
        {id:'thought',kind:'reasoning',text:'Hidden reasoning'},
        {id:'command-1',kind:'commandExecution',text:'Read A',status:'completed'},
        {id:'command-2',kind:'commandExecution',text:'Read B',status:'completed'},
        {id:'answer',kind:'agentMessage',text:'Final answer'},
      ]), hasDeferredItems:false, deferredItemCount:0,
    }]} />);
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('4 steps');
    const expand = element.querySelector<HTMLButtonElement>('[aria-label*="Expand turn 1"]')!;
    expect(expand).not.toBeNull();
    flushSync(() => expand.click());
    expect(element.textContent).toContain('2 commands');
    expect(element.textContent).not.toContain('Hidden reasoning');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('4 steps');
  });

  it('keeps overlapping live and deferred steps stable through repeated expansion and summary refreshes', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Check progress' }]),
      status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const command = { id: 'command', kind: 'commandExecution' as const, text: 'Check inbox', status: 'completed' };
    const full = { ...summary, hasDeferredItems: false, deferredItemCount: 0, items: [...summary.items, command] };
    const onLoadTurnDetail = vi.fn().mockResolvedValue(full);
    const props = { threadRunning: true, activeTurnId: summary.id, liveOutput: '', onLoadTurnDetail };
    const element = render(<ThreadTimeline {...props} turns={[summary]} liveItems={{ turnId: summary.id, items: [command] }} />);
    const count = () => element.querySelector('.thread-execution-step-count')?.textContent;
    const toggle = (label: string) => flushSync(() => element.querySelector<HTMLButtonElement>(`[aria-label*="${label} turn 1"]`)!.click());
    expect(count()).toBe('1 steps');
    toggle('Expand');
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    expect(count()).toBe('1 steps');
    toggle('Collapse');
    const nextCommand = { ...command, id: 'next-command', text: 'Read report' };
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...summary, deferredItemCount: 2 }]}
      liveItems={{ turnId: summary.id, items: [command, nextCommand] }} />));
    expect(count()).toBe('2 steps');
    onLoadTurnDetail.mockResolvedValue({ ...full, items: [...full.items, nextCommand] });
    toggle('Expand');
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    expect(count()).toBe('2 steps');
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...summary, deferredItemCount: 2 }]}
      liveItems={{ turnId: summary.id, items: [{ ...nextCommand, status: 'completed' }] }} />));
    expect(count()).toBe('2 steps');
  });

  it('defers running operations until expansion and merges later summary messages', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Live prompt' },
        { id: 'answer', kind: 'agentMessage', text: 'First checkpoint' }]),
      status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const full = {...summary, hasDeferredItems:false, items:[summary.items[0]!,
      {id:'operation',kind:'commandExecution',text:'unique-hidden-command',status:'completed'}, summary.items[1]!]};
    const onLoadTurnDetail = vi.fn().mockResolvedValue(full);
    const props = {onLoadTurnDetail, liveOutput:'', threadRunning:true, activeTurnId:'turn-1'};
    const element = render(<ThreadTimeline {...props} turns={[summary]} />);
    expect(onLoadTurnDetail).not.toHaveBeenCalled();
    expect(element.textContent).toContain('First checkpoint');
    const toggle = () => Array.from(element.querySelectorAll('button')).find(button => /Expand turn 1/.test(button.getAttribute('aria-label') ?? ''))!;
    expect(toggle()).toBeTruthy();
    flushSync(() => toggle().click());
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{...summary, items:[summary.items[0]!, {...summary.items[1]!, text:'Later checkpoint'}]}]} />));
    expect(element.textContent).toContain('Later checkpoint');
    expect(element.textContent).not.toContain('First checkpoint');
    onLoadTurnDetail.mockResolvedValue({...full, status:'completed', items:[...full.items.slice(0,-1), {...summary.items[1]!,text:'Final checkpoint'}]});
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{...summary,status:'completed',items:[summary.items[0]!, {...summary.items[1]!,text:'Final checkpoint'}]}]} />));
    await vi.waitFor(() => expect(onLoadTurnDetail).toHaveBeenCalledTimes(2));
    expect(element.textContent).toContain('Final checkpoint');
  });

  it.each([false, true])('keeps the latest live narration outside folded history with background=%s', (background) => {
    const prompt = { id: 'prompt', kind: 'userMessage' as const, text: 'Check progress' };
    const first = { id: 'first', kind: 'agentMessage' as const, text: 'First checkpoint', responsePhase: 'commentary' as const };
    const command = { id: 'command', kind: 'commandExecution' as const, text: 'hidden-operation', status: 'completed' };
    const wait = { id: 'wait', kind: 'other' as const, origin: 'nativeBackgroundWait' as const, text: '', status: 'waiting' };
    const turn = { ...completedTurn([prompt, first, command, ...(background ? [wait] : [])]), status: 'inProgress' as const };
    const props = { onLoadTurnDetail: vi.fn(), liveOutput: '', threadRunning: true, activeTurnId: turn.id };
    const element = render(<ThreadTimeline {...props} turns={[turn]} />);
    const update = (items: ThreadTurnDto['items']) => flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...turn, items }]} />));
    expect(element.textContent).toContain(first.text);
    expect(element.textContent).not.toContain(command.text);
    const next = { id: 'next', kind: 'agentMessage' as const, text: '', status: 'inProgress', responsePhase: 'commentary' as const };
    update([...turn.items, next]);
    expect(element.textContent).toContain(first.text);
    const progress = { ...next, text: 'Checking the next result' };
    update([...turn.items, progress]);
    expect(element.textContent).not.toContain(first.text);
    expect(element.textContent).toContain(progress.text);
    update([...turn.items, { ...progress, text: 'Checking the next result now' }, { ...command, id: 'later-command', status: 'running' }]);
    expect(element.textContent).toContain('Checking the next result now');
    expect(element.querySelector('.thread-execution-timeline')).toBeNull();
    expect(props.onLoadTurnDetail).not.toHaveBeenCalled();
  });

  it('keeps substantial answers between independently folded work sections as progress continues', () => {
    const answer = { id: 'answer', kind: 'agentMessage' as const, text: '## Public-key identity\n\n' + '设备独立验证签名，私钥保存在用户手中。'.repeat(40), status: 'completed' };
    const command = (id: string) => ({ id, kind: 'commandExecution' as const, text: `hidden-${id}`, status: 'completed' });
    const initial = { ...completedTurn([
      { id: 'prompt', kind: 'userMessage' as const, text: 'Explain and implement' },
      command('before'), answer, command('after'),
    ]), status: 'inProgress' as const };
    const props = { liveOutput: '', threadRunning: true, activeTurnId: initial.id, onLoadTurnDetail: vi.fn() };
    const element = render(<ThreadTimeline {...props} turns={[initial]} />);
    expect(element.textContent).toContain('Public-key identity');
    expect(element.querySelectorAll('.thread-answer-section')).toHaveLength(1);
    expect(element.querySelectorAll('.thread-answer-sequence > .thread-execution-timeline')).toHaveLength(2);
    expect(element.textContent).not.toContain('hidden-before');
    expect(element.textContent).not.toContain('hidden-after');
    const progress = { id: 'progress', kind: 'agentMessage' as const, text: 'Running the integration checks', status: 'running' };
    const updated = { ...initial, items: [...initial.items, progress] };
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[updated]} />));
    expect(element.textContent).toContain('Public-key identity');
    expect(element.textContent).toContain(progress.text);
    expect(element.querySelectorAll('.thread-answer-section')).toHaveLength(2);
    // Open just the work after the answer. Earlier operations stay folded.
    flushSync(() => element.querySelectorAll<HTMLButtonElement>('.thread-answer-sequence .thread-graph-history-group-toggle')[1]!.click());
    expect(element.textContent).toContain('hidden-after');
    expect(element.textContent).not.toContain('hidden-before');
    const sections = [...element.querySelectorAll('.thread-answer-sequence > *')];
    expect(sections[1]!.textContent).toContain('Public-key identity');
    expect(sections[2]!.textContent).toContain('hidden-after');
    expect(props.onLoadTurnDetail).not.toHaveBeenCalled();
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{
      ...updated, status: 'completed', items: [...updated.items, { id: 'final', kind: 'agentMessage', text: 'Implementation complete', responsePhase: 'final' }],
    }]} />));
    expect(element.textContent).toContain('Public-key identity');
    expect(element.textContent).toContain('Implementation complete');
    expect(element.querySelectorAll('.thread-answer-section')).toHaveLength(2);
  });

  it('shows preserved long answers in a lazy summary without loading command histories', () => {
    const answer = { id: 'answer', kind: 'agentMessage' as const, text: 'Long answer. '.repeat(60) };
    const load = vi.fn();
    const element = render(<ThreadTimeline liveOutput="" onLoadTurnDetail={load} autoCollapseCompletedTurns turns={[{
      ...completedTurn([answer, { id: 'last', kind: 'agentMessage', text: 'Done', responsePhase: 'final' }]),
      hasDeferredItems: true, deferredItemCount: 20,
    }]} />);
    expect(element.textContent).toContain('Long answer.');
    expect(element.textContent).toContain('Done');
    expect(element.querySelectorAll('.thread-answer-section')).toHaveLength(2);
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the final status when a collapsed turn has cached running details', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Check status' },
        { id: 'reply', kind: 'agentMessage', text: 'Checking' },
      ]), status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const onLoadTurnDetail = vi.fn().mockResolvedValue({ ...summary,
      hasDeferredItems: false, deferredItemCount: 0,
      items: [summary.items[0]!, { id: 'command', kind: 'commandExecution', text: 'read report', status: 'completed' }, summary.items[1]!],
    });
    const props = { liveOutput: '', onLoadTurnDetail };
    const element = render(<ThreadTimeline {...props} threadRunning activeTurnId="turn-1" turns={[summary]} />);
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label*="Expand turn 1"]')!.click());
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label*="Collapse turn 1"]')!.click());
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{
      ...summary, status: 'completed', completedAt: '2026-07-03T20:12:11Z',
      model: 'final-model', items: [summary.items[0]!, { ...summary.items[1]!, text: 'Finished' }],
    }]} />));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Worked for 1m 12s');
    expect(element.querySelector('.thread-graph-turn-footer')).toBeNull();
    expect(element.textContent).toContain('Finished');
    expect(element.textContent).toContain('final-model');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('1 steps');
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
  });

  it.each(['completed', 'failed', 'interrupted'] as const)('stops showing live activity after a turn is %s', (status) => {
    const operation = { id: 'command', kind: 'commandExecution' as const, text: 'read report', status: 'completed' };
    const turn = { ...completedTurn([{ id: 'prompt', kind: 'userMessage' as const, text: 'Check' }, operation,
      { id: 'reply', kind: 'agentMessage' as const, text: 'Finished' }]), status: 'inProgress' as const };
    const props = { liveOutput: '', autoCollapseCompletedTurns: false,
      liveItems: { turnId: turn.id, items: [operation] },
      livePlan: { turnId: turn.id, explanation: null, plan: [{ step: 'Read report', status: 'completed' as const }] },
    };
    const element = render(<ThreadTimeline {...props} threadRunning activeTurnId={turn.id} turns={[turn]} />);
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Working');
    expect(element.querySelector('.thread-graph-turn-footer')).not.toBeNull();
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null}
      turns={[{ ...turn, status, completedAt: '2026-07-03T20:12:11Z' }]} />));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Worked for 1m 12s');
    expect(element.querySelector('.thread-graph-turn-footer')).toBeNull();
    expect(element.textContent).toContain('Finished');
  });

  it('uses hydrated deferred flags so an empty expansion cannot show a stale step count', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Prompt' },
        { id: 'answer', kind: 'agentMessage', text: 'Answer' },
      ]),
      hasDeferredItems: true,
      deferredItemCount: 7,
    };
    const hydrated = {
      ...summary,
      hasDeferredItems: false,
      deferredItemCount: 0,
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        onLoadTurnDetail={vi.fn().mockResolvedValue(hydrated)}
        turns={[summary]}
      />,
    );

    const expand = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => expand?.click());
    await vi.waitFor(() => {
      expect(element.textContent).not.toContain('7 steps');
    });
    expect(element.textContent).toContain('Worked');
  });

  it('shows Worked when reasoning is the collapsed middle agent bubble', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'reply me a 3',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
            {
              id: 'reasoning-1',
              kind: 'reasoning',
              text: 'The user asked for the exact number 3.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: '3',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('reply me a 3');
    expect(element.textContent).toContain('3');
    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'The user asked for the exact number 3.',
    );
    expect(
      Array.from(element.querySelectorAll('button')).some((button) =>
        button.getAttribute('aria-label')?.includes('Expand turn 1'),
      ),
    ).toBe(true);
  });

  it('shows Worked when an actual middle message bubble is collapsed', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'Keep prompt visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 0),
              ).toISOString(),
            },
            {
              id: 'agent-intermediate-1',
              kind: 'agentMessage',
              text: 'Intermediate note should collapse.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 20),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'Final reply stays visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 11, 21),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('Keep prompt visible.');
    expect(element.textContent).toContain('Final reply stays visible.');
    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'Intermediate note should collapse.',
    );
  });

  it('keeps the Worked control available after expanding so the turn can collapse again', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'Keep prompt visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 0),
              ).toISOString(),
            },
            {
              id: 'agent-intermediate-1',
              kind: 'agentMessage',
              text: 'Intermediate note can be toggled.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 20),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'Final reply stays visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 11, 21),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    const expandWorkedButton = Array.from(
      element.querySelectorAll('button'),
    ).find((button) =>
      button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    expect(expandWorkedButton).toBeTruthy();
    flushSync(() => {
      expandWorkedButton?.click();
    });

    expect(element.textContent).toContain('Intermediate note can be toggled.');
    const collapseWorkedButton = Array.from(
      element.querySelectorAll('button'),
    ).find(
      (button) =>
        button.getAttribute('aria-label')?.includes('Collapse turn 1') &&
        button.textContent?.includes('Worked'),
    );
    expect(collapseWorkedButton?.textContent).toContain('Worked');

    flushSync(() => {
      collapseWorkedButton?.click();
    });

    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'Intermediate note can be toggled.',
    );
  });

  it('shows relative tool time and a permanent precise agent timestamp', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const agentAt = new Date(Date.UTC(2026, 6, 3, 20, 11, 21)).toISOString();
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          {
            ...completedTurn([
              {
                id: 'user-1',
                kind: 'userMessage',
                text: 'Inspect.',
                createdAt: startedAt,
              },
              {
                id: 'command-1',
                kind: 'commandExecution',
                text: 'pwd',
                createdAt: new Date(
                  Date.UTC(2026, 6, 3, 20, 10, 5),
                ).toISOString(),
                status: 'completed',
              },
              {
                id: 'agent-1',
                kind: 'agentMessage',
                text: 'Done.',
                createdAt: agentAt,
              },
            ]),
            startedAt,
          },
        ]}
      />,
    );

    expect(element.textContent).toContain('5s');
    expect(element.textContent).toContain(
      formatPreciseMessageTimestamp(agentAt),
    );

    const agentTime = Array.from(
      element.querySelectorAll('.thread-graph-message-time-row'),
    ).find(
      (node) => node.textContent === formatPreciseMessageTimestamp(agentAt),
    );
    expect(agentTime).toBeTruthy();

  });

  it('shows the latest activity time and a second-precision running duration', () => {
    vi.useFakeTimers();
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const activityAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 7)).toISOString();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 3, 20, 10, 10)));

    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        activeTurnId="turn-1"
        threadRunning
        liveOutput=""
        liveItems={{
          turnId: 'turn-1',
          updatedAt: activityAt,
          items: [
            {
              id: 'command-1',
              kind: 'commandExecution',
              text: 'pnpm test',
              status: 'running',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 5),
              ).toISOString(),
            },
          ],
        }}
        turns={[
          {
            id: 'turn-1',
            startedAt,
            status: 'inProgress',
            error: null,
            items: [],
          },
        ]}
      />,
    );

    expect(element.querySelector('.thread-progress-indicator')?.getAttribute('aria-label')).toContain(formatLongTimestamp(activityAt));
    expect(element.textContent).toContain('10s');

    flushSync(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(element.textContent).toContain('11s');
  });

  it('uses the completion time and labels an interrupted turn', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const completedAt = new Date(
      Date.UTC(2026, 6, 3, 20, 22, 30),
    ).toISOString();
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns
        liveOutput=""
        turns={[
          {
            id: 'turn-1',
            startedAt,
            completedAt,
            status: 'interrupted',
            error: null,
            items: [
              {
                id: 'user-1',
                kind: 'userMessage',
                text: 'Run the long task.',
                createdAt: startedAt,
              },
            ],
          },
        ]}
      />,
    );

    expect(element.textContent).toContain('Worked for 12m 30s');
    expect(element.textContent).toContain('Interrupted');
  });

  it('keeps operations collapsed in the workbench while assistant prose stays visible', () => {
    const element = render(
      <WorkbenchContext.Provider value={true}><ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          completedTurn([
            ...['pwd', 'pnpm test', 'git status'].map((text, index) => ({
              id: `command-${index + 1}`,
              kind: 'commandExecution' as const,
              text,
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, index + 1),
              ).toISOString(),
              status: 'completed',
            })),
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'All commands completed.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 5),
              ).toISOString(),
            },
          ]),
        ]}
      /></WorkbenchContext.Provider>,
    );

    expect(element.querySelector('.thread-graph-history-group-activity')).toBeNull();
    const commands = element.querySelector('.thread-graph-history-group-command')!;
    expect(commands.querySelector('.thread-graph-history-group-time')?.textContent).toBe('2s');
    expect(commands.textContent).toContain('3 commands');
    expect(element.textContent).not.toContain('pnpm test');
    expect(element.textContent).not.toContain('Agent activity');
    expect(element.textContent).not.toContain('Batch');
    expect(element.textContent).toContain('All commands completed.');
  });

  it('folds imported reasoning summaries into activity and omits empty assistant rows', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'agent-before',
              kind: 'agentMessage',
              text: 'The first finding is ready.',
            },
            {
              id: 'reasoning-1',
              kind: 'reasoning',
              text: '**Planning concurrent browser inspection**',
            },
            {
              id: 'reasoning-empty',
              kind: 'reasoning',
              text: '  ',
            },
            {
              id: 'command-1',
              kind: 'commandExecution',
              text: 'pnpm test',
              status: 'completed',
            },
            {
              id: 'reasoning-2',
              kind: 'reasoning',
              text: '**Checking item timestamps, statuses, and duplicates**',
            },
            {
              id: 'agent-after',
              kind: 'agentMessage',
              text: 'The imported session now reads cleanly.',
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('The first finding is ready.');
    expect(element.textContent).not.toContain('Performed');
    expect(element.textContent).toContain('3 steps');
    expect(element.textContent).toContain(
      'The imported session now reads cleanly.',
    );
    expect(element.textContent).not.toContain(
      'Planning concurrent browser inspection',
    );
    expect(
      Array.from(element.querySelectorAll('[data-role="assistant"]')),
    ).toHaveLength(2);

    const expandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Expand 3 operations',
    );
    expect(expandButton).toBeTruthy();
    flushSync(() => {
      expandButton?.click();
    });
    expect(element.textContent).toContain(
      'Planning concurrent browser inspection',
    );
    expect(element.textContent).toContain(
      'Checking item timestamps, statuses, and duplicates',
    );
  });

  it('preserves activity and command expansion choices as live entries arrive', () => {
    const activeTurn: ThreadTurnDto = {
      ...completedTurn([]),
      status: 'inProgress',
    };
    const initialItems: ThreadTurnDto['items'] = [
      { id: 'reason-1', kind: 'reasoning', text: 'Inspecting the first issue.' },
      { id: 'command-1', kind: 'commandExecution', text: 'pwd', status: 'completed' },
      { id: 'command-2', kind: 'commandExecution', text: 'git status', status: 'running' },
    ];
    const timeline = (items: ThreadTurnDto['items']) => (
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        activeTurnId={activeTurn.id}
        threadRunning
        liveOutput=""
        liveItems={{ turnId: activeTurn.id, items, updatedAt: activeTurn.startedAt }}
        turns={[activeTurn]}
      />
    );
    const element = render(timeline(initialItems));
    const activityToggle = () => element.querySelector<HTMLButtonElement>(
      '.thread-graph-history-group-activity button[aria-expanded]',
    );
    const commandToggle = () => element.querySelector<HTMLButtonElement>(
      '.thread-graph-history-group-command button[aria-expanded]',
    );

    flushSync(() => activityToggle()?.click());
    flushSync(() => commandToggle()?.click());
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(commandToggle()?.getAttribute('aria-expanded')).toBe('true');

    const nextItems: ThreadTurnDto['items'] = [
      ...initialItems,
      { id: 'command-3', kind: 'commandExecution', text: 'pnpm test', status: 'running' },
      { id: 'reason-2', kind: 'reasoning', text: 'Reviewing the new result.' },
    ];
    flushSync(() => root?.render(timeline(nextItems)));
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(commandToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('Inspecting the first issue.');
    expect(element.textContent).toContain('Reviewing the new result.');
    expect(element.querySelector('[aria-label="Open grouped command 3"]')?.textContent)
      .toContain('pnpm test');

    flushSync(() => activityToggle()?.click());
    flushSync(() => root?.render(timeline([
      ...nextItems,
      { id: 'reason-3', kind: 'reasoning', text: 'Preparing the next step.' },
    ])));
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(element.textContent).not.toContain('Preparing the next step.');
    flushSync(() => activityToggle()?.click());
    expect(element.textContent).toContain('Preparing the next step.');
    expect(commandToggle()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows file paths directly without opening a summary or details pane', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const fileReadAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 5)).toISOString();
    const laterAgentAt = new Date(
      Date.UTC(2026, 6, 3, 20, 10, 8),
    ).toISOString();
    const activeTurn: ThreadTurnDto = {
      ...completedTurn([
        {
          id: 'user-1',
          kind: 'userMessage',
          text: 'Inspect the source.',
          createdAt: startedAt,
        },
        {
          id: 'file-read-1',
          kind: 'fileRead',
          text: 'Read file: src/agent-runtime.ts',
          previewText: 'Read file: src/agent-runtime.ts',
          createdAt: fileReadAt,
          status: 'running',
        },
      ]),
      startedAt,
      status: 'inProgress',
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[activeTurn]}
      />,
    );

    expect(element.textContent).toContain('Read');
    expect(element.textContent).toContain('Read file: src/agent-runtime.ts');
    expect(
      Array.from(element.querySelectorAll('button'))
        .find((button) =>
          button.getAttribute('aria-label') === 'Show full file path',
        )
        ?.getAttribute('aria-expanded'),
    ).toBe('false');

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          autoCollapseCompletedTurns={false}
          liveOutput=""
          turns={[
            {
              ...activeTurn,
              items: [
                ...activeTurn.items.map((item) =>
                  item.id === 'file-read-1'
                    ? { ...item, status: 'completed' }
                    : item,
                ),
                {
                  id: 'agent-1',
                  kind: 'agentMessage',
                  text: 'I found the next step.',
                  createdAt: laterAgentAt,
                },
              ],
            },
          ]}
        />,
      );
    });

    expect(element.textContent).toContain('Read');
    expect(
      Array.from(element.querySelectorAll('button'))
        .find((button) =>
          button.getAttribute('aria-label') === 'Show full file path',
        )
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(element.textContent).toContain('I found the next step.');
  });

  it('advances across turns on repeated clicks while smooth scrolling is pending', () => {
    const turns = [1, 2, 3].map((index) => ({
      ...completedTurn([
        {
          id: `user-${index}`,
          kind: 'userMessage' as const,
          text: `Prompt ${index}`,
        },
      ]),
      id: `turn-${index}`,
    }));
    const element = render(
      <ThreadTimeline
        liveOutput=""
        turns={turns}
        nextTurnScrollRequestKey={0}
      />,
    );
    const scrollContainer = element.querySelector<HTMLElement>(
      '[data-testid="thread-scroll-container"]',
    )!;
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 0,
    });
    scrollContainer.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
    const turnElements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-timeline-turn]'),
    );
    turnElements.forEach((turn, index) => {
      turn.getBoundingClientRect = () =>
        ({
          top: index * 200,
          bottom: index * 200 + 100,
          height: 100,
        }) as DOMRect;
    });
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          nextTurnScrollRequestKey={1}
        />,
      );
    });
    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          nextTurnScrollRequestKey={2}
        />,
      );
    });

    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      top: 192,
      behavior: 'smooth',
    });
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      top: 392,
      behavior: 'smooth',
    });
  });

  it('moves backward across turns on repeated clicks while smooth scrolling is pending', () => {
    const turns = [1, 2, 3].map((index) => ({
      ...completedTurn([
        {
          id: `user-${index}`,
          kind: 'userMessage' as const,
          text: `Prompt ${index}`,
        },
      ]),
      id: `turn-${index}`,
    }));
    const element = render(
      <ThreadTimeline
        liveOutput=""
        turns={turns}
        previousTurnScrollRequestKey={0}
      />,
    );
    const scrollContainer = element.querySelector<HTMLElement>(
      '[data-testid="thread-scroll-container"]',
    )!;
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 600,
    });
    scrollContainer.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
    const turnElements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-timeline-turn]'),
    );
    turnElements.forEach((turn, index) => {
      turn.getBoundingClientRect = () =>
        ({
          top: -400 + index * 200,
          bottom: -300 + index * 200,
          height: 100,
        }) as DOMRect;
    });
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          previousTurnScrollRequestKey={1}
        />,
      );
    });
    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          previousTurnScrollRequestKey={2}
        />,
      );
    });

    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      top: 392,
      behavior: 'smooth',
    });
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      top: 192,
      behavior: 'smooth',
    });
  });
});
