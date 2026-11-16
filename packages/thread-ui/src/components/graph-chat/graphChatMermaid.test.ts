// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { renderChatMermaid } from './graphChatMermaid';
const renderer = vi.hoisted(() => vi.fn());
vi.mock('mermaid', () => ({ default: { initialize() {}, parse: async () => true, render: renderer } }));

it('removes inline motion from sanitized SVG without changing its paint, layout or text', async () => {
  renderer.mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="80" style="animation:dash 1s linear infinite!important;transition:opacity 1s;fill:red;stroke-width:2"/><text>animation: keep this text</text></svg>' });
  const output = await renderChatMermaid('flowchart LR; A-->B', false);
  const svg = new DOMParser().parseFromString(output, 'image/svg+xml').documentElement;
  const rect = svg.querySelector('rect') as SVGElement;
  expect(rect.style.animation).toBe('');
  expect(rect.style.transition).toBe('');
  expect(rect.style.fill).toBe('red');
  expect(rect.style.strokeWidth).toBe('2');
  expect(rect.getAttribute('width')).toBe('80');
  expect(svg.getAttribute('viewBox')).toBe('0 0 100 50');
  expect(svg.querySelector('text')?.textContent).toBe('animation: keep this text');
});
