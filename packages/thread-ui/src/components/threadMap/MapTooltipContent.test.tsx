/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { MapTooltip } from './MapTooltip';
import { buildThreadMap } from './model';

it('associates structured details with the focused trigger, handles Escape, and restores existing aria', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  setLocale('en', false);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    new DOMRect(20, 200, 180, 52),
  ] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this.matches('[role=tooltip]')
        ? new DOMRect(0, 0, 300, 180)
        : new DOMRect(20, 200, 180, 52);
    },
  );
  const anchor = document.createElement('button'),
    host = document.createElement('div');
  anchor.setAttribute('aria-describedby', 'existing');
  document.body.append(anchor, host);
  const root = createRoot(host),
    close = vi.fn(),
    hold = vi.fn();
  const node = buildThreadMap(
    [
      {
        id: 'd',
        name: 'D',
        state: 'ready',
        workspaces: [
          {
            id: 'w',
            label: 'Workspace',
            threads: [
              {
                key: 't',
                title: 'Useful title',
                href: '#t',
                agent: 'codex',
                model: 'raw-id',
                modelDisplayName: 'Display model',
                running: false,
                needsInput: { kind: 'approval' },
                turns: 9,
                activeMs: 0,
                totalMs: 7200000,
                lastPrompt: 'Check the latest result.',
              },
            ],
          },
        ],
      },
    ],
    'All',
  ).children[0]!.children[0]!;
  try {
    act(() => {
      anchor.focus();
      root.render(
        <MapTooltip
          anchor={anchor}
          trigger={anchor}
          node={node}
          lines={[]}
          onClose={close}
          onHold={hold}
        />,
      );
    });
    const tip = document.querySelector<HTMLElement>('[role=tooltip]')!;
    expect(tip.dataset.structured).toBe('true');
    expect(tip.textContent).toContain('Display model · Workspace');
    expect(tip.textContent).not.toContain('raw-id');
    expect(
      tip.querySelector('[data-status=waiting]')?.getAttribute('aria-label'),
    ).toBe('Waiting for you');
    expect(
      tip.querySelector('[data-metric=recent]')?.getAttribute('aria-label'),
    ).toContain('24');
    expect(anchor.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'existing',
      tip.id,
    ]);
    expect(document.activeElement).toBe(anchor);
    act(() =>
      tip.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })),
    );
    expect(hold).toHaveBeenCalled();
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
      ),
    );
    expect(close).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(anchor.getAttribute('aria-describedby')).toBe('existing');
  } finally {
    act(() => root.unmount());
    anchor.remove();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
