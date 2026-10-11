import { createContext, useContext, type ReactNode } from 'react';

import { useDocumentThemePreset } from '../themeHooks';

/* The agent that answers in a transcript. Theme presets that present replies as
   coming from a character (Plum Pocket) show its avatar and name; the Classic
   preset renders nothing. */

export interface TranscriptAgent {
  /** Avatar key, matching `.matter-thread-avatar[data-agent]`. */
  agent: string;
  name: string;
}

const TranscriptAgentContext = createContext<TranscriptAgent | null>(null);

const AGENT_NAMES: Record<string, string> = {
  codex: 'Codex',
  claude: 'Claude',
  'claude-code': 'Claude',
  deepseek: 'DeepSeek',
  dsh: 'DeepSeek',
  gemini: 'Gemini',
  grok: 'Grok',
  cursor: 'Cursor',
  copilot: 'Copilot',
  opencode: 'OpenCode',
  qwen: 'Qwen',
  kimi: 'Kimi',
};

export function transcriptAgentFor(thread: { provider?: string | null; agentId?: string | null }): TranscriptAgent | null {
  const agent = (thread.agentId || thread.provider || '').trim().toLowerCase();
  if (!agent || agent === 'acp') return null;
  const name = AGENT_NAMES[agent] ?? agent.replace(/(^|[-_ ])(\w)/g, (_, gap: string, letter: string) => `${gap ? ' ' : ''}${letter.toUpperCase()}`);
  return { agent, name };
}

export function TranscriptAgentProvider({ agent, children }: { agent: TranscriptAgent | null; children: ReactNode }) {
  return <TranscriptAgentContext.Provider value={agent}>{children}</TranscriptAgentContext.Provider>;
}

/** True when the active preset presents replies with the agent's identity. */
export function useTranscriptAgentIdentity() {
  return useDocumentThemePreset() === 'plum-pocket';
}

/** Avatar and name in front of a turn's work summary; only for presets that show them. */
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
