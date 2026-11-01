import { translate } from '../../i18n';
import type { MapScope } from './types';
import type { ThreadTurnPriceEstimateDto, ThreadTurnTokenBreakdownDto } from '@pockymoe/shared';

export type ThreadMapPrice = Pick<ThreadTurnPriceEstimateDto, 'inputUsd' | 'cachedInputUsd' | 'cacheWriteInputUsd' | 'outputUsd' | 'totalUsd'>;

/** One conversation on the map: a root thread with its agent threads folded in. */
export interface ThreadMapThread {
  key: string;
  title: string;
  href: string;
  /** Theme agent key (`codex`, `claude`, …), see themeAgentKey. */
  agent?: string | undefined;
  agentName?: string | undefined;
  running: boolean;
  needsInput?: { kind: 'approval' | 'input'; summary?: string; requestId?: string };
  unread?: boolean;
  pinned?: boolean;
  shortcut?: boolean;
  /** Turns ever started, agent threads included; null when the device cannot say. */
  turns: number | null;
  /** Time turns ran inside the activity window; null when the device cannot say. */
  activeMs: number | null;
  /** Time every turn ever ran; null when the device cannot say. */
  totalMs?: number | null | undefined;
  /** The window's running time hour by hour, oldest first. */
  hourlyMs?: number[] | undefined;
  createdAt?: string | undefined;
  /** When a turn last started or finished. */
  lastActiveAt?: string | undefined;
  model?: string | undefined;
  /** The person's latest prompt. */
  lastPrompt?: string | undefined;
  /** The last turn failed. */
  failed?: boolean | undefined;
  /** The last turn was interrupted. */
  interrupted?: boolean | undefined;
  /** Tokens of every turn, agent threads included. */
  tokenUsage?: ThreadTurnTokenBreakdownDto | undefined;
  /** The API price of those tokens. */
  priceEstimate?: ThreadMapPrice | undefined;
  /** Some turns had no known price; the price leaves them out. */
  pricePartial?: boolean | undefined;
  /** Agent threads this one started, each on its own; shown when the tile is opened up. */
  children?: ThreadMapThread[] | undefined;
  /** Agent threads folded into this one. */
  agentThreads?: number | undefined;
  /**
   * For an agent thread on a tile of its own (it works in another workspace than
   * its conversation): the title of the thread that started it.
   */
  from?: string | undefined;
}
export interface ThreadMapWorkspace { id: string; label: string; href?: string | undefined; path?: string | undefined; threads: ThreadMapThread[] }
export interface ThreadMapDevice {
  id: string;
  name: string;
  /** The device's workspace list. */
  href?: string | undefined;
  state: 'ready' | 'loading' | 'offline' | 'error';
  /** Last successful snapshot, shown when opening an offline device. */
  cachedAt?: string;
  error?: string | null | undefined;
  workspaces: ThreadMapWorkspace[];
}

export interface MapNode {
  id: string;
  kind: 'root' | 'device' | 'workspace' | 'thread' | 'compressed';
  compressed?: 'threads' | 'workspaces';
  /** Scoped-out nodes retained for merged readability overflow previews. */
  hiddenNodes?: MapNode[];
  label: string;
  parent?: MapNode | undefined;
  children: MapNode[];
  weight: number;
  turns: number;
  activeMs: number;
  threads: number;
  running: number;
  /** API price and tokens of everything inside. */
  usd: number;
  tokens: number;
  thread?: ThreadMapThread;
  device?: ThreadMapDevice;
  workspace?: ThreadMapWorkspace;
}

/** Area grows with the number of turns, gently: a thread of 100 turns is about
 *  six times one of a single turn, so a long thread does not hide the rest. */
export const threadWeight = (turns: number | null) => 1 + Math.sqrt(Math.max(0, turns ?? 0));

/** A running thread (or one whose agent threads run) weighs as much as a long
 *  one at least, so it, its workspace and its device get room to show it. */
export const runningWeight = (turns: number | null) => threadWeight(turns) * 2 + 8;

const MINUTE = 60_000;
/** Heat 0–4 from the running time in the window, like a contribution graph:
 *  none, up to 10 minutes, up to an hour, up to three hours, more. */
export function heatLevel(activeMs: number | null | undefined) {
  const ms = activeMs ?? 0;
  if (ms <= 0) return 0;
  if (ms <= 10 * MINUTE) return 1;
  if (ms <= 60 * MINUTE) return 2;
  if (ms <= 180 * MINUTE) return 3;
  return 4;
}

const byWeight = (a: MapNode, b: MapNode) => b.weight - a.weight || a.label.localeCompare(b.label);

/**
 * The map's tree: devices, their workspaces, their threads. With one device the
 * device is the root. A device that cannot list its threads still gets a small
 * block so it is not silently missing.
 */
export interface MapBuildOptions {
  scope?: MapScope | undefined;
  /** Page v3 scope filters old unread history too; dialog keeps its old policy. */
  dense?: boolean;
  now?: number;
  expandedWorkspaces?: ReadonlySet<string>;
  expandedDevices?: ReadonlySet<string>;
  keepDeviceRoot?: boolean;
}

const DAY = 86_400_000;
export function isLive(thread: ThreadMapThread): boolean {
  return thread.running || Boolean(thread.children?.some(isLive));
}
export function isWaiting(thread: ThreadMapThread): boolean {
  return Boolean(thread.needsInput || thread.children?.some(isWaiting));
}
export function inScope(thread: ThreadMapThread, scope: MapScope, now: number): boolean {
  if (scope === 'all' || isLive(thread) || isWaiting(thread) || thread.unread) return true;
  if (thread.children?.some(child => inScope(child, scope, now))) return true;
  const age = now - Date.parse(thread.lastActiveAt ?? '');
  return Number.isFinite(age) && age <= (scope === 'active' ? DAY : 7 * DAY);
}
export function recencyWeight(thread: ThreadMapThread, now: number) {
  const age = now - Date.parse(thread.lastActiveAt ?? '');
  const factor = age <= DAY ? 1 : age <= 7 * DAY ? 0.7 : 0.45;
  const weight = threadWeight(thread.turns) * factor;
  return isLive(thread) || isWaiting(thread) ? Math.max(weight, runningWeight(thread.turns)) : weight;
}

export function buildThreadMap(devices: readonly ThreadMapDevice[], rootLabel: string, options: MapBuildOptions = {}): MapNode {
  const blank = { children: [], weight: 0, turns: 0, activeMs: 0, threads: 0, running: 0, usd: 0, tokens: 0 };
  const root: MapNode = { ...blank, children: [], id: 'root', kind: 'root', label: rootLabel };
  const add = (into: MapNode, from: MapNode) => {
    into.weight += from.weight; into.turns += from.turns; into.activeMs += from.activeMs;
    into.threads += from.threads; into.running += from.running; into.usd += from.usd; into.tokens += from.tokens;
  };
  const now = options.now ?? Date.now();
  const deviceNodes = devices.filter(device => device.state !== 'offline').map(device => {
    const node: MapNode = { ...blank, children: [], id: `device:${device.id}`, kind: 'device', label: device.name, device };
    const hiddenSpaces: MapNode[] = [];
    for (const workspace of device.workspaces) {
      const space: MapNode = { ...blank, children: [], id: `workspace:${device.id}:${workspace.id}`, kind: 'workspace', label: workspace.label, parent: node, workspace, device };
      const hidden: MapNode[] = [];
      const expanded = options.expandedWorkspaces?.has(space.id) || options.expandedDevices?.has(node.id);
      for (const thread of workspace.threads) {
        const live = isLive(thread);
        const leaf: MapNode = {
          id: `thread:${thread.key}`, kind: 'thread', label: thread.title, parent: space, children: [], thread, device, workspace,
          weight: options.scope ? recencyWeight(thread, now) : live || isWaiting(thread) ? runningWeight(thread.turns) : threadWeight(thread.turns), turns: thread.turns ?? 0, activeMs: thread.activeMs ?? 0, threads: 1, running: live ? 1 : 0,
          usd: thread.priceEstimate?.totalUsd ?? 0, tokens: thread.tokenUsage?.totalTokens ?? 0,
        };
        if (options.scope && !expanded && !(options.dense && options.scope === 'active' ? isLive(thread) || isWaiting(thread) || now - Date.parse(thread.lastActiveAt ?? '') <= DAY : inScope(thread, options.scope, now))) hidden.push(leaf);
        else space.children.push(leaf);
        add(space, leaf);
      }
      if (options.dense) hidden.length = 0;
      if (!space.children.length && hidden.length) { space.hiddenNodes = hidden; hiddenSpaces.push(space); continue; }
      if (!space.children.length) continue;
      if (hidden.length) {
        const compressed: MapNode = { ...blank, id: `earlier:${space.id}`, kind: 'compressed', compressed: 'threads',
          label: translate('workbench.threadMapEarlier', { count: hidden.length }), children: [], hiddenNodes: hidden, parent: space, device, workspace, weight: 1.5, threads: hidden.length };
        space.children.push(compressed);
        space.weight = space.children.reduce((sum, child) => sum + child.weight, 0);
      }
      space.children.sort(byWeight);
      node.children.push(space);
      add(node, space);
    }
    if (hiddenSpaces.length) {
      const compressed: MapNode = { ...blank, id: `earlier:${node.id}`, kind: 'compressed', compressed: 'workspaces',
        label: translate('workbench.threadMapOtherWorkspaces', { count: hiddenSpaces.length }), parent: node, device, children: [], hiddenNodes: hiddenSpaces, weight: 1.5 };
      for (const hidden of hiddenSpaces) { compressed.turns += hidden.turns; compressed.threads += hidden.threads; compressed.usd += hidden.usd; compressed.tokens += hidden.tokens; }
      node.children.push(compressed); add(node, compressed);
    }
    node.children.sort(byWeight);
    return node;
  });
  const listed = deviceNodes.reduce((sum, node) => sum + node.weight, 0);
  // Unlisted devices take a sliver of the map, enough for their name.
  for (const node of deviceNodes) if (!node.weight) node.weight = Math.max(1, listed * 0.06);
  if (!options.keepDeviceRoot && deviceNodes.length === 1 && deviceNodes[0]!.device!.state === 'ready') {
    const only = deviceNodes[0]!;
    only.kind = 'root';
    return only;
  }
  for (const node of deviceNodes) { node.parent = root; add(root, node); }
  root.children = deviceNodes.sort((a, b) => Number(b.device!.state === 'ready') - Number(a.device!.state === 'ready') || byWeight(a, b));
  return root;
}

/** Every node by id, for drill-down that survives refreshes. */
export function indexMap(root: MapNode) {
  const nodes = new Map<string, MapNode>();
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    nodes.set(node.id, node);
    stack.push(...node.children);
    // Folded agents remain addressable for attention, filtering and external reveal.
    for (const thread of node.thread?.children ?? []) stack.push({
      ...node, id: `thread:${thread.key}`, kind: 'thread', label: thread.title, parent: node, children: [], thread,
      weight: threadWeight(thread.turns), turns: thread.turns ?? 0, activeMs: thread.activeMs ?? 0,
      threads: 1, running: isLive(thread) ? 1 : 0, usd: thread.priceEstimate?.totalUsd ?? 0, tokens: thread.tokenUsage?.totalTokens ?? 0,
    });
  }
  return nodes;
}
