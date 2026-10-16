import { useCallback, useEffect, useRef, useState } from 'react';

export type ReferenceMode = 'focus' | 'thread' | 'files' | 'collaboration';
export interface WorkbenchPresentation {
  referenceId: string | null;
  /** Null (and legacy absence) resolves to the host device. */
  referenceDeviceId?: string | null;
  mode: ReferenceMode;
  ratio: number;
}
export const defaultPresentation: WorkbenchPresentation = {
  referenceId: null,
  mode: 'focus',
  ratio: 55,
};
export function normalizePresentation(
  members: unknown,
  arrangement: unknown,
): WorkbenchPresentation {
  const m = members as {
    schemaVersion?: number;
    referenceId?: unknown;
    referenceDeviceId?: unknown;
  } | null;
  const a = arrangement as {
    schemaVersion?: number;
    mode?: unknown;
    ratio?: unknown;
  } | null;
  const referenceId =
    m?.schemaVersion === 1 &&
    typeof m.referenceId === 'string' &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(m.referenceId)
      ? m.referenceId
      : null;
  const mode =
    a?.schemaVersion === 1 &&
    ['focus', 'thread', 'files', 'collaboration'].includes(String(a.mode))
      ? (a.mode as ReferenceMode)
      : referenceId
        ? 'thread'
        : 'focus';
  const ratio =
    a?.schemaVersion === 1 &&
    typeof a.ratio === 'number' &&
    Number.isFinite(a.ratio)
      ? Math.max(35, Math.min(65, a.ratio))
      : 55;
  return {
    referenceId,
    ...(m && 'referenceDeviceId' in m
      ? {
          referenceDeviceId:
            referenceId &&
            typeof m.referenceDeviceId === 'string' &&
            /^[a-zA-Z0-9_-]{1,128}$/.test(m.referenceDeviceId)
              ? m.referenceDeviceId
              : null,
        }
      : {}),
    mode: mode === 'thread' && !referenceId ? 'focus' : mode,
    ratio,
  };
}
function read(scope: string | null): WorkbenchPresentation {
  if (!scope) return defaultPresentation;
  const parse = (suffix: string) => {
    try {
      return JSON.parse(localStorage.getItem(`${scope}.${suffix}`) ?? 'null');
    } catch {
      return null;
    }
  };
  const saved = normalizePresentation(parse('members'), parse('arrangement'));
  // A thread always opens on its conversation: the files view is opened, not restored.
  return saved.mode === 'files' ? { ...saved, mode: saved.referenceId ? 'thread' : 'focus' } : saved;
}
function write(
  scope: string,
  value: WorkbenchPresentation,
  patch: Partial<WorkbenchPresentation>,
): boolean {
  try {
    // Do not rewrite membership for a resize or mode change.
    if ('referenceId' in patch || 'referenceDeviceId' in patch)
      localStorage.setItem(
        `${scope}.members`,
        JSON.stringify({
          schemaVersion: 1,
          referenceId: value.referenceId,
          referenceDeviceId: value.referenceDeviceId ?? null,
        }),
      );
    localStorage.setItem(
      `${scope}.arrangement`,
      JSON.stringify({
        schemaVersion: 1,
        mode: value.mode,
        ratio: value.ratio,
      }),
    );
    return false;
  } catch {
    return true;
  }
}
/** Members and arrangement are independent. Pending identity never discards an explicit layout action. */
export function useWorkbenchPresentation(
  scope: string | null,
  contextKey: string | null = null,
) {
  const owner = useRef({ scope, contextKey });
  if (owner.current.scope !== scope || owner.current.contextKey !== contextKey)
    owner.current = { scope, contextKey };
  const generation = owner.current;
  const [stored, setStored] = useState(() => ({
    generation,
    value: read(scope),
    storageFailed: false,
    pending: null as Partial<WorkbenchPresentation> | null,
  }));
  // Only actions made in the current unresolved profile can cross into its resolved
  // identity. A previous account/device's resolved layout never crosses scopes.
  const pending =
    stored.generation.scope === null &&
    stored.generation.contextKey === contextKey
      ? stored.pending
      : null;
  const value =
    stored.generation === generation
      ? stored.value
      : { ...read(scope), ...pending };
  if (stored.generation !== generation)
    setStored({ generation, value, storageFailed: false, pending });
  useEffect(() => {
    if (!scope || stored.generation !== generation || !stored.pending) return;
    const storageFailed = write(scope, stored.value, stored.pending);
    setStored((previous) =>
      previous === stored
        ? { ...previous, pending: null, storageFailed }
        : previous,
    );
  }, [scope, stored, generation]);
  const update = useCallback(
    (patch: Partial<WorkbenchPresentation>) => {
      if (owner.current !== generation) return;
      setStored((previous) => {
        if (owner.current !== generation) return previous;
        const next = {
          ...(previous.generation === generation
            ? previous.value
            : read(scope)),
          ...patch,
        };
        return {
          generation,
          value: next,
          storageFailed: scope ? write(scope, next, patch) : false,
          pending: scope ? null : { ...previous.pending, ...patch },
        };
      });
    },
    [generation, scope],
  );
  return {
    value,
    update,
    storageFailed: stored.generation === generation && stored.storageFailed,
  };
}
