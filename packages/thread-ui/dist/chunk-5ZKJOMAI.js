// src/components/shortcuts.ts
var storeKey = /* @__PURE__ */ Symbol.for("pockymoe.shortcut-platform");
var store = globalThis;
var state = store[storeKey] ??= { host: null };
function setHostPlatform(platform) {
  state.host = platform || null;
}
function isMacPlatform() {
  if (state.host) return state.host === "darwin" || state.host === "ios";
  if (typeof navigator === "undefined") return false;
  const hinted = navigator.userAgentData?.platform;
  return /^(?:mac|iphone|ipad|ipod|ios)/i.test(hinted || navigator.platform || "");
}
function matchesModKey(event) {
  return isMacPlatform() ? Boolean(event.metaKey) && !event.ctrlKey : Boolean(event.ctrlKey) && !event.metaKey;
}
function matchesSendModKey(event) {
  return Boolean(event.metaKey || event.ctrlKey);
}
var MAC_SYMBOLS = { ctrl: "\u2303", alt: "\u2325", shift: "\u21E7", mod: "\u2318" };
var MAC_ORDER = ["ctrl", "alt", "shift", "mod"];
var NAMES = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", mod: "Ctrl" };
function formatShortcut(shortcut) {
  const parts = shortcut.split("+").map((part) => part.trim());
  const last = parts.pop() ?? "";
  const key = last.length === 1 ? last.toUpperCase() : last;
  const modifiers = parts.map((part) => part.toLowerCase());
  if (!isMacPlatform()) return [...modifiers.map((name) => NAMES[name] ?? name), key].join("+");
  return MAC_ORDER.filter((name) => modifiers.includes(name)).map((name) => MAC_SYMBOLS[name]).join("") + key;
}

export {
  setHostPlatform,
  isMacPlatform,
  matchesModKey,
  matchesSendModKey,
  formatShortcut
};
