// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect, it } from 'vitest';

const allowed = new Map([
  ['request-animations.css', ['request-spin', 'request-pulse']],
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
    if (/animate-(?:ping|bounce|spin|pulse)/.test(source)) unexpected.push(`${file}: unsupported perpetual utility`);
    for (const match of source.matchAll(/animation(?:-[\w-]+)?\s*:\s*([^;{}]*\binfinite\b[^;{}]*)/gi)) {
      if (!allowed.get(file)?.includes(match[1]!.trim().split(/\s+/)[0]!)) unexpected.push(`${file}: ${match[0]}`);
    }
  }
  expect(unexpected).toEqual([]);
});

it('ships every sheet listed in styles.css through an injected import', () => {
  // tsup injects only the CSS that modules import; a sheet listed in styles.css alone never reaches the bundle.
  const src = fileURLToPath(new URL('./', import.meta.url));
  const listed = [...readFileSync(path.join(src, 'styles.css'), 'utf8').matchAll(/@import\s+['"]\.\/(styles\/[\w-]+\.css)['"]/g)].map(match => match[1]!);
  const modules: string[] = [];
  const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) modules.push(readFileSync(path.join(dir, entry.name), 'utf8'));
  } };
  walk(src);
  const imported = new Set(modules.flatMap(source => [...source.matchAll(/import\s+['"][./]*\/?(?:styles\/)?([\w-]+\.css)['"]/g)].map(match => `styles/${match[1]}`)));
  // Sheets a host imports by path are published through package.json instead.
  const exported = readFileSync(path.join(src, '../package.json'), 'utf8');
  expect(listed.filter(sheet => !imported.has(sheet) && !exported.includes(`./src/${sheet}`))).toEqual([]);
});

it('keeps request animation classes in the reviewed request-only files', () => {
  const root = fileURLToPath(new URL('./', import.meta.url));
  const uses: string[] = [];
  const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx$/.test(file) && !/\.test\./.test(file) && /request-(?:spin|pulse)/.test(readFileSync(file, 'utf8'))) uses.push(path.relative(root, file).split(path.sep).join('/'));
  } };
  walk(root);
  expect(uses.sort()).toEqual(["components/ThreadGraphWorkspacePanelLazy.tsx", "components/composer/ComposerContextControl.tsx", "components/composer/ComposerGoalsPanel.tsx", "components/composer/ComposerPendingQueue.tsx", "components/composer/ComposerSettingsToolbar.tsx", "components/composer/modelPicker/ComposerModelPicker.tsx", "components/graph-chat/ForkTurnButton.tsx", "components/graph-workspace/WorkspaceFileMenu.tsx", "components/graph-workspace/explorer/WorkspaceExplorerPanel.tsx", "components/graph-workspace/explorer/WorkspaceExplorerRow.tsx", "components/threadMap/ThreadMap.tsx", "components/timeline/PeerWorkGroup.tsx"]);
});
