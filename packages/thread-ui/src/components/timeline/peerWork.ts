import type { TimelineTurn } from './timelineItems';
import type { ThreadPeerWorkDto, ThreadTurnDto, ThreadHistoryItemDto, ThreadTurnTokenBreakdownDto } from '@pockymoe/shared';

export function peerWorkForTurn(turn: Pick<ThreadTurnDto, 'items'>): ThreadPeerWorkDto | null {
  const context = turn.items.find(item => item.kind === 'userMessage' && item.peerWork)?.peerWork;
  return context?.messages.length ? context : null;
}

// A real user request is a boundary. A continuation whose parent is not loaded
// stays visible as its own task until pagination brings that parent into view.
export function groupPeerWorkTurns(turns: ThreadTurnDto[]) {
  const groups: Array<{ turn: ThreadTurnDto; continuations: ThreadTurnDto[]; index: number }> = [];
  for (const [index, turn] of turns.entries()) {
    const context = peerWorkForTurn(turn);
    const parent = groups.at(-1);
    if (context && parent?.turn.id === context.taskTurnId) parent.continuations.push(turn);
    else groups.push({ turn, continuations: [], index });
  }
  return groups;
}

export function peerWorkPreview(turn: ThreadTurnDto, liveItems?: ThreadHistoryItemDto[] | null) {
  const messages = new Map(turn.items.map(item => [item.id, item]));
  for (const item of liveItems ?? []) messages.set(item.id, item);
  const latest = [...messages.values()].findLast((item): item is ThreadHistoryItemDto & { kind: 'agentMessage' } => item.kind === 'agentMessage' && Boolean(item.text.trim()));
  return turn.status === 'inProgress' || turn.status === 'recovering' || latest?.responsePhase !== 'commentary' ? latest ?? null : null;
}

export function aggregatePeerWorkTurn(root: TimelineTurn, continuations: ThreadTurnDto[]): TimelineTurn {
  if (!continuations.length) return root;
  const parts = [root, ...continuations];
  const last = parts.at(-1)!;
  const totals = parts.map(turn => turn.tokenUsage?.total);
  const prices = parts.map(turn => turn.priceEstimate);
  const sum = (key: keyof ThreadTurnTokenBreakdownDto) => totals.reduce((value, total) => value + (total?.[key] ?? 0), 0);
  const total = totals.every(value => value != null) ? {
    inputTokens: totals.reduce((sum, value) => sum + value!.inputTokens, 0),
    outputTokens: totals.reduce((sum, value) => sum + value!.outputTokens, 0),
    totalTokens: totals.reduce((sum, value) => sum + value!.totalTokens, 0),
    cachedInputTokens: sum('cachedInputTokens'), reasoningOutputTokens: sum('reasoningOutputTokens'), cacheWriteInputTokens: sum('cacheWriteInputTokens'), cacheWriteOneHourInputTokens: sum('cacheWriteOneHourInputTokens'),
  } : null;
  return {
    ...root, status: last.status, completedAt: last.completedAt,
    tokenUsage: total ? { total, last: last.tokenUsage?.last ?? total, modelContextWindow: last.tokenUsage?.modelContextWindow ?? null } : null,
    priceEstimate: prices.every(price => price?.currency === 'USD') ? {
      ...prices[0]!, ...Object.fromEntries(['totalUsd', 'inputUsd', 'cachedInputUsd', 'cacheWriteInputUsd', 'outputUsd'].map(key => [key, prices.reduce((sum, price) => sum + (price![key as keyof typeof price] as number ?? 0), 0)])),
    } : null,
    error: last.error,
  };
}
