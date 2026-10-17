// src/components/themeHooks.ts
import { useSyncExternalStore } from "react";
var THEME_FEATURES = [
  /** Phones: Home and Chat move from the top bar into the thread drawer. */
  "workbench.phoneDrawerTools",
  /** The model chip shows the agent's avatar and a menu chevron. */
  "composer.modelAvatar",
  /** Icon rows in the slash toolbox and attach menu, a "/" glyph and a paperclip trigger. */
  "composer.richMenus",
  /** A paper plane for Send; the send intents themselves show in every theme. */
  "composer.intentIcons",
  /** Each reply opens with the agent's avatar and name, ahead of the work summary. */
  "transcript.agentByline",
  /** Short Explorer row-menu labels; the node name stays in the accessible name. */
  "explorer.shortMenuLabels",
  /** Code blocks use the CSS-variable Shiki theme (`--shiki-*`). */
  "code.cssSyntaxPalette"
];
function isThemeFeature(value) {
  return typeof value === "string" && THEME_FEATURES.includes(value);
}
var THEME_ATTRIBUTES = ["data-theme-preset", "data-theme-features"];
function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => observer.disconnect();
}
var readPreset = () => document.documentElement.dataset.themePreset ?? "";
var readFeatures = () => document.documentElement.dataset.themeFeatures ?? "";
var readRevision = () => `${readPreset()}|${readFeatures()}`;
function documentThemeFeatures() {
  return readFeatures().split(/\s+/).filter(isThemeFeature);
}
function hasThemeFeature(flag) {
  return readFeatures().split(/\s+/).includes(flag);
}
function useThemeFeature(flag) {
  return useSyncExternalStore(subscribe, () => hasThemeFeature(flag), () => false);
}
function useDocumentThemeRevision() {
  return useSyncExternalStore(subscribe, readRevision, () => "");
}
function shellThemeProps(element) {
  const shell = element?.closest(".thread-ui-shell");
  const effective = shell?.dataset.themeEffective;
  return {
    themeClass: effective === "dark" ? "thread-ui-theme-dark dark" : "",
    "data-theme-effective": effective,
    "data-theme-mode": shell?.dataset.themeMode
  };
}
function cssHexVariable(element, name) {
  if (!element) return void 0;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : void 0;
}

export {
  THEME_FEATURES,
  isThemeFeature,
  documentThemeFeatures,
  useThemeFeature,
  useDocumentThemeRevision,
  shellThemeProps,
  cssHexVariable
};
