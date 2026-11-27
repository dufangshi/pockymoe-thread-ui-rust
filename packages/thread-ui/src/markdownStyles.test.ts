// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Tailwind's preflight makes h1–h6 body text and removes list markers. Answers
// and Markdown previews must get both back in every theme (Classic lost them).
const css = readFileSync(fileURLToPath(new URL('./styles/history-markdown.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector: RegExp) => {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, head]) => selector.test(head!));
  return found.map(([, , body]) => body!).join(';');
};

it('gives answers a heading hierarchy larger than their body text', () => {
  const size = (tag: string) => Number(rule(new RegExp(`\\.thread-graph-markdown :where\\(${tag}\\)\\s*$`)).match(/font-size:\s*([\d.]+)em/)?.[1]);
  expect(size('h1')).toBeGreaterThan(size('h2'));
  expect(size('h2')).toBeGreaterThan(size('h3'));
  expect(size('h3')).toBeGreaterThan(1);
  expect(size('h4')).toBe(1);
  expect(rule(/thread-graph-markdown-preview\) :where\(h1, h2, h3, h4, h5, h6\)/)).toMatch(/font-weight:\s*650/);
});

it('shows bullets and numbers for lists in answers and previews', () => {
  expect(rule(/thread-graph-markdown-preview\) :where\(ul\)\s*$/)).toMatch(/list-style:\s*disc/);
  expect(rule(/thread-graph-markdown-preview\) :where\(ol\)\s*$/)).toMatch(/list-style:\s*decimal/);
  // A task item keeps only its checkbox.
  expect(rule(/:where\(li:has\(> input\[type='checkbox'\]\)\)/)).toMatch(/list-style:\s*none/);
});
