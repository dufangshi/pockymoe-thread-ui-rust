import { describe, expect, it } from 'vitest';
import { closeFilesPatch, normalizePresentation, openFilesPatch, splitShown } from './presentation';
describe('workbench presentation recovery', () => {
  it('keeps the member when arrangement is corrupt or a future schema', () => {
    const members = { schemaVersion: 1, referenceId: 'thread-b' };
    expect(normalizePresentation(members, null)).toEqual({
      referenceId: 'thread-b',
      mode: 'thread',
      ratio: 55,
    });
    expect(
      normalizePresentation(members, { schemaVersion: 99, mode: 'files' })
        .referenceId,
    ).toBe('thread-b');
  });
  it('clamps usable ratios and rejects invalid targets without reviving a composer', () => {
    expect(
      normalizePresentation(
        { schemaVersion: 1, referenceId: '../wrong' },
        { schemaVersion: 1, mode: 'thread', ratio: 999 },
      ),
    ).toEqual({ referenceId: null, mode: 'focus', ratio: 65 });
    expect(
      normalizePresentation(null, {
        schemaVersion: 1,
        mode: 'files',
        ratio: Number.NaN,
      }),
    ).toEqual({ referenceId: null, mode: 'files', ratio: 55 });
  });
});

describe('cross-device split membership', () => {
  it('migrates host-relative members and validates remote device identity independently', () => {
    expect(
      normalizePresentation({ schemaVersion: 1, referenceId: 'peer' }, null)
        .referenceDeviceId,
    ).toBeUndefined();
    expect(
      normalizePresentation(
        {
          schemaVersion: 1,
          referenceId: 'peer',
          referenceDeviceId: 'device-b',
        },
        null,
      ),
    ).toMatchObject({ referenceId: 'peer', referenceDeviceId: 'device-b' });
    expect(
      normalizePresentation(
        {
          schemaVersion: 1,
          referenceId: 'peer',
          referenceDeviceId: '../invalid',
        },
        null,
      ),
    ).toMatchObject({ referenceId: 'peer', referenceDeviceId: null });
    expect(
      normalizePresentation(
        { schemaVersion: 1, referenceId: null, referenceDeviceId: 'device-b' },
        null,
      ),
    ).toMatchObject({ referenceId: null, referenceDeviceId: null });
  });
});

describe('the files view over a split', () => {
  const split = { referenceId: 'b', mode: 'thread' as const, ratio: 55 };
  it('keeps an open split beside it and returns to it', () => {
    const files = { ...split, ...openFilesPatch(split) };
    expect(files).toMatchObject({ mode: 'files', filesOver: 'thread' });
    expect(splitShown(files)).toBe(true);
    expect(closeFilesPatch(files)).toEqual({ mode: 'thread' });
  });
  it('does not reopen a split that was closed', () => {
    const closed = { ...split, mode: 'focus' as const };
    const files = { ...closed, ...openFilesPatch(closed) };
    expect(splitShown(files)).toBe(false);
    expect(closeFilesPatch(files)).toEqual({ mode: 'focus' });
  });
  it('restores what it opened over', () => {
    expect(normalizePresentation({ schemaVersion: 1, referenceId: 'b' }, { schemaVersion: 1, mode: 'files', filesOver: 'focus', ratio: 55 }).filesOver).toBe('focus');
  });
});
