// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect, it } from 'vitest';

const allowed = new Map([
  ['base.css', ['history-lift']],
  ['timeline-shell.css', ['thread-loading-rotate', 'thread-loading-pulse']],
  ['layout-workspace.css', ['thread-graph-download-sweep']],
  ['matter-workbench.css', ['workbench-picker-spin']],
]);
it('reserves infinite CSS animations for request/loading indicators', () => {
  const root = fileURLToPath(new URL('./styles/', import.meta.url));
  const unexpected: string[] = [];
  for (const file of readdirSync(root).filter(file => file.endsWith('.css'))) {
    const source = readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/animate-(?:ping|bounce)/.test(source)) unexpected.push(`${file}: unsupported perpetual utility`);
    for (const match of source.matchAll(/animation(?:-[\w-]+)?\s*:\s*([^;{}]*\binfinite\b[^;{}]*)/gi)) {
      if (!allowed.get(file)?.includes(match[1]!.trim().split(/\s+/)[0]!)) unexpected.push(`${file}: ${match[0]}`);
    }
  }
  expect(unexpected).toEqual([]);
});
