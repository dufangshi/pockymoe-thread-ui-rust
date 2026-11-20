import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceFileLink } from './WorkspaceFileLink';
import type { WorkspacePathResolver } from './workspacePathLinks';

export function VerifiedWorkspacePath({ target, resolve, onOpen, children }: {
  target: { path: string; line?: number };
  resolve: WorkspacePathResolver;
  onOpen: (input: { path: string; line?: number }) => void;
  children: ReactNode;
}) {
  // Start from the resolver's settled answer and keep the last answer while a
  // new resolver re-checks: the link must not blink while the page re-renders
  // (typing in the composer, a poll) or a message remounts.
  const [verified, setVerified] = useState<{ path: string; exists: boolean } | null>(() => {
    const known = resolve.peek?.(target.path);
    return known === undefined ? null : { path: target.path, exists: known };
  });
  useEffect(() => {
    let current = true;
    void resolve(target.path).then(exists => {
      if (current) setVerified(previous => previous?.path === target.path && previous.exists === exists ? previous : { path: target.path, exists });
    }).catch(() => { if (current) setVerified({ path: target.path, exists: false }); });
    return () => { current = false; };
  }, [target.path, resolve]);
  return verified?.path === target.path && verified.exists
    ? <WorkspaceFileLink {...target} onOpen={onOpen}>{children}</WorkspaceFileLink>
    : <>{children}</>;
}
