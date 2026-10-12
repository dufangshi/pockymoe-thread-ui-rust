// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { THEME_FEATURES, documentThemeFeatures, hasThemeFeature, isThemeFeature, useDocumentThemeRevision, useThemeFeature, type ThemeFeature } from './themeHooks';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Probe({ flag }: { flag: ThemeFeature }) {
  const enabled = useThemeFeature(flag);
  const revision = useDocumentThemeRevision();
  return <output data-enabled={String(enabled)} data-revision={revision} />;
}

function mount(flag: ThemeFeature) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<Probe flag={flag} />));
  return () => host!.querySelector('output')!;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  delete document.documentElement.dataset.themeFeatures;
  delete document.documentElement.dataset.themePreset;
});

describe('theme features', () => {
  it('lists a fixed catalog and ignores unknown flags', () => {
    expect(THEME_FEATURES).toContain('composer.richMenus');
    expect(isThemeFeature('composer.richMenus')).toBe(true);
    expect(isThemeFeature('composer.rich')).toBe(false);
    document.documentElement.dataset.themeFeatures = 'composer.richMenus  future.flag transcript.agentByline';
    expect(documentThemeFeatures()).toEqual(['composer.richMenus', 'transcript.agentByline']);
    expect(hasThemeFeature('composer.richMenus')).toBe(true);
    expect(hasThemeFeature('composer.modelAvatar')).toBe(false);
  });

  it('re-renders when the host applies another pack or flag set', async () => {
    const output = mount('composer.modelAvatar');
    expect(output().dataset.enabled).toBe('false');
    await act(async () => {
      document.documentElement.dataset.themePreset = 'plum-pocket';
      document.documentElement.dataset.themeFeatures = 'composer.modelAvatar';
      await Promise.resolve();
    });
    expect(output().dataset.enabled).toBe('true');
    expect(output().dataset.revision).toBe('plum-pocket|composer.modelAvatar');
    await act(async () => { document.documentElement.dataset.themeFeatures = ''; await Promise.resolve(); });
    expect(output().dataset.enabled).toBe('false');
    expect(output().dataset.revision).toBe('plum-pocket|');
  });
});
