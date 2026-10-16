/** One conversation on the map: a root thread with its agent threads folded in. */
export interface ThreadMapThread {
  key: string;
  title: string;
  href: string;
  /** Theme agent key (`codex`, `claude`, …), see themeAgentKey. */
  agent?: string | undefined;
  agentName?: string | undefined;
  running: boolean;
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
  /** Agent threads folded into this one. */
  agentThreads?: number | undefined;
}
export interface ThreadMapWorkspace { id: string; label: string; path?: string | undefined; threads: ThreadMapThread[] }
export interface ThreadMapDevice {
  id: string;
  name: string;
  state: 'ready' | 'loading' | 'offline' | 'error';
  error?: string | null | undefined;
  workspaces: ThreadMapWorkspace[];
}

export interface MapNode {
  id: string;
  kind: 'root' | 'device' | 'workspace' | 'thread';
  label: string;
  parent?: MapNode | undefined;
  children: MapNode[];
  weight: number;
  turns: number;
  activeMs: number;
  threads: number;
  running: number;
  thread?: ThreadMapThread;
  device?: ThreadMapDevice;
  workspace?: ThreadMapWorkspace;
}

/** Area grows with the number of turns, gently: a thread of 100 turns is about
 *  six times one of a single turn, so a long thread does not hide the rest. */
export const threadWeight = (turns: number | null) => 1 + Math.sqrt(Math.max(0, turns ?? 0));

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
export function buildThreadMap(devices: readonly ThreadMapDevice[], rootLabel: string): MapNode {
  const root: MapNode = { id: 'root', kind: 'root', label: rootLabel, children: [], weight: 0, turns: 0, activeMs: 0, threads: 0, running: 0 };
  const add = (into: MapNode, from: MapNode) => {
    into.weight += from.weight; into.turns += from.turns; into.activeMs += from.activeMs;
    into.threads += from.threads; into.running += from.running;
  };
  const deviceNodes = devices.map(device => {
    const node: MapNode = { id: `device:${device.id}`, kind: 'device', label: device.name, children: [], weight: 0, turns: 0, activeMs: 0, threads: 0, running: 0, device };
    for (const workspace of device.workspaces) {
      const space: MapNode = { id: `workspace:${device.id}:${workspace.id}`, kind: 'workspace', label: workspace.label, parent: node, children: [], weight: 0, turns: 0, activeMs: 0, threads: 0, running: 0, workspace, device };
      for (const thread of workspace.threads) {
        const leaf: MapNode = {
          id: `thread:${thread.key}`, kind: 'thread', label: thread.title, parent: space, children: [], thread, device, workspace,
          weight: threadWeight(thread.turns), turns: thread.turns ?? 0, activeMs: thread.activeMs ?? 0, threads: 1, running: thread.running ? 1 : 0,
        };
        space.children.push(leaf);
        add(space, leaf);
      }
      if (!space.children.length) continue;
      space.children.sort(byWeight);
      node.children.push(space);
      add(node, space);
    }
    node.children.sort(byWeight);
    return node;
  });
  const listed = deviceNodes.reduce((sum, node) => sum + node.weight, 0);
  // Unlisted devices take a sliver of the map, enough for their name.
  for (const node of deviceNodes) if (!node.weight) node.weight = Math.max(1, listed * 0.06);
  if (deviceNodes.length === 1 && deviceNodes[0]!.device!.state === 'ready') {
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
  }
  return nodes;
}
