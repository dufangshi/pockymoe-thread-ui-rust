// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ComposerSubscriptionUsage } from './ComposerSubscriptionUsage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => {
  await act(async () => { roots.splice(0).forEach(root => root.unmount()); });
  document.body.innerHTML = '';
});

async function renderUsage(authKind: 'subscription' | 'apiKey', stale = false, resetsAt = '2030-01-01T00:00:00.000Z') {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => { root.render(
    <ComposerSubscriptionUsage
      usage={{
        provider: 'codex',
        authKind,
        observedAt: new Date().toISOString(),
        stale,
        windows: [
          {
            id: 'primary',
            durationMinutes: 300,
            label: '5h',
            usedPercent: 40,
            resetsAt,
          },
        ],
      }}
    />,
  ); });
  return host;
}

describe('ComposerSubscriptionUsage', () => {
  it('shows the remaining subscription window compactly', async () => {
    const host = await renderUsage('subscription');
    expect(host.textContent).toContain('5h');
    const control = host.querySelector<HTMLButtonElement>('.thread-subscription-usage');
    const track = control?.querySelector<HTMLElement>('[data-subscription-window-track]');
    const fill = track?.firstElementChild as HTMLElement | null;
    expect(host.querySelector('[role=tooltip]')).toBeNull();

    expect(fill?.style.width).toBe('60%');
    expect(fill?.style.backgroundImage).toContain('linear-gradient');
    expect(control?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      control?.click();
    });

    expect(control?.getAttribute('aria-expanded')).toBe('true');
    const details = host.querySelector<HTMLElement>('[role=tooltip]');
    expect(details?.textContent).toContain('60%');
    expect(control?.contains(details)).toBe(false);
    expect(details?.getAttribute('popover')).toBeNull(); // jsdom fallback
    expect(control?.getAttribute('aria-describedby')).toBe(details?.id);
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(host.querySelector('[role=tooltip]')).toBeNull();
    await act(async () => { control?.click(); });
    expect(host.querySelector('[role=tooltip]')).not.toBeNull();
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(control?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders nothing for API-key authentication', async () => {
    const host = await renderUsage('apiKey');
    expect(host.textContent).toBe('');
  });

  it('keeps stale windows visible and labels their observation time', async () => {
    const host = await renderUsage('subscription', true);
    const control = host.querySelector<HTMLButtonElement>('.thread-subscription-usage');
    expect(control?.dataset.usageStale).toBe('true');
    expect(control?.getAttribute('aria-label')).toContain('last known');
    await act(async () => { control?.click(); });
    expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('last known · updated');
    expect(host.textContent).toContain('60%');
  });

  it('does not display a stale window after its reset time', async () => {
    const host = await renderUsage('subscription', true, '2020-01-01T00:00:00Z');
    expect(host.textContent).toBe('');
  });
});
