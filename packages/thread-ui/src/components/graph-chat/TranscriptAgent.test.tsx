// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { TranscriptAgentByline, TranscriptAgentProvider, transcriptAgentFor } from './TranscriptAgent';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(features: string | null) {
  if (features) document.documentElement.dataset.themeFeatures = features;
  else delete document.documentElement.dataset.themeFeatures;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <TranscriptAgentProvider agent={transcriptAgentFor({ provider: 'acp', agentId: 'deepseek' })}>
        <TranscriptAgentByline />
      </TranscriptAgentProvider>,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  delete document.documentElement.dataset.themeFeatures;
});

describe('TranscriptAgent', () => {
  it('names known agents, title-cases others and ignores the bare ACP provider', () => {
    expect(transcriptAgentFor({ provider: 'codex' })).toEqual({ agent: 'codex', name: 'Codex' });
    expect(transcriptAgentFor({ provider: 'acp', agentId: 'claude' })).toEqual({ agent: 'claude', name: 'Claude' });
    expect(transcriptAgentFor({ provider: 'acp', agentId: 'my-agent' })).toEqual({ agent: 'my-agent', name: 'My Agent' });
    expect(transcriptAgentFor({ provider: 'acp', agentId: 'claude-code' })).toEqual({ agent: 'claude', name: 'Claude' });
    expect(transcriptAgentFor({ provider: 'acp', agentId: 'dsh' })).toEqual({ agent: 'deepseek', name: 'DeepSeek' });
    expect(transcriptAgentFor({ provider: 'acp', agentId: null })).toBeNull();
  });

  it('shows the avatar and name only for themes with the agent byline flag', () => {
    expect(render(null).innerHTML).toBe('');
    act(() => root?.unmount());
    container?.remove();
    expect(render('composer.richMenus').innerHTML).toBe('');
    act(() => root?.unmount());
    container?.remove();
    const element = render('transcript.agentByline');
    expect(element.querySelector('.matter-thread-avatar')?.getAttribute('data-agent')).toBe('deepseek');
    expect(element.querySelector('.thread-transcript-agent-name')?.textContent).toBe('DeepSeek');
  });
});
