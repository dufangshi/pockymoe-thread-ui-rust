import { useSyncExternalStore } from 'react';

/* The host applies a theme pack on `<html>`: `data-theme-preset` names it and
   `data-theme-features` lists the capability flags it declares (space separated).
   Components switch extra markup on flags, never on a pack's name. Components that
   paint with JavaScript palettes (xterm, Monaco) cannot follow CSS variables by
   themselves; they read optional hex colors (`--terminal-*`, `--editor-*`) and
   re-read them when the theme changes. */

/** Capability flags a theme pack may declare in `theme.json` `features`. Unknown
 *  flags are ignored. Version 1 of the catalog; see docs/theme-packs.md. */
export const THEME_FEATURES = [
  /** Phones: Home and Chat move from the top bar into the thread drawer. */
  'workbench.phoneDrawerTools',
  /** The model chip shows the agent's avatar and a menu chevron. */
  'composer.modelAvatar',
  /** Icon rows in the slash toolbox and attach menu, a "/" glyph and a paperclip trigger. */
  'composer.richMenus',
  /** A paper plane for Send; the send intents themselves show in every theme. */
  'composer.intentIcons',
  /** Each reply opens with the agent's avatar and name, ahead of the work summary. */
  'transcript.agentByline',
  /** Short Explorer row-menu labels; the node name stays in the accessible name. */
  'explorer.shortMenuLabels',
  /** Code blocks use the CSS-variable Shiki theme (`--shiki-*`). */
  'code.cssSyntaxPalette',
] as const;
export type ThemeFeature = (typeof THEME_FEATURES)[number];

export function isThemeFeature(value: unknown): value is ThemeFeature {
  return typeof value === 'string' && (THEME_FEATURES as readonly string[]).includes(value);
}

const THEME_ATTRIBUTES = ['data-theme-preset', 'data-theme-features'];

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => observer.disconnect();
}
const readPreset = () => document.documentElement.dataset.themePreset ?? '';
const readFeatures = () => document.documentElement.dataset.themeFeatures ?? '';
const readRevision = () => `${readPreset()}|${readFeatures()}`;

/** The flags of the applied theme pack. */
export function documentThemeFeatures(): ThemeFeature[] {
  return readFeatures().split(/\s+/).filter(isThemeFeature);
}

/** True when the applied theme pack declares `flag`. */
export function hasThemeFeature(flag: ThemeFeature) {
  return readFeatures().split(/\s+/).includes(flag);
}

/** Whether the applied theme pack declares `flag`; re-renders when the theme changes. */
export function useThemeFeature(flag: ThemeFeature) {
  return useSyncExternalStore(subscribe, () => hasThemeFeature(flag), () => false);
}

/** Changes whenever the host applies another theme pack or flag set: a trigger for
 *  components that re-read CSS variables into JavaScript palettes. */
export function useDocumentThemeRevision() {
  return useSyncExternalStore(subscribe, readRevision, () => '');
}

/** The shell theme around `element`, for UI portaled to `document.body`: without
 *  it a portaled `.thread-ui-shell` takes the light palette under a dark shell. */
export function shellThemeProps(element: Element | null | undefined) {
  const shell = element?.closest<HTMLElement>('.thread-ui-shell');
  const effective = shell?.dataset.themeEffective;
  return {
    themeClass: effective === 'dark' ? 'thread-ui-theme-dark dark' : '',
    'data-theme-effective': effective,
    'data-theme-mode': shell?.dataset.themeMode,
  };
}

/** A `#rrggbb` or `#rrggbbaa` custom property inherited by `element`. */
export function cssHexVariable(element: Element | null | undefined, name: string) {
  if (!element) return undefined;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : undefined;
}
