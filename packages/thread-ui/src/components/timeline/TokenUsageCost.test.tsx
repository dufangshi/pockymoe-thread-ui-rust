/** @vitest-environment jsdom */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { TokenUsageCost } from './TokenUsageCost';

afterEach(() => { setLocale('en'); vi.unstubAllGlobals(); });

describe('billable input details', () => {
  it.each(['en', 'zh-CN'] as const)('distinguishes total input from uncached input in %s', locale => {
    setLocale(locale);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    // Audited Claude turn: native input_tokens is only 138, while most new
    // content was written to cache and reused across 69 model responses.
    const usage = { inputTokens: 15121954, cachedInputTokens: 14045452,
      cacheWriteInputTokens: 1076364, cacheWriteOneHourInputTokens: 1076364, outputTokens: 56095,
      reasoningOutputTokens: 24378, totalTokens: 15178049 };
    const price = { inputUsd: 0.000552, cachedInputUsd: 2.8090904,
      cacheWriteInputUsd: 8.610912, outputUsd: 1.1219, totalUsd: 12.5424544 };
    try {
      flushSync(() => root.render(<TokenUsageCost usage={usage} price={price}/>));
      flushSync(() => container.querySelector<HTMLButtonElement>('button')!.click());
      const popup = document.querySelector('[data-slot="tooltip-content"]')!;
      const labels = locale === 'en' ? ['Total input','Uncached input','Cache read','Cache write','Output','Reasoning'] : ['输入合计','未缓存输入','缓存读取','缓存写入','输出','推理'];
      const tokens = [15121954,138,14045452,1076364,31717,24378];
      for (let i=0; i<labels.length; i++) {
        expect(popup.textContent).toContain(labels[i]);
        expect(popup.querySelector(`[aria-label="${labels[i]}${locale==='en'?': ':'：'}${tokens[i]!.toLocaleString(locale)}${locale==='en'?' tokens':' 个 token'}"]`)).not.toBeNull();
      }
      expect(popup.textContent).toContain('$12.5');
      expect(popup.querySelector('[aria-label="Uncached input cost"], [aria-label="未缓存输入 费用"]')?.textContent).toBe('<$0.001');
    } finally { flushSync(() => root.unmount()); container.remove(); }
  });
});

describe('usage receipt styling', () => {
  it('leaves the surface to CSS hooks so themes can restyle it', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const usage = { inputTokens: 100, cachedInputTokens: 0, outputTokens: 10, reasoningOutputTokens: 0, totalTokens: 110 };
    try {
      flushSync(() => root.render(<TokenUsageCost usage={usage} price={{ inputUsd: 0.1, cachedInputUsd: 0, outputUsd: 0.1, totalUsd: 0.2 }} tooltipZIndex={91} />));
      flushSync(() => container.querySelector<HTMLButtonElement>('button')!.click());
      const popup = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!;
      expect(popup.classList.contains('thread-usage-details')).toBe(true);
      expect(popup.style.background).toBe('');
      expect(popup.style.border).toBe('');
      expect(popup.style.zIndex).toBe('91');
      expect(popup.querySelector('.thread-usage-details-total')).not.toBeNull();
      expect(popup.querySelector<SVGElement>('[data-slot="tooltip-arrow"]')?.getAttribute('style') ?? '').not.toContain('fill');
    } finally { flushSync(() => root.unmount()); container.remove(); }
  });
});
