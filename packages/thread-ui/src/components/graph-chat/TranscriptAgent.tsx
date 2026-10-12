import { createContext, useContext, type ReactNode } from 'react';

import { themeAgentName, threadThemeAgentKey } from '../themeAgent';
import { useThemeFeature } from '../themeHooks';

/* The agent that answers in a transcript. Themes that present replies as coming
   from a character (the `transcript.agentByline` flag) show its avatar and name;
   otherwise nothing renders. */

export interface TranscriptAgent {
  /** Canonical theme agent key, matching `.matter-thread-avatar[data-agent]`. */
  agent: string;
  name: string;
}

const TranscriptAgentContext = createContext<TranscriptAgent | null>(null);

export function transcriptAgentFor(thread: { provider?: string | null; agentId?: string | null }): TranscriptAgent | null {
  const agent = threadThemeAgentKey(thread);
  if (!agent) return null;
  return { agent, name: themeAgentName(thread.agentId || thread.provider || '', agent) };
}

export function TranscriptAgentProvider({ agent, children }: { agent: TranscriptAgent | null; children: ReactNode }) {
  return <TranscriptAgentContext.Provider value={agent}>{children}</TranscriptAgentContext.Provider>;
}

/** True when the applied theme presents replies with the agent's identity. */
export function useTranscriptAgentIdentity() {
  return useThemeFeature('transcript.agentByline');
}

/** Avatar and name in front of a turn's work summary; only for themes that show them. */
export function TranscriptAgentByline({ size = 'regular' }: { size?: 'regular' | 'small' }) {
  const agent = useContext(TranscriptAgentContext);
  const show = useTranscriptAgentIdentity();
  if (!show || !agent) return null;
  return (
    <span className={`thread-transcript-agent is-${size}`} data-agent={agent.agent}>
      <span className="matter-thread-avatar" data-agent={agent.agent} aria-hidden="true" />
      {size === 'regular' ? <span className="thread-transcript-agent-name">{agent.name}</span> : null}
    </span>
  );
}
