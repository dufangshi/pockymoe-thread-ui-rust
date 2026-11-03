import { describe, expect, it } from 'vitest';
import { buildThreadMap } from './model';
import type { ThreadMapDevice } from './model';
import { filterPhoneDevices, mapPresentation, phoneLayout } from './phone';
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
  it('has only one fold entry and it points at its container without nested folds', () => {
    const root = buildThreadMap(devices, 'All', { keepDeviceRoot: true });
    const space = root.children[0]!.children[0]!;
    const cells = phoneLayout(space.children, { x: 0, y: 0, width: 180, height: 200 }, space);
    const folds = cells.filter(cell => cell.item.kind === 'compressed');
    expect(folds).toHaveLength(1); expect(folds[0]!.item.parent).toBe(space); expect(folds[0]!.item.children).toEqual([]);
  });
  it.each([360, 390])('keeps every cell at least 96 by 44 at %ipx', width => {
    const root = buildThreadMap(devices, 'All', { keepDeviceRoot: true });
    const space = root.children[0]!.children[0]!;
    for (const { rect } of phoneLayout(space.children, { x: 0, y: 0, width, height: 550 }, space)) {
      expect(rect.width).toBeGreaterThanOrEqual(96); expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });
});
