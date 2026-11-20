/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerifiedWorkspacePath } from './VerifiedWorkspacePath';
import type { WorkspacePathResolver } from './workspacePathLinks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const resolver = (exists: boolean, peek?: boolean): WorkspacePathResolver =>
  Object.assign(vi.fn(async () => exists), { peek: () => peek });

describe('VerifiedWorkspacePath', () => {
  let host: HTMLElement | undefined;
  afterEach(() => { host?.remove(); host = undefined; });
  const render = (root: ReturnType<typeof createRoot>, resolve: WorkspacePathResolver) =>
    root.render(<VerifiedWorkspacePath target={{ path: 'src/a.ts' }} resolve={resolve} onOpen={() => {}}><code>src/a.ts</code></VerifiedWorkspacePath>);

  it('keeps a verified link while a new resolver re-checks, and draws a known path at once', async () => {
    host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    await act(async () => render(root, resolver(true)));
    expect(host.querySelector('a, button')).not.toBeNull();
    let settle!: (value: boolean) => void;
    const pending = Object.assign(vi.fn(() => new Promise<boolean>(resolve => { settle = resolve; })), { peek: () => undefined });
    await act(async () => render(root, pending));
    expect(host.querySelector('a, button')).not.toBeNull();
    await act(async () => settle(true));
    expect(host.querySelector('a, button')).not.toBeNull();
    await act(async () => root.unmount());

    const again = createRoot(host);
    act(() => render(again, Object.assign(vi.fn(() => new Promise<boolean>(() => {})), { peek: () => true })));
    expect(host.querySelector('a, button')).not.toBeNull();
    await act(async () => again.unmount());
  });
});
