import {
  translate
} from "./chunk-UAYJOJDD.js";

// src/plugins/builtin-plugin-modules.tsx
import { terminalPluginManifest } from "@pockymoe/plugin-terminal";

// src/plugins/deepseek-harness-plugin.ts
var DEEPSEEK_HARNESS_PLUGIN_ID = "remote-codex.deepseek-harness";
var DEEPSEEK_HARNESS_PANEL_KIND = "harness:deepseek";
var deepseekHarnessPlugin = {
  manifest: {
    id: DEEPSEEK_HARNESS_PLUGIN_ID,
    name: "DeepSeek Harness",
    version: "0.1.0",
    get description() {
      return translate("workbench.deepseekHarnessPluginDescription");
    },
    remoteCodex: ">=0.12.0",
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [
        { id: "deepseek-harness", label: "DeepSeek Harness", kind: DEEPSEEK_HARNESS_PANEL_KIND, artifactTypes: [] }
      ]
    }
  },
  threadPanels: [
    {
      id: "deepseek-harness",
      kind: DEEPSEEK_HARNESS_PANEL_KIND,
      get label() {
        return translate("workbench.deepseekHarness");
      }
    }
  ]
};

// src/plugins/builtin-plugin-modules.tsx
var builtinFrontendPlugins = [
  {
    manifest: terminalPluginManifest,
    threadPanels: [
      {
        id: "terminal",
        kind: "terminal",
        get label() {
          return translate("workbench.terminal");
        }
      }
    ]
  },
  deepseekHarnessPlugin
];
export {
  DEEPSEEK_HARNESS_PANEL_KIND,
  DEEPSEEK_HARNESS_PLUGIN_ID,
  builtinFrontendPlugins,
  builtinFrontendPlugins as defaultBuiltinFrontendPlugins
};
