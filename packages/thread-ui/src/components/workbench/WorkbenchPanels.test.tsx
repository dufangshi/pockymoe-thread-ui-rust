// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, translate as t } from '../../i18n';
import {
  MatterWorkbench,
  type MatterWorkbenchOptions,
} from '../MatterWorkbench';
import {
  WorkbenchPanels,
  type WorkbenchPanelsOptions,
} from './WorkbenchPanels';
import type { WorkbenchToolPanelControls } from './toolPanel';
import { ComposerJumpLatestButton } from '../composer/ComposerJumpLatestButton';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
let options: WorkbenchPanelsOptions;
function render() {
  act(() =>
    root.render(
      <WorkbenchPanels
        options={options}
        explorer={<input aria-label="File editor" />}
        revealExplorer={0}
      >
        <textarea aria-label="Primary draft" />
      </WorkbenchPanels>,
    ),
  );
}
const workbenchOptions = (): MatterWorkbenchOptions => ({
  panels: options,
  threads: [],
  currentKey: 'host:primary',
  favorite: false,
  workspacePath: '/workspace',
  activeView: 'chat',
  terminalEnabled: false,
  onViewChange: vi.fn(),
  onToggleFavorite: vi.fn(),
  onNavigate: vi.fn(),
  onSearch: vi.fn(),
  notifications: [],
  unreadCount: 0,
  onReadNotifications: vi.fn(),
});
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  options = {
    deviceLabel: 'Secret device path',
    workspaceLabel: '/private/path',
    primaryTitle: 'Primary',
    primaryStatus: 'idle',
    primaryHarness: 'codex',
    presentation: {
      referenceId: 'peer',
      referenceDeviceId: 'other-device',
      mode: 'thread',
      ratio: 55,
    },
    candidates: [],
    onPresentationChange: vi.fn(),
    onMakePrimary: vi.fn(),
    onFocusPane: vi.fn(),
    referenceTitle: 'Second conversation',
    referenceContent: <textarea aria-label="Second draft" />,
    toolContent: <input aria-label="Terminal input" />,
    toolTitle: 'Terminal',
    onCloseTools: vi.fn(),
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe('split panes and independent tools', () => {
  it('removes the context picker and changes composer focus from actual pane interaction', () => {
    render();
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).not.toContain('/private/path');
    expect(host.textContent).not.toContain('Reference area');
    act(() =>
      host
        .querySelector('[aria-label="Second draft"]')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true })),
    );
    expect(options.onFocusPane).toHaveBeenLastCalledWith('reference');
    act(() =>
      host
        .querySelector<HTMLTextAreaElement>('[aria-label="Primary draft"]')!
        .focus(),
    );
    expect(options.onFocusPane).toHaveBeenLastCalledWith('primary');
  });
  it('keeps both drafts mounted while files or terminal open and tool focus never retargets the composer', () => {
    render();
    const primary = host.querySelector<HTMLTextAreaElement>(
      '[aria-label="Primary draft"]',
    )!;
    const secondary = host.querySelector<HTMLTextAreaElement>(
      '[aria-label="Second draft"]',
    )!;
    primary.value = 'primary unsent';
    secondary.value = 'secondary unsent';
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'files' },
      toolsOpen: false,
      toolsTargetLabel: 'Other device · Workspace · Second conversation',
    };
    render();
    const file = host.querySelector<HTMLInputElement>(
      '[aria-label="File editor"]',
    )!;
    vi.mocked(options.onFocusPane!).mockClear();
    act(() => {
      file.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      file.focus();
    });
    expect(options.onFocusPane).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Second draft"]')).toBe(secondary);
    expect(secondary.closest('[hidden]')).toBeNull();
    expect(secondary.value).toBe('secondary unsent');
    expect(primary.value).toBe('primary unsent');
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Close files"]')!
        .click(),
    );
    expect(options.onPresentationChange).toHaveBeenLastCalledWith({
      mode: 'thread',
    });
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'files' },
      toolsOpen: true,
    };
    render();
    // The terminal is a bottom panel now: Files stays open beside it.
    expect(host.querySelector('[aria-label="File editor"]')!.closest('[hidden]')).toBeNull();
    const terminal = host.querySelector<HTMLInputElement>(
      '[aria-label="Terminal input"]',
    )!;
    expect(terminal.closest('[data-testid="workbench-bottom-panel"]')).not.toBeNull();
    act(() => terminal.focus());
    expect(options.onFocusPane).not.toHaveBeenCalled();
    // Escape belongs to the shell (vim, less); hiding the panel is explicit.
    act(() =>
      terminal.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(options.onCloseTools).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Second draft"]')).toBe(secondary);
  });
  it('lays the terminal below the conversations with persisted size, maximize, collapse and hide', () => {
    const observed: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { observed.push(callback); }
      observe() {}
      disconnect() {}
    });
    let controls: WorkbenchToolPanelControls | null = null;
    options = {
      ...options,
      toolsOpen: true,
      toolContent: (next) => { controls = next; return <input aria-label="Terminal input" />; },
    };
    render();
    // The column is 800px tall: the panel may take everything but 200px.
    act(() => observed.forEach(callback => callback([{ contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry], {} as ResizeObserver)));
    const panel = host.querySelector<HTMLElement>('[data-testid="workbench-bottom-panel"]')!;
    const sash = host.querySelector<HTMLElement>('[data-testid="workbench-panel-sash"]')!;
    expect(sash.getAttribute('aria-valuemax')).toBe('600');
    const start = Number(sash.getAttribute('aria-valuenow'));
    act(() => sash.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    expect(Number(sash.getAttribute('aria-valuenow'))).toBe(start + 24);
    expect(panel.style.getPropertyValue('--workbench-panel-height')).toBe(`${start + 24}px`);
    expect(JSON.parse(localStorage.getItem('remote-codex.terminal-panel.v1')!).height).toBe(start + 24);
    act(() => sash.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(sash.getAttribute('aria-valuenow')).toBe('600');
    act(() => controls!.toggleMaximized());
    expect(panel.classList.contains('is-maximized')).toBe(true);
    expect(host.querySelector('.workbench-pane-grid')!.hasAttribute('inert')).toBe(true);
    // Maximize hides, never unmounts, the conversations and their drafts.
    expect(host.querySelector('[aria-label="Second draft"]')).not.toBeNull();
    act(() => controls!.toggleCollapsed());
    expect(panel.classList.contains('is-collapsed')).toBe(true);
    expect(panel.classList.contains('is-maximized')).toBe(false);
    expect(host.querySelector('[data-testid="workbench-panel-sash"]')).toBeNull();
    act(() => controls!.close());
    expect(options.onCloseTools).toHaveBeenCalledOnce();
    localStorage.removeItem('remote-codex.terminal-panel.v1');
  });
  it('returns from a mobile tool drawer with Back without closing split membership', () => {
    vi.stubGlobal('innerWidth', 500);
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'files' },
    };
    render();
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(options.onPresentationChange).toHaveBeenLastCalledWith({
      mode: 'thread',
    });
    expect(options.presentation.referenceDeviceId).toBe('other-device');
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'thread' },
      toolsOpen: true,
    };
    render();
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(options.onCloseTools).toHaveBeenCalledOnce();
  });
  it('honors refused mobile focus and Back while preserving the file editor focus and draft', () => {
    vi.stubGlobal('innerWidth', 500);
    vi.mocked(options.onFocusPane!).mockReturnValue(true);
    render();
    // Without composers each visible pane keeps its own switch.
    const view = (side: 'primary' | 'reference') =>
      host.querySelector<HTMLButtonElement>(`.thread-pane-switch[data-side="${side}"]`)!;
    expect(host.querySelector('.workbench-mobile-views')).toBeNull();
    act(() => view('reference').click());
    expect(
      host
        .querySelector('[data-testid="reference-pane"]')!
        .hasAttribute('hidden'),
    ).toBe(false);
    vi.mocked(options.onFocusPane!).mockReturnValue(false);
    act(() => view('primary').click());
    expect(
      host
        .querySelector('[data-testid="reference-pane"]')!
        .hasAttribute('hidden'),
    ).toBe(false);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(
      host
        .querySelector('[data-testid="reference-pane"]')!
        .hasAttribute('hidden'),
    ).toBe(false);
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'files' },
    };
    render();
    const file = host.querySelector<HTMLInputElement>(
      '[aria-label="File editor"]',
    )!;
    file.value = 'unsaved file';
    act(() => file.focus());
    const primary = host.querySelector<HTMLTextAreaElement>(
      '[aria-label="Primary draft"]',
    )!;
    act(() => primary.focus());
    expect(document.activeElement).toBe(file);
    expect(file.value).toBe('unsaved file');
    expect(options.presentation.referenceId).toBe('peer');
  });
  it('switches a phone split from the composers without a pane header or top views', () => {
    vi.stubGlobal('innerWidth', 500);
    vi.mocked(options.onFocusPane!).mockReturnValue(true);
    options = { ...options, referenceContent: <ComposerJumpLatestButton activeView="chat" followTail={false} /> };
    act(() =>
      root.render(
        <WorkbenchPanels options={options} explorer={null} revealExplorer={0}>
          <ComposerJumpLatestButton activeView="chat" followTail={false} />
        </WorkbenchPanels>,
      ),
    );
    const reference = host.querySelector('[data-testid="reference-pane"]')!;
    expect(host.querySelector('.workbench-mobile-views')).toBeNull();
    expect(host.querySelector('[data-testid="make-primary"]')).toBeNull();
    expect(host.querySelector('.workbench-pane-switch-fallback')).toBeNull();
    const primarySwitch = host.querySelector('[data-testid="primary-pane"] .thread-jump-latest-cluster')!;
    const [left, right] = primarySwitch.querySelectorAll<HTMLButtonElement>('.thread-pane-switch');
    expect(left!.textContent).toBe('Primary');
    expect(right!.textContent).toBe('Second conversation');
    expect(left!.getAttribute('aria-pressed')).toBe('true');
    expect(reference.hasAttribute('hidden')).toBe(true);
    act(() => right!.click());
    expect(options.onFocusPane).toHaveBeenLastCalledWith('reference');
    expect(reference.hasAttribute('hidden')).toBe(false);
    const back = reference.querySelector<HTMLButtonElement>('.thread-pane-switch[data-side="primary"]')!;
    expect(back.getAttribute('aria-pressed')).toBe('false');
    act(() => back.click());
    expect(reference.hasAttribute('hidden')).toBe(true);
  });
  it('pins a phone split to the one-handed dock and switches with one tap', () => {
    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.mocked(options.onFocusPane!).mockReturnValue(true);
    options = { ...options, referenceContent: <ComposerJumpLatestButton activeView="chat" followTail={false} /> };
    act(() =>
      root.render(
        <MatterWorkbench options={{ ...workbenchOptions(), panels: options }} title="Primary" settings={null} newThread={null}
          actions={null} threadMenu={null} connection={null} explorer={null} revealExplorer={0}>
          <ComposerJumpLatestButton activeView="chat" followTail={false} />
        </MatterWorkbench>,
      ),
    );
    // The dock holds both switches: none above the composers, no fallback.
    expect(host.querySelector('.thread-pane-switch')).toBeNull();
    expect(host.querySelector('.workbench-pane-switch-fallback')).toBeNull();
    const pins = [...host.querySelectorAll<HTMLButtonElement>('.matter-phone-pin')];
    expect(pins.map(pin => [pin.textContent, pin.getAttribute('aria-pressed')]))
      .toEqual([['Primary', 'true'], ['Second conversation', 'false']]);
    act(() => pins[1]!.click());
    expect(options.onFocusPane).toHaveBeenLastCalledWith('reference');
    expect(host.querySelector('[data-testid="reference-pane"]')!.hasAttribute('hidden')).toBe(false);
    expect(pins[1]!.getAttribute('aria-pressed')).toBe('true');
    const threads = host.querySelector(`section.matter-phone-sheet[aria-label="${t('workbench.threadSheet')}"]`)!;
    expect(threads.hasAttribute('data-open')).toBe(false);
    act(() => pins[1]!.click());
    expect(threads.hasAttribute('data-open')).toBe(true);
  });
  it('keeps the reference header and no pane switch side by side', () => {
    vi.stubGlobal('innerWidth', 1400);
    options = { ...options, referenceContent: <ComposerJumpLatestButton activeView="chat" followTail={false} /> };
    render();
    expect(host.querySelector('[data-testid="make-primary"]')).not.toBeNull();
    expect(host.querySelector('.thread-pane-switch')).toBeNull();
  });
  it('keeps split membership and ratio through the sidebar file toggle and its guarded callback', () => {
    const workbench = workbenchOptions();
    const renderWorkbench = () =>
      act(() =>
        root.render(
          <MatterWorkbench
            options={{ ...workbench, panels: options }}
            title="Primary"
            homeHref="/"
            settings={null}
            newThread={null}
            actions={null}
            threadMenu={null}
            connection={null}
            explorer={<input aria-label="File editor" />}
            revealExplorer={0}
          >
            <textarea aria-label="Primary draft" />
          </MatterWorkbench>,
        ),
      );
    renderWorkbench();
    act(() =>
      host
        .querySelector<HTMLButtonElement>(
          `button[aria-label="${t('workbench.toggleExplorer')}"]`,
        )!
        .click(),
    );
    expect(options.onPresentationChange).toHaveBeenLastCalledWith({
      mode: 'files',
    });
    options = {
      ...options,
      presentation: { ...options.presentation, mode: 'files' },
    };
    renderWorkbench();
    act(() =>
      host
        .querySelector<HTMLButtonElement>(
          `button[aria-label="${t('workbench.toggleExplorer')}"]`,
        )!
        .click(),
    );
    expect(options.onPresentationChange).toHaveBeenLastCalledWith({
      mode: 'thread',
    });
    expect(options.presentation).toMatchObject({
      referenceId: 'peer',
      referenceDeviceId: 'other-device',
      ratio: 55,
    });
    vi.mocked(options.onPresentationChange).mockReturnValue(false);
    renderWorkbench();
    act(() =>
      host
        .querySelector<HTMLButtonElement>(
          `button[aria-label="${t('workbench.toggleExplorer')}"]`,
        )!
        .click(),
    );
    expect(
      host.querySelector('aside.workbench-tool-drawer')!.hasAttribute('hidden'),
    ).toBe(false);
  });
});
