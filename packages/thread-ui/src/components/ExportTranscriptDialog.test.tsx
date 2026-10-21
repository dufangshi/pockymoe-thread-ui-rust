/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportThreadTranscriptInput } from '@pockymoe/shared';
import { ThreadActionsDialog } from './ExportTranscriptDialog';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const turnsState = {
  status: 'ready' as const,
  error: null,
  data: {
    totalTurnCount: 3,
    turns: [
      {
        turnId: 'turn-3',
        turnNumber: 3,
        startedAt: '2026-06-18T12:00:00.000Z',
        status: 'completed' as const,
        userPromptPreview: 'Third prompt',
      },
      {
        turnId: 'turn-2',
        turnNumber: 2,
        startedAt: '2026-06-18T11:00:00.000Z',
        status: 'completed' as const,
        userPromptPreview: 'Second prompt',
      },
      {
        turnId: 'turn-1',
        turnNumber: 1,
        startedAt: '2026-06-18T10:00:00.000Z',
        status: 'failed' as const,
        userPromptPreview: 'First prompt',
      },
    ],
  },
};

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(node);
  });
}

function renderDialog(
  overrides: Partial<Parameters<typeof ThreadActionsDialog>[0]> = {},
) {
  const props = {
    open: true,
    busy: false,
    turnsState,
    onCancel: vi.fn(),
    onLoadTurns: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof ThreadActionsDialog>[0];
  render(<ThreadActionsDialog {...props} />);
  return props;
}

function text(value: string) {
  return document.body.textContent?.includes(value) ?? false;
}

function click(element: Element | null) {
  expect(element).toBeTruthy();
  act(() => {
    element!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function exportButton(label: string) {
  return [...document.body.querySelectorAll('button')]
    .find((button) => button.textContent === label) ?? null;
}

function checkedInput(labelText: string) {
  const labels = [...document.body.querySelectorAll('label')];
  const label = labels.find((entry) => entry.textContent?.includes(labelText));
  expect(label).toBeTruthy();
  return label!.querySelector('input') as HTMLInputElement;
}

describe('ThreadActionsDialog', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders compact export controls without the old latest-10 explanation', () => {
    const props = renderDialog();

    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Thread actions',
    );
    expect(text('PDF')).toBe(false);
    expect(text('HTML')).toBe(true);
    expect(text('Share')).toBe(true);
    expect(text('Turns')).toBe(true);
    expect(text('Exports the latest 10 turns in chronological order.')).toBe(false);
    expect(props.onLoadTurns).toHaveBeenCalledTimes(1);
  });

  it('exports the chosen HTML latest-turn count', () => {
    const onExport = vi.fn();
    renderDialog({ onExport });

    click(exportButton('HTML'));
    changeSelect(document.body.querySelector('select')!, 'latest-3');
    click(exportButton('Export HTML'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'html',
      mode: 'latest',
      limit: 3,
      profile: 'review',
      options: {
        includeTokenAndPrice: true,
      },
    } satisfies ExportThreadTranscriptInput);
  });

  it.each([
    ['latest-10', 10, '3 turns selected.'],
    ['latest-20', 20, '3 turns selected.'],
  ] as const)('exports %s as a latest-turn selection', (mode, limit, selectedLabel) => {
    const onExport = vi.fn();
    renderDialog({ onExport });

    changeSelect(document.body.querySelector('select')!, mode);
    expect(text(selectedLabel)).toBe(true);
    click(exportButton('Export HTML'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'html',
      mode: 'latest',
      limit,
      profile: 'review',
      options: {
        includeTokenAndPrice: true,
      },
    } satisfies ExportThreadTranscriptInput);
  });

  it('exports all loaded turns as an explicit selection', () => {
    const onExport = vi.fn();
    renderDialog({ onExport });

    changeSelect(document.body.querySelector('select')!, 'all-loaded');
    expect(text('3 turns selected.')).toBe(true);
    click(exportButton('Export HTML'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'html',
      mode: 'selected',
      turnIds: ['turn-3', 'turn-2', 'turn-1'],
      profile: 'review',
      options: {
        includeTokenAndPrice: true,
      },
    } satisfies ExportThreadTranscriptInput);
  });

  it('exports a custom turn selection', () => {
    const onExport = vi.fn();
    renderDialog({ onExport });
    // The option itself is named and carries the mode (an i18n pass once replaced it with its label).
    const custom = [...document.body.querySelector('select')!.options].find(option => option.value === 'custom');
    expect(custom?.textContent).toBe('Custom');

    changeSelect(document.body.querySelector('select')!, 'custom');
    click(exportButton('Clear'));
    click(checkedInput('Second prompt'));
    click(exportButton('Export HTML'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'html',
      mode: 'selected',
      turnIds: ['turn-2'],
      profile: 'review',
      options: {
        includeTokenAndPrice: true,
      },
    } satisfies ExportThreadTranscriptInput);
  });

  it('creates and revokes relay shares from share mode', async () => {
    const onCreateShare = vi.fn();
    const onRevokeShare = vi.fn();
    renderDialog({
      initialMode: 'share',
      shareAvailable: true,
      shareState: {
        status: 'ready',
        error: null,
        shares: [
          {
            id: 'share-1',
            targetUsername: 'alice',
            label: 'Review',
            threadAccess: 'read',
            workspaceAccess: 'read',
            createdAt: '2026-06-18T00:00:00.000Z',
          },
        ],
      },
      onCreateShare,
      onRevokeShare,
      deviceShareAvailable: true,
    });

    expect(text('Share this thread')).toBe(true);
    // Without a workspace option, the choice is this thread or the whole device.
    expect(text('This workspace')).toBe(false);
    click(checkedInput('Whole device'));
    expect(exportButton('Whole device')).toBeNull();
    expect(checkedInput('Can create new threads').checked).toBe(false);

    const relayIdentifier = [...document.body.querySelectorAll('input')]
      .find((input) => input.getAttribute('placeholder') === 'username or email') as HTMLInputElement;
    changeInput(relayIdentifier, 'bob@example.test');
    click(checkedInput('Collaborator'));
    click(checkedInput('Read and edit'));
    const label = [...document.body.querySelectorAll('input')]
      .find((input) => input.getAttribute('placeholder') === 'optional') as HTMLInputElement;
    changeInput(label, 'Pairing');
    await act(async () => { click(exportButton('Share device')); });

    expect(onCreateShare).toHaveBeenCalledWith({
      scope: 'device',
      targetIdentifier: 'bob@example.test',
      threadAccess: 'control',
      workspaceAccess: 'write',
      label: 'Pairing',
      canCreateThreads: false,
    });
    expect(text('alice')).toBe(true);
    expect(text('Review')).toBe(true);

    click(exportButton('Revoke'));
    expect(onRevokeShare).toHaveBeenCalledWith('share-1');
  });

  it('shares this workspace between the thread and the whole device', async () => {
    const onCreateShare = vi.fn();
    renderDialog({
      initialMode: 'share',
      shareAvailable: true,
      shareState: { status: 'ready', error: null, shares: [] },
      onCreateShare,
      deviceShareAvailable: true,
      workspaceShareAvailable: true,
      workspaceLabel: 'docs-site',
    });
    const scopes = [...document.body.querySelectorAll<HTMLInputElement>('input[name="thread-share-scope"]')]
      .map((input) => input.closest('label')?.querySelector('strong')?.textContent);
    expect(scopes).toEqual(['This thread', 'This workspace', 'Whole device']);
    // New threads are a choice only for the workspace and the whole device.
    expect(text('Can create new threads')).toBe(false);
    click(checkedInput('This workspace'));
    expect(text('Every thread in docs-site, with the permissions below.')).toBe(true);
    expect(text('Only in this workspace.')).toBe(true);
    expect(text('People you share with never get a terminal.')).toBe(true);
    click(checkedInput('Can create new threads'));
    changeInput(
      [...document.body.querySelectorAll('input')].find((input) => input.getAttribute('placeholder') === 'username or email') as HTMLInputElement,
      'carol',
    );
    click(checkedInput('Collaborator'));
    // "No access" sends the literal value whatever the language.
    click(checkedInput('Read files'));
    click(checkedInput('No access'));
    await act(async () => { click(exportButton('Share workspace')); });
    expect(onCreateShare).toHaveBeenCalledWith({
      scope: 'workspace',
      targetIdentifier: 'carol',
      threadAccess: 'control',
      workspaceAccess: 'none',
      label: null,
      canCreateThreads: true,
    });
    click(checkedInput('This thread'));
    expect(text('Can create new threads')).toBe(false);
  });

  it('shares only the workspace when opened from a workspace menu', async () => {
    const onCreateShare = vi.fn();
    renderDialog({
      appearance: 'matter',
      initialMode: 'share',
      shareAvailable: true,
      shareState: { status: 'ready', error: null, shares: [] },
      onCreateShare,
      deviceShareAvailable: true,
      workspaceOnly: true,
      workspaceLabel: 'docs-site',
    });
    const scopes = [...document.body.querySelectorAll<HTMLInputElement>('input[name="thread-share-scope"]')]
      .map((input) => input.closest('label')?.querySelector('strong')?.textContent);
    expect(scopes).toEqual(['This workspace']);
    expect(text('Choose who can view or collaborate on the threads in this workspace.')).toBe(true);
    expect(text('No active shares for this workspace.')).toBe(true);
    expect(text('Can create new threads')).toBe(true);
    changeInput(
      [...document.body.querySelectorAll('input')].find((input) => input.getAttribute('placeholder') === 'username or email') as HTMLInputElement,
      'dave',
    );
    await act(async () => { click(exportButton('Share workspace')); });
    expect(onCreateShare).toHaveBeenCalledWith(expect.objectContaining({ scope: 'workspace', targetIdentifier: 'dave', canCreateThreads: false }));
  });

  it('edits a workspace share without changing its scope', async () => {
    const onUpdateShare = vi.fn();
    renderDialog({
      initialMode: 'share',
      shareAvailable: true,
      shareState: {
        status: 'ready',
        error: null,
        shares: [{
          id: 'grant:g-1',
          scope: 'workspace',
          workspaceLabel: 'docs-site',
          targetUsername: 'carol',
          label: null,
          threadAccess: 'control',
          workspaceAccess: 'read',
          canCreateThreads: true,
        }],
      },
      onUpdateShare,
      deviceShareAvailable: true,
      workspaceShareAvailable: true,
    });
    expect(text('Workspace docs-site · ')).toBe(true);
    click(document.body.querySelector('[aria-label="Edit permissions for carol"]'));
    expect(checkedInput('This workspace').checked).toBe(true);
    expect(checkedInput('This workspace').disabled).toBe(true);
    expect(checkedInput('Can create new threads').checked).toBe(true);
    click(checkedInput('Can create new threads'));
    await act(async () => { click(exportButton('Save permissions')); });
    expect(onUpdateShare).toHaveBeenCalledWith('grant:g-1', expect.objectContaining({
      scope: 'workspace',
      workspaceAccess: 'read',
      canCreateThreads: false,
    }));
  });

  it('shows a custom unavailable message when sharing is not allowed', () => {
    renderDialog({
      initialMode: 'share',
      shareAvailable: false,
      shareUnavailableMessage: 'Only the owner can share this session.',
    });

    expect(text('Only the owner can share this session.')).toBe(true);
    expect(text('Relay sharing will be enabled after the relay permission model is connected.')).toBe(false);
  });

  it('uses a mobile bottom-sheet shell for narrow screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    renderDialog();

    const rootElement = document.body.querySelector('.thread-export-dialog-root');
    const panel = document.body.querySelector('.thread-export-dialog-panel');
    const footer = document.body.querySelector('.thread-export-dialog-footer');
    expect(rootElement?.className).toContain('items-end');
    expect(panel?.className).toContain('rounded-t-');
    expect(panel?.className).toContain('max-h-[min(48rem,calc(100vh-1rem))]');
    expect(footer?.textContent).toContain('3 turns selected.');
    expect(exportButton('Export HTML')).toBeTruthy();
  });
});
