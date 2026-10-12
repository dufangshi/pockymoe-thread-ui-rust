import { describe, expect, it } from 'vitest';

import { THEME_AGENT_KEY_PATTERN, themeAgentKey, themeAgentName, threadThemeAgentKey } from './themeAgent';

describe('themeAgentKey', () => {
  it('maps ids, providers and harness labels of one family to the same key', () => {
    for (const value of ['claude', 'Claude Code', 'claude-code', 'claude-acp']) expect(themeAgentKey(value)).toBe('claude');
    for (const value of ['deepseek', 'DeepSeek Harness', 'dsh']) expect(themeAgentKey(value)).toBe('deepseek');
    expect(themeAgentKey('GitHub Copilot CLI')).toBe('copilot');
    expect(themeAgentKey('Gemini CLI')).toBe('gemini');
    expect(themeAgentKey('Grok Build')).toBe('grok');
    expect(themeAgentKey('OpenCode')).toBe('opencode');
    expect(themeAgentKey('cursor-agent')).toBe('cursor');
    expect(themeAgentKey('Codex')).toBe('codex');
  });

  it('slugs other agents and ignores the bare ACP provider', () => {
    expect(themeAgentKey('My Agent')).toBe('my-agent');
    expect(themeAgentKey('  acp ')).toBeUndefined();
    expect(themeAgentKey('')).toBeUndefined();
    expect(themeAgentKey(null)).toBeUndefined();
    expect(themeAgentKey('---')).toBeUndefined();
    for (const value of ['My Agent', 'x'.repeat(80), 'a__b..c']) expect(themeAgentKey(value)).toMatch(THEME_AGENT_KEY_PATTERN);
  });

  it('prefers the agent id over the provider and names agents', () => {
    expect(threadThemeAgentKey({ provider: 'acp', agentId: 'Codex' })).toBe('codex');
    expect(threadThemeAgentKey({ provider: 'claude', agentId: null })).toBe('claude');
    expect(threadThemeAgentKey({ provider: 'acp' })).toBeUndefined();
    expect(themeAgentName('claude-code')).toBe('Claude');
    expect(themeAgentName('my-agent')).toBe('My Agent');
  });
});
