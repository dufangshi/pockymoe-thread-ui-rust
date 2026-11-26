/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComposerForkPanel,
  ComposerForkTurnsPanel,
} from './ComposerForkPanels';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderNode(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(node);
  });

  return container;
}

describe('ComposerForkPanels', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it('renders fork actions and opens turn selection', () => {
    const onForkLatest = vi.fn();
    const onSelectForkTurnPanel = vi.fn();
    const view = renderNode(
      <ComposerForkPanel
        busy={false}
        forkBusy={false}
        forkFromTurnAvailable
        composerMenuItemClassName="menu-item"
        onForkLatest={onForkLatest}
        onSelectForkTurnPanel={onSelectForkTurnPanel}
      />,
    );

    view
      .querySelector<HTMLButtonElement>('button:nth-of-type(1)')
      ?.click();
    view
      .querySelector<HTMLButtonElement>('button:nth-of-type(2)')
      ?.click();

    expect(onForkLatest).toHaveBeenCalledTimes(1);
    expect(onSelectForkTurnPanel).toHaveBeenCalledTimes(1);
  });

  it('hides selected-turn forking when the backend only supports session fork', () => {
    const view = renderNode(
      <ComposerForkPanel
        busy={false}
        forkBusy={false}
        forkFromTurnAvailable={false}
        composerMenuItemClassName="menu-item"
        onForkLatest={vi.fn()}
        onSelectForkTurnPanel={vi.fn()}
      />,
    );

    expect(view.textContent).toContain('Fork from latest');
    expect(view.textContent).not.toContain('Fork from selected turn');
  });

  it('renders fork turn states and invokes selected turn', () => {
    const onForkTurn = vi.fn();
    const view = renderNode(
      <ComposerForkTurnsPanel
        forkTurnOptionsState={{
          status: 'ready',
          error: null,
          data: [
            {
              turnId: 'turn-1',
              turnIndex: 3,
              status: 'completed',
              startedAt: '2026-06-10T00:00:00.000Z',
            },
          ],
        }}
        forkBusy={false}
        composerPanelButtonClassName="panel-button"
        onForkTurn={onForkTurn}
      />,
    );

    expect(view.textContent).toContain('Turn 3');
    view.querySelector<HTMLButtonElement>('button')?.click();

    expect(onForkTurn).toHaveBeenCalledWith('turn-1');
  });

  it('renders empty and loading states', () => {
    const view = renderNode(
      <ComposerForkTurnsPanel
        forkTurnOptionsState={{
          status: 'loading',
          error: null,
          data: null,
        }}
        forkBusy={false}
        composerPanelButtonClassName="panel-button"
        onForkTurn={vi.fn()}
      />,
    );

    expect(view.textContent).toContain('Loading turns...');

    flushSync(() => {
      root?.render(
        <ComposerForkTurnsPanel
          forkTurnOptionsState={{
            status: 'ready',
            error: null,
            data: [],
          }}
          forkBusy={false}
          composerPanelButtonClassName="panel-button"
          onForkTurn={vi.fn()}
        />,
      );
    });

    expect(view.textContent).toContain('No turns available to fork yet.');
  });

  it('chooses the agent a fork goes to', () => {
    const onChange = vi.fn();
    const view = renderNode(
      <ComposerForkPanel
        busy={false}
        forkBusy={false}
        forkFromTurnAvailable={false}
        composerMenuItemClassName="menu-item"
        forkAgents={{ agents: [{ id: 'codex', name: 'Codex' }, { id: 'claude', name: 'Claude Agent' }], value: 'codex', currentAgentId: 'codex', onChange }}
        onForkLatest={vi.fn()}
        onSelectForkTurnPanel={vi.fn()}
      />,
    );
    const group = view.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Fork into');
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((radio) => [radio.textContent, radio.getAttribute('aria-checked')])).toEqual([['CxCodex', 'true'], ['ClClaude Agent', 'false']]);
    flushSync(() => radios[1]!.click());
    expect(onChange).toHaveBeenCalledWith('claude');
  });
});
