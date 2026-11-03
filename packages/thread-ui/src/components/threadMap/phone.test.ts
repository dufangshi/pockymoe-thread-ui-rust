import { describe, expect, it } from 'vitest';
import { buildThreadMap } from './model';
import type { ThreadMapDevice } from './model';
import { filterPhoneDevices, mapPresentation, phoneTileTier, restorePhoneWeights } from './phone';
const devices: ThreadMapDevice[] = [{ id: 'd', name: 'Studio', state: 'ready', workspaces: [{ id: 'w', label: '工程', threads: Array.from({ length: 30 }, (_, i) => ({ key: String(i), title: i === 0 ? '修复地图 Search' : `Other ${i}`, href: '#', turns: i, activeMs: 0, running: false })) }] }];
describe('phone map', () => {
  it('chooses the existing phone breakpoint and explicit host surface', () => {
    expect(mapPresentation(639)).toBe('dialog'); expect(mapPresentation(640)).toBe('page');
    expect(mapPresentation(1440, 'mobile')).toBe('dialog'); expect(mapPresentation(390, 'desktop')).toBe('page');
  });
  it('filters title, workspace and device, case insensitively including CJK, and removes empty parents', () => {
    expect(filterPhoneDevices(devices, 'SEARCH')[0]?.workspaces[0]?.threads).toHaveLength(1);
    expect(filterPhoneDevices(devices, '地图')[0]?.workspaces[0]?.threads).toHaveLength(1);
    expect(filterPhoneDevices(devices, '工程')[0]?.workspaces[0]?.threads).toHaveLength(30);
    expect(filterPhoneDevices(devices, 'studio')).toHaveLength(1);
    expect(filterPhoneDevices(devices, 'missing')).toEqual([]);
    expect(filterPhoneDevices(devices, '')).toBe(devices);
  });
  it('finds folded CJK agents through their root without matching invisible prompt or model text', () => {
    const parent = { key: 'root', title: 'Parent', href: '#', turns: 1, activeMs: 0, running: false, lastPrompt: 'hidden prompt', model: 'hidden model', children: [
      { key: 'agent', title: '地图助手', href: '#', turns: 1, activeMs: 0, running: false },
      { key: 'other', title: 'Unrelated', href: '#', turns: 1, activeMs: 0, running: false },
    ] };
    const source = [{ ...devices[0]!, workspaces: [{ ...devices[0]!.workspaces[0]!, threads: [parent] }] }];
    const result = filterPhoneDevices(source, '地图');
    expect(result[0]!.workspaces[0]!.threads[0]!.title).toBe('Parent');
    expect(result[0]!.workspaces[0]!.threads[0]!.children?.map(child => child.key)).toEqual(['agent']);
    expect(filterPhoneDevices(source, 'hidden')).toEqual([]);
  });
  it('restores turn-proportional weights independently of recency', () => {
    const root = buildThreadMap(devices, 'All', { keepDeviceRoot: true });
    restorePhoneWeights(root);
    const space = root.children[0]!.children[0]!;
    expect(space.children.find(node => node.thread?.key === '0')!.weight).toBe(1);
    expect(space.children.find(node => node.thread?.key === '9')!.weight).toBe(4);
    expect(space.weight).toBe(space.children.reduce((sum, node) => sum + node.weight, 0));
  });
  it('requires 96×44 only for text labels, and keeps smaller icon previews', () => {
    expect(phoneTileTier({ x: 0, y: 0, width: 95, height: 80 })).toBe('icon');
    expect(phoneTileTier({ x: 0, y: 0, width: 150, height: 43 })).toBe('icon');
    expect(phoneTileTier({ x: 0, y: 0, width: 96, height: 44 })).toBe('label');
    expect(phoneTileTier({ x: 0, y: 0, width: 20, height: 18 })).toBe('dot');
  });
});
