/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginDto } from '@pockymoe/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { PluginProvider, type PluginProviderAdapter } from './PluginProvider';
import { PluginSettingsButton } from './PluginSettingsButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  setLocale('en', false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const installed: PluginDto = {
  id: 'owner.calendar',
  name: 'Calendar agent',
  version: '0.1.0',
  description: 'Plans events',
  remoteCodex: '',
  enabled: true,
  available: true,
  source: 'external',
  capabilities: {
    actions: ['tick', 'status'],
    artifactTypes: [],
    timelineRenderers: [],
    threadPanels: [],
    permissions: ['pockymoeCli'],
    install: { source: 'https://github.com/owner/calendar.git', commit: 'f9c21803abcdef0123456789', updatedAt: '2026-10-30T12:00:00Z' },
  },
};

async function open(adapter: PluginProviderAdapter) {
  await act(async () => root.render(
    <PluginProvider adapter={{ fetchPlugins: () => [installed], ...adapter }} builtinPlugins={[]}>
      <PluginSettingsButton plugin={installed} />
    </PluginProvider>,
  ));
  await act(async () => (document.querySelector('button[aria-label="Calendar agent settings"]') as HTMLButtonElement).click());
}

it('shows an installed plugin its status, runs and install details without a frontend module', async () => {
  const runPluginAction = vi.fn().mockResolvedValue({
    output: {
      summary: 'Running',
      sections: [{ title: 'Apple', items: [
        { label: 'iCloud Calendar', status: 'ok', statusText: '' },
        { label: 'Reminders', status: 'needs_reauth', statusText: '', detail: 'session expired' },
        { label: 'Slack', status: 'notConfigured', statusText: 'Not yet' },
      ] }],
    },
  });
  const fetchPluginRuns = vi.fn().mockResolvedValue([
    { id: 'r1', action: 'tick', trigger: 'schedule', state: 'failed', startedAt: '2026-10-30T12:00:00Z', error: 'boom' },
  ]);
  await open({ runPluginAction, fetchPluginRuns });
  const dialog = document.querySelector('[data-testid="pluginSettingsDialog"]')!;
  expect(runPluginAction).toHaveBeenCalledWith('owner.calendar', 'status', {});
  const marks = [...dialog.querySelectorAll('.installed-plugin-health')].map(m => [m.getAttribute('data-status'), m.textContent]);
  expect(marks).toEqual([['ok', 'OK'], ['needs_reauth', 'Needs sign-in again'], ['notConfigured', 'Not yet']]);
  expect(dialog.textContent).toContain('session expired');
  expect(dialog.textContent).toContain('boom');
  expect(dialog.textContent).toContain('Scheduled');
  expect(dialog.textContent).toContain('f9c21803abcd');
  expect(dialog.textContent).toContain("This device's CLI credential");
});

it('skips the status call for a disabled plugin and shows a failure with retry', async () => {
  const runPluginAction = vi.fn().mockRejectedValue(new Error('plugin exited with 2'));
  await open({ runPluginAction, fetchPlugins: () => [{ ...installed, enabled: false }] });
  expect(runPluginAction).not.toHaveBeenCalled();
  expect(document.querySelector('[role="note"]')).not.toBeNull();

  act(() => root.unmount());
  root = createRoot(container);
  await open({ runPluginAction });
  expect(runPluginAction).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('Could not read the status');
});
