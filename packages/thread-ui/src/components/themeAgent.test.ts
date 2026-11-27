import { describe, expect, it } from 'vitest';

import { THEME_AGENT_KEY_PATTERN, agentDisplayName, agentKeyOf, themeAgentKey, themeAgentName, threadAgentKey, threadThemeAgentKey } from './themeAgent';

describe('themeAgentKey', () => {
  it('maps ids, providers and harness labels of one family to the same key', () => {
    for (const value of ['claude', 'Claude Code', 'claude-code', 'claude-acp']) expect(themeAgentKey(value)).toBe('claude');
    for (const value of ['deepseek', 'DeepSeek Harness', 'dsh']) expect(themeAgentKey(value)).toBe('deepseek');
    expect(themeAgentKey('GitHub Copilot CLI')).toBe('copilot');
    expect(themeAgentKey('Gemini CLI')).toBe('gemini');
    for (const value of ['antigravity', 'Google Antigravity', 'agy']) expect(themeAgentKey(value)).toBe('antigravity');
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
    expect(themeAgentName('antigravity')).toBe('Antigravity');
    expect(themeAgentName('my-agent')).toBe('My Agent');
  });
});

describe('agent keys', () => {
  it('keys ACP Codex and Claude threads apart from their native default', () => {
    expect(threadAgentKey({ provider: 'acp', agentId: 'codex', harnessProtocol: 'acp' })).toBe('acp:codex');
    expect(threadAgentKey({ provider: 'acp', agentId: 'claude', harnessProtocol: 'native' })).toBe('claude');
    // Older runtimes send no protocol; ACP-only agents never have one.
    expect(threadAgentKey({ provider: 'acp', agentId: 'codex' })).toBe('codex');
    expect(threadAgentKey({ provider: 'acp', agentId: 'opencode' })).toBe('opencode');
    expect(threadAgentKey({ provider: 'claude', agentId: null })).toBe('claude');
    expect(threadAgentKey({ provider: 'acp' })).toBeNull();
    expect(agentKeyOf('acp:codex', 'acp')).toBe('acp:codex');
  });

  it('names an ACP variant "ACP · <agent>" and keeps the agent\'s art', () => {
    expect(agentDisplayName('acp:codex', 'Codex')).toBe('ACP · Codex');
    expect(agentDisplayName('acp:claude', 'Claude Code')).toBe('ACP · Claude Code');
    expect(agentDisplayName('claude', 'Claude Code')).toBe('Claude Code');
    expect(agentDisplayName('opencode')).toBe('OpenCode');
    expect(themeAgentName('acp:codex')).toBe('ACP · Codex');
    expect(themeAgentKey('acp:claude')).toBe('claude');
    expect(themeAgentKey('acp:my-agent')).toBe('my-agent');
  });
});
