export interface MapRect { x: number; y: number; width: number; height: number }

/**
 * Squarified treemap: lays `items` out in strips inside `bounds`, each with an
 * area proportional to its weight. Items keep the given order (callers sort the
 * heaviest first); items without weight get no rectangle.
 */
export function squarify<T>(items: readonly T[], weight: (item: T) => number, bounds: MapRect): { item: T; rect: MapRect }[] {
  const pending = items.map(item => ({ item, weight: Math.max(0, weight(item)) })).filter(entry => entry.weight > 0);
  const total = pending.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total || bounds.width <= 0 || bounds.height <= 0) return [];
  const scale = (bounds.width * bounds.height) / total;
  const areas = pending.map(entry => ({ item: entry.item, area: entry.weight * scale }));
  const worst = (row: typeof areas, side: number) => {
    const sum = row.reduce((s, entry) => s + entry.area, 0);
    let max = 0, min = Infinity;
    for (const entry of row) { max = Math.max(max, entry.area); min = Math.min(min, entry.area); }
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  const result: { item: T; rect: MapRect }[] = [];
  let box = { ...bounds };
  let index = 0;
  while (index < areas.length) {
    const side = Math.min(box.width, box.height);
    const row = [areas[index++]!];
    while (index < areas.length && worst([...row, areas[index]!], side) <= worst(row, side)) row.push(areas[index++]!);
    const sum = row.reduce((s, entry) => s + entry.area, 0);
    // Strips run along the shorter side, stacked across the longer one.
    const vertical = box.width >= box.height;
    const thickness = index >= areas.length ? (vertical ? box.width : box.height) : Math.min(vertical ? box.width : box.height, sum / side);
    let offset = 0;
    row.forEach((entry, position) => {
      const length = position === row.length - 1 ? side - offset : entry.area / thickness;
      result.push({
        item: entry.item,
        rect: vertical
          ? { x: box.x, y: box.y + offset, width: thickness, height: length }
          : { x: box.x + offset, y: box.y, width: length, height: thickness },
      });
      offset += length;
    });
    box = vertical
      ? { ...box, x: box.x + thickness, width: Math.max(0, box.width - thickness) }
      : { ...box, y: box.y + thickness, height: Math.max(0, box.height - thickness) };
  }
  return result;
}
