// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  basenameFromPath,
  buildPromptLabel,
  clampPaneRatio,
  statusLabel,
  terminalThemeFor,
} from './shellPresentation';

describe('shell presentation helpers', () => {
  it('formats shell status labels', () => {
    expect(statusLabel('not_created')).toBe('Not created');
    expect(statusLabel('attached')).toBe('Attached');
    expect(statusLabel('workspace_missing')).toBe('Workspace missing');
  });

  it('builds compact path and prompt labels', () => {
    expect(basenameFromPath('/home/u/project/')).toBe('project');
    expect(basenameFromPath('C:\\Users\\me\\repo')).toBe('repo');
    expect(basenameFromPath(null)).toBe('');
    expect(buildPromptLabel('repo', 'venv')).toBe('venv repo');
    expect(buildPromptLabel('repo', null)).toBe('repo');
    expect(buildPromptLabel('', '  ')).toBeNull();
  });

  it('clamps pane ratios and selects theme colors', () => {
    expect(clampPaneRatio(10)).toBe(25);
    expect(clampPaneRatio(50)).toBe(50);
    expect(clampPaneRatio(90)).toBe(75);
    // The terminal matches the workbench panel surfaces.
    expect(terminalThemeFor('light').background).toBe('#ebeeeb');
    expect(terminalThemeFor('dark').background).toBe('#0f1317');
  });

  it('lets a theme preset override the terminal surface with hex CSS variables', () => {
    const container = document.createElement('div');
    container.style.setProperty('--terminal-bg', '#150b1a');
    container.style.setProperty('--terminal-selection', '#f0b54a47');
    container.style.setProperty('--terminal-fg', 'plum');
    document.body.append(container);
    const theme = terminalThemeFor('dark', container);
    expect(theme.background).toBe('#150b1a');
    expect(theme.cursorAccent).toBe('#150b1a');
    expect(theme.selectionBackground).toBe('#f0b54a47');
    expect(theme.foreground).toBe('#d6dde6');
    container.remove();
  });

  it('lets a theme preset override ANSI colors by kebab-case name', () => {
    const container = document.createElement('div');
    container.style.setProperty('--terminal-red', '#ff8fa3');
    container.style.setProperty('--terminal-bright-black', '#9a88a3');
    document.body.append(container);
    const theme = terminalThemeFor('dark', container);
    expect(theme.red).toBe('#ff8fa3');
    expect(theme.brightBlack).toBe('#9a88a3');
    expect(theme.green).toBe('#4ade80');
    container.remove();
  });
});
