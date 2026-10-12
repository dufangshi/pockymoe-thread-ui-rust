/* The canonical agent key that themes use for agent art (`[data-agent="…"]`).
   Thread ids ("claude-code", "dsh"), harness labels ("Claude Code", "GitHub
   Copilot CLI") and providers all map to the same key, so a theme pack only
   needs one entry per agent family. */

const AGENT_FAMILIES: readonly (readonly [key: string, matches: (value: string) => boolean])[] = [
  ['claude', (value) => value.includes('claude')],
  ['opencode', (value) => value.includes('opencode')],
  ['codex', (value) => value.includes('codex')],
  ['deepseek', (value) => value.includes('deepseek') || value === 'dsh'],
  ['copilot', (value) => value.includes('copilot')],
  ['gemini', (value) => value.includes('gemini')],
  ['grok', (value) => value.includes('grok')],
  ['cursor', (value) => value.includes('cursor')],
  ['qwen', (value) => value.includes('qwen')],
  ['kimi', (value) => value.includes('kimi')],
];

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  copilot: 'Copilot',
  cursor: 'Cursor',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  grok: 'Grok',
  kimi: 'Kimi',
  opencode: 'OpenCode',
  qwen: 'Qwen',
};

/** Keys a theme pack may declare art for: lowercase letters and digits in dash-separated words. */
export const THEME_AGENT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The theme agent key for a thread's agent id, provider or harness label;
 *  undefined for nothing or the bare `acp` provider. */
export function themeAgentKey(value: string | null | undefined): string | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'acp') return undefined;
  const family = AGENT_FAMILIES.find(([, matches]) => matches(normalized));
  if (family) return family[0];
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
  return slug || undefined;
}

/** The key for a thread: its agent id, else its provider. */
export function threadThemeAgentKey(thread: { provider?: string | null; agentId?: string | null }) {
  return themeAgentKey(thread.agentId || thread.provider);
}

/** Display name for an agent: the family name, else the raw id in title case. */
export function themeAgentName(raw: string, key = themeAgentKey(raw)) {
  if (key && AGENT_NAMES[key]) return AGENT_NAMES[key];
  return raw.trim().toLowerCase().replace(/(^|[-_ ])(\w)/g, (_, gap: string, letter: string) => `${gap ? ' ' : ''}${letter.toUpperCase()}`);
}
