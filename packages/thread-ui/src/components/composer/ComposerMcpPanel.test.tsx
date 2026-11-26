/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerMcpPanel } from './ComposerMcpPanel';
import type { McpPanelMode } from './types';

// The panel's own buttons, not the copy and expand buttons of its path chips.
const panelButtons = (view: Element) =>
  Array.from(view.querySelectorAll<HTMLButtonElement>('button')).filter((button) => !button.closest('.path-chip'));

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

function baseProps(overrides: Partial<Parameters<typeof ComposerMcpPanel>[0]> = {}) {
  return {
    mcpPanelMode: 'list' as McpPanelMode,
    mcpState: {
      status: 'ready' as const,
      error: null,
      data: {
        servers: [],
      },
    },
    mcpConfigEditing: true,
    mcpConfigPath: '/repo/.codex/config.toml',
    mcpConfigError: null,
    mcpConfigSuccess: null,
    mcpConfigBusy: false,
    mcpHttpName: '',
    mcpHttpUrl: '',
    mcpRawBlock: '',
    composerPanelButtonClassName: 'panel-button',
    composerChipButtonClassName: 'chip-button',
    onSetMcpPanelMode: vi.fn(),
    onClearMcpConfigStatus: vi.fn(),
    onSetMcpHttpName: vi.fn(),
    onSetMcpHttpUrl: vi.fn(),
    onSetMcpRawBlock: vi.fn(),
    onPrepareRawMcpBlock: vi.fn(),
    onSaveHttpMcp: vi.fn(),
    onSaveRawMcpBlock: vi.fn(),
    ...overrides,
  };
}

describe('ComposerMcpPanel', () => {
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

  it('renders MCP server summaries and opens add mode', () => {
    const onSetMcpPanelMode = vi.fn();
    const onClearMcpConfigStatus = vi.fn();
    const view = renderNode(
      <ComposerMcpPanel
        {...baseProps({
          onSetMcpPanelMode,
          onClearMcpConfigStatus,
          mcpState: {
            status: 'ready',
            error: null,
            data: {
              servers: [
                {
                  name: 'docs',
                  tools: [
                    {
                      name: 'search',
                      title: 'Search Docs',
                      description: 'Search the docs',
                    },
                  ],
                  resourceCount: 2,
                  resourceTemplateCount: 1,
                  authStatus: 'unsupported',
                },
              ],
            },
          },
        })}
      />,
    );

    expect(view.textContent).toContain('docs');
    expect(view.textContent).toContain('1 tools · 2 resources · 1 templates');
    expect(view.textContent).toContain('Search Docs');
    expect(view.textContent).toContain('Public');

    panelButtons(view)[0]?.click();
    expect(onSetMcpPanelMode).toHaveBeenCalledWith('add');
    expect(onClearMcpConfigStatus).toHaveBeenCalledTimes(1);
  });

  it('shows a live failure and leaves out counts the harness does not report', () => {
    const view = renderNode(
      <ComposerMcpPanel
        {...baseProps({
          mcpConfigEditing: false,
          mcpState: {
            status: 'ready',
            error: null,
            data: {
              servers: [
                { name: 'tickets', tools: [], resourceCount: null, resourceTemplateCount: null, authStatus: 'unsupported', status: 'failed', error: 'spawn ENOENT' },
                { name: 'calendar', tools: [], resourceCount: null, resourceTemplateCount: null, authStatus: 'notLoggedIn', status: 'needsAuth' },
                { name: 'docs', tools: [{ name: 'read', title: null, description: null }], resourceCount: null, resourceTemplateCount: null, authStatus: 'oAuth', status: 'connected' },
              ],
            },
          },
        })}
      />,
    );
    const text = view.textContent ?? '';
    expect(text).toContain('Failed');
    expect(text).toContain('spawn ENOENT');
    expect(text).toContain('Sign-in needed');
    expect(text).toContain('OAuth');
    expect(text).not.toContain('resources');
    expect(text).toContain('0 tools');
    expect(text).not.toContain('tools ·');
    expect(view.querySelectorAll('.ui-status-warning')).toHaveLength(2);
  });

  it('renders add choices and prepares raw MCP mode', () => {
    const onSetMcpPanelMode = vi.fn();
    const onClearMcpConfigStatus = vi.fn();
    const onPrepareRawMcpBlock = vi.fn();
    const view = renderNode(
      <ComposerMcpPanel
        {...baseProps({
          mcpPanelMode: 'add',
          onSetMcpPanelMode,
          onClearMcpConfigStatus,
          onPrepareRawMcpBlock,
        })}
      />,
    );

    const buttons = panelButtons(view);
    buttons[0]?.click();
    buttons[1]?.click();

    expect(onSetMcpPanelMode).toHaveBeenCalledWith('http');
    expect(onClearMcpConfigStatus).toHaveBeenCalledTimes(1);
    expect(onPrepareRawMcpBlock).toHaveBeenCalledTimes(1);
  });

  it('renders HTTP form and emits save events', () => {
    const onSaveHttpMcp = vi.fn();
    const view = renderNode(
      <ComposerMcpPanel
        {...baseProps({
          mcpPanelMode: 'http',
          mcpHttpName: 'docs',
          mcpHttpUrl: 'https://example.test/mcp',
          onSaveHttpMcp,
        })}
      />,
    );

    const inputs = view.querySelectorAll<HTMLInputElement>('input');
    expect(inputs[0]?.value).toBe('docs');
    expect(inputs[1]?.value).toBe('https://example.test/mcp');
    panelButtons(view)[1]?.click();

    expect(onSaveHttpMcp).toHaveBeenCalledTimes(1);
  });

  it('renders stdio form and emits raw block save events', () => {
    const onSaveRawMcpBlock = vi.fn();
    const view = renderNode(
      <ComposerMcpPanel
        {...baseProps({
          mcpPanelMode: 'stdio',
          mcpRawBlock: '[mcp_servers.docs]',
          onSaveRawMcpBlock,
        })}
      />,
    );

    const textarea = view.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.value).toBe('[mcp_servers.docs]');
    panelButtons(view)[1]?.click();

    expect(onSaveRawMcpBlock).toHaveBeenCalledTimes(1);
  });
});
