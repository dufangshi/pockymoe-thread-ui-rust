// src/components/shell/terminalPreferences.ts
import { useSyncExternalStore } from "react";
var DEFAULT_TERMINAL_PREFERENCES = {
  copyOnSelect: true,
  ctrlV: "smart",
  rightClick: "menu",
  pasteWarning: true
};
var STORAGE_KEY = "pockymoe.terminal";
var listeners = /* @__PURE__ */ new Set();
var cached = null;
function read() {
  if (cached) return cached;
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
  }
  const value = { ...DEFAULT_TERMINAL_PREFERENCES };
  if (typeof stored.copyOnSelect === "boolean") value.copyOnSelect = stored.copyOnSelect;
  if (stored.ctrlV === "smart" || stored.ctrlV === "paste") value.ctrlV = stored.ctrlV;
  if (stored.rightClick === "menu" || stored.rightClick === "copyPaste") value.rightClick = stored.rightClick;
  if (typeof stored.pasteWarning === "boolean") value.pasteWarning = stored.pasteWarning;
  cached = value;
  return value;
}
function subscribe(listener) {
  listeners.add(listener);
  const storage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storage);
  };
}
function terminalPreferences() {
  return read();
}
function setTerminalPreferences(change) {
  cached = { ...read(), ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
  }
  for (const listener of listeners) listener();
}
function useTerminalPreferences() {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_TERMINAL_PREFERENCES);
}

export {
  terminalPreferences,
  setTerminalPreferences,
  useTerminalPreferences
};
