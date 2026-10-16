// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { defaultPresentation, useWorkbenchPresentation } from './presentation';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof useWorkbenchPresentation>;
function Probe({
  scope,
  contextKey,
}: {
  scope: string | null;
  contextKey: string | null;
}) {
  current = useWorkbenchPresentation(scope, contextKey);
  return null;
}
function render(scope: string | null, contextKey: string | null = null) {
  act(() => root.render(<Probe scope={scope} contextKey={contextKey} />));
}
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
describe('pending workbench identity', () => {
  it('discards pending actions if the device or workspace changes before identity resolves', () => {
    render(null, 'device-a/workspace-a');
    act(() => current.update({ mode: 'files', referenceId: 'thread-a' }));
    const stale = current.update;
    render(null, 'device-b/workspace-b');
    act(() => stale({ mode: 'thread', referenceId: 'late-a' }));
    render('account-device-b', 'device-b/workspace-b');
    expect(current.value).toEqual(defaultPresentation);
    expect(localStorage.getItem('account-device-b.members')).toBeNull();
  });
  it('keeps an early Explorer action when account identity resolves and saves it', () => {
    localStorage.setItem(
      'account-a.members',
      JSON.stringify({ schemaVersion: 1, referenceId: 'thread-b' }),
    );
    render(null);
    act(() => current.update({ mode: 'files', ratio: 35 }));
    render('account-a');
    expect(current.value).toEqual({
      referenceId: 'thread-b',
      mode: 'files',
      ratio: 35,
    });
    expect(
      JSON.parse(localStorage.getItem('account-a.arrangement')!),
    ).toMatchObject({ mode: 'files', ratio: 35 });
    expect(
      JSON.parse(localStorage.getItem('account-a.members')!),
    ).toMatchObject({ referenceId: 'thread-b' });
  });
  it('does not carry a resolved account layout or late callback into another scope', () => {
    render('account-a');
    act(() =>
      current.update({
        mode: 'files',
        referenceId: 'private-thread',
        ratio: 35,
      }),
    );
    const stale = current.update;
    render(null);
    expect(current.value).toEqual(defaultPresentation);
    act(() => stale({ referenceId: 'late-thread', mode: 'thread' }));
    render('account-b');
    expect(current.value).toEqual(defaultPresentation);
    expect(localStorage.getItem('account-b.members')).toBeNull();
  });
});

describe('device-aware presentation persistence', () => {
  it('saves pending device and thread together and keeps membership through file and resize actions', () => {
    render(null, 'host/workspace');
    act(() =>
      current.update({
        referenceId: 'peer',
        referenceDeviceId: 'remote-device',
        mode: 'thread',
      }),
    );
    render('account-host-workspace', 'host/workspace');
    const membership = localStorage.getItem('account-host-workspace.members');
    expect(JSON.parse(membership!)).toMatchObject({
      referenceId: 'peer',
      referenceDeviceId: 'remote-device',
    });
    act(() => current.update({ mode: 'files', ratio: 40 }));
    expect(localStorage.getItem('account-host-workspace.members')).toBe(
      membership,
    );
    render('other-scope', 'other-host/workspace');
    render('account-host-workspace', 'host/workspace');
    // The split and its size come back; the files view does not reopen by itself.
    expect(current.value).toMatchObject({
      referenceId: 'peer',
      referenceDeviceId: 'remote-device',
      mode: 'thread',
      ratio: 40,
    });
    act(() => current.update({ referenceDeviceId: null }));
    expect(
      JSON.parse(localStorage.getItem('account-host-workspace.members')!),
    ).toMatchObject({ referenceId: 'peer', referenceDeviceId: null });
  });
});
