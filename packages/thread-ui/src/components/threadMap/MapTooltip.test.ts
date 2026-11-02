import { describe, expect, it } from 'vitest';
import { placeMapTooltip } from './MapTooltip';

describe('map tooltip placement', () => {
  const viewport = { x: 0, y: 0, width: 1240, height: 900 };
  it('prefers beside the entire tile, outside its title/status', () => {
    expect(placeMapTooltip({ x: 30, y: 200, width: 400, height: 220 }, { width: 300, height: 70 }, viewport)).toEqual({ x: 438, y: 200 });
  });
  it('moves beside or above a full-height workspace rather than over its first tile', () => {
    const anchor = { x: 20, y: 180, width: 1200, height: 680 };
    const result = placeMapTooltip(anchor, { width: 300, height: 60 }, viewport)!;
    expect(result.y + 60).toBeLessThan(anchor.y);
  });
  it('uses the side when there is no vertical space', () => {
    const anchor = { x: 20, y: 20, width: 300, height: 860 };
    expect(placeMapTooltip(anchor, { width: 200, height: 100 }, viewport)).toEqual({ x: 328, y: 20 });
  });
  it('omits a tip when no non-overlapping position exists', () => {
    expect(placeMapTooltip({ x: 0, y: 0, width: 1240, height: 900 }, { width: 300, height: 80 }, viewport)).toBeNull();
  });
});

it('clamps a popover beside a bottom-right tile inside the viewport', () => {
  expect(placeMapTooltip({ x: 1110, y: 740, width: 88, height: 34 }, { width: 300, height: 200 }, { x: 0, y: 0, width: 1240, height: 900 })).toEqual({ x: 802, y: 692 });
});
