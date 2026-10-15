import {
  translate,
  useI18n
} from "./chunk-UN5CYSFA.js";

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

// src/plugins/ContentQualitySettings.tsx
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var presets = [
  "concise",
  "clear",
  "technical",
  "beginner",
  "copyedit"
];
var details = ["short", "balanced", "detailed"];
var defaults = {
  connectionFile: "",
  model: "",
  language: "zh-CN",
  preset: "clear",
  detail: "balanced",
  readerBackground: "",
  minReplyChars: 800,
  autoReplies: true,
  autoDocuments: false,
  documentMode: "review"
};
function readValues(snapshot) {
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !snapshot.values || typeof snapshot.values !== "object" || Array.isArray(snapshot.values)) {
    throw new Error("Invalid plugin settings snapshot");
  }
  const values = { ...defaults };
  for (const key of [
    "connectionFile",
    "model",
    "language",
    "readerBackground"
  ]) {
    if (typeof snapshot.values[key] === "string")
      values[key] = snapshot.values[key];
  }
  if (presets.includes(snapshot.values.preset))
    values.preset = snapshot.values.preset;
  if (details.includes(snapshot.values.detail))
    values.detail = snapshot.values.detail;
  if (typeof snapshot.values.autoReplies === "boolean")
    values.autoReplies = snapshot.values.autoReplies;
  if (typeof snapshot.values.autoDocuments === "boolean")
    values.autoDocuments = snapshot.values.autoDocuments;
  if (typeof snapshot.values.minReplyChars === "number" && Number.isSafeInteger(snapshot.values.minReplyChars) && snapshot.values.minReplyChars >= 0)
    values.minReplyChars = snapshot.values.minReplyChars;
  if (snapshot.values.documentMode === "review" || snapshot.values.documentMode === "rewrite")
    values.documentMode = snapshot.values.documentMode;
  return values;
}
function isConflict(error) {
  if (!error || typeof error !== "object") return false;
  return "statusCode" in error && error.statusCode === 409 || "status" in error && error.status === 409;
}
function ContentQualitySettings({ load, save }) {
  const { t } = useI18n();
  const scope = useId();
  const [values, setValues] = useState(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("loading");
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setStatus("loading");
    try {
      const snapshot = await load();
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setRevision(snapshot.revision);
      setStatus("ready");
    } catch {
      if (id === requestId.current) setStatus("loadError");
    }
  }, [load]);
  const cancelPending = useCallback(() => {
    ++requestId.current;
  }, []);
  useEffect(() => {
    void reload();
    return cancelPending;
  }, [reload, cancelPending]);
  function update(key, value) {
    setValues((current) => current ? { ...current, [key]: value } : current);
    setStatus(
      (current) => current === "saved" || current === "saveError" ? "ready" : current
    );
  }
  async function submit() {
    if (!values || status === "loading" || status === "saving" || status === "conflict" || status === "loadError")
      return;
    const id = ++requestId.current;
    setStatus("saving");
    try {
      const snapshot = await save({ revision, values: { ...values } });
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setRevision(snapshot.revision);
      setStatus("saved");
    } catch (error2) {
      if (id === requestId.current)
        setStatus(isConflict(error2) ? "conflict" : "saveError");
    }
  }
  function field(key, label, control, hint) {
    return /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
      /* @__PURE__ */ jsx("label", { htmlFor: `${scope}-${key}`, children: label }),
      control,
      hint && /* @__PURE__ */ jsx("p", { id: `${scope}-${key}-hint`, children: hint })
    ] });
  }
  const busy = status === "loading" || status === "saving";
  const error = status === "loadError" || status === "saveError" || status === "conflict";
  return /* @__PURE__ */ jsxs(
    "form",
    {
      className: "plugin-settings-form",
      onSubmit: (event) => {
        event.preventDefault();
        void submit();
      },
      "aria-busy": busy,
      children: [
        values && /* @__PURE__ */ jsxs("fieldset", { disabled: busy, className: "plugin-settings-fields", children: [
          field(
            "connectionFile",
            t("quality.connectionFile"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-connectionFile`,
                "aria-describedby": `${scope}-connectionFile-hint`,
                value: values.connectionFile,
                maxLength: 4096,
                autoComplete: "off",
                spellCheck: false,
                onChange: (event) => update("connectionFile", event.target.value)
              }
            ),
            t("quality.connectionFileHint")
          ),
          field(
            "model",
            t("quality.model"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-model`,
                "aria-describedby": `${scope}-model-hint`,
                value: values.model,
                maxLength: 200,
                autoComplete: "off",
                spellCheck: false,
                onChange: (event) => update("model", event.target.value)
              }
            ),
            t("quality.modelHint")
          ),
          field(
            "language",
            t("quality.language"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-language`,
                "aria-describedby": `${scope}-language-hint`,
                value: values.language,
                maxLength: 64,
                required: true,
                onChange: (event) => update("language", event.target.value)
              }
            ),
            t("quality.languageHint")
          ),
          field(
            "preset",
            t("quality.preset"),
            /* @__PURE__ */ jsx(
              "select",
              {
                id: `${scope}-preset`,
                "aria-describedby": `${scope}-preset-hint`,
                value: values.preset,
                onChange: (event) => update(
                  "preset",
                  event.target.value
                ),
                children: presets.map((preset) => /* @__PURE__ */ jsx("option", { value: preset, children: t(`quality.preset.${preset}`) }, preset))
              }
            ),
            t(`quality.preset.${values.preset}.description`)
          ),
          field(
            "detail",
            t("quality.detail"),
            /* @__PURE__ */ jsx(
              "select",
              {
                id: `${scope}-detail`,
                value: values.detail,
                onChange: (event) => update(
                  "detail",
                  event.target.value
                ),
                children: details.map((detail) => /* @__PURE__ */ jsx("option", { value: detail, children: t(`quality.detail.${detail}`) }, detail))
              }
            )
          ),
          field(
            "readerBackground",
            t("quality.readerBackground"),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                id: `${scope}-readerBackground`,
                "aria-describedby": `${scope}-readerBackground-hint`,
                rows: 3,
                value: values.readerBackground,
                maxLength: 2e3,
                onChange: (event) => update("readerBackground", event.target.value)
              }
            ),
            t("quality.readerBackgroundHint")
          ),
          field(
            "minReplyChars",
            t("quality.minReplyChars"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-minReplyChars`,
                type: "number",
                min: 0,
                max: 65536,
                step: 1,
                required: true,
                value: Number.isNaN(values.minReplyChars) ? "" : values.minReplyChars,
                onChange: (event) => update("minReplyChars", event.target.valueAsNumber)
              }
            )
          ),
          /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
            /* @__PURE__ */ jsxs(
              "label",
              {
                className: "plugin-settings-checkbox",
                htmlFor: `${scope}-autoReplies`,
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      id: `${scope}-autoReplies`,
                      "aria-describedby": `${scope}-autoReplies-hint`,
                      type: "checkbox",
                      checked: values.autoReplies,
                      onChange: (event) => update("autoReplies", event.target.checked)
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { children: t("quality.autoReplies") })
                ]
              }
            ),
            /* @__PURE__ */ jsx("p", { id: `${scope}-autoReplies-hint`, children: t("quality.autoRepliesHint") })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
            /* @__PURE__ */ jsxs(
              "label",
              {
                className: "plugin-settings-checkbox",
                htmlFor: `${scope}-autoDocuments`,
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      id: `${scope}-autoDocuments`,
                      "aria-describedby": `${scope}-autoDocuments-hint`,
                      type: "checkbox",
                      checked: values.autoDocuments,
                      onChange: (event) => update("autoDocuments", event.target.checked)
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { children: t("quality.autoDocuments") })
                ]
              }
            ),
            /* @__PURE__ */ jsx("p", { id: `${scope}-autoDocuments-hint`, children: t("quality.autoDocumentsHint") })
          ] }),
          field(
            "documentMode",
            t("quality.documentMode"),
            /* @__PURE__ */ jsxs(
              "select",
              {
                id: `${scope}-documentMode`,
                "aria-describedby": `${scope}-documentMode-hint`,
                value: values.documentMode,
                onChange: (event) => update(
                  "documentMode",
                  event.target.value
                ),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "review", children: t("quality.documentMode.review") }),
                  /* @__PURE__ */ jsx("option", { value: "rewrite", children: t("quality.documentMode.rewrite") })
                ]
              }
            ),
            t("quality.documentModeHint")
          )
        ] }),
        status !== "ready" && /* @__PURE__ */ jsx(
          "p",
          {
            role: error ? "alert" : "status",
            className: error ? "plugin-settings-error" : void 0,
            children: t(
              status === "loading" ? "quality.loading" : status === "saving" ? "quality.saving" : status === "saved" ? "quality.saved" : status === "conflict" ? "quality.conflict" : status === "loadError" ? "quality.loadError" : "quality.saveError"
            )
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "plugin-settings-actions", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              className: "plugin-settings-save",
              disabled: !values || busy || status === "conflict" || status === "loadError",
              children: t("quality.save")
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: busy,
              onClick: () => void reload(),
              "aria-describedby": `${scope}-reload-hint`,
              children: t("quality.reload")
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { id: `${scope}-reload-hint`, className: "plugin-settings-hint", children: t("quality.reloadHint") })
      ]
    }
  );
}

// src/plugins/content-quality-plugin.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var CONTENT_QUALITY_PLUGIN_ID = "pockymoe.content-quality";
var contentQualityPlugin = {
  defaultEnabled: false,
  manifest: {
    id: CONTENT_QUALITY_PLUGIN_ID,
    get name() {
      return translate("quality.name");
    },
    version: "0.1.0",
    get description() {
      return translate("quality.description");
    },
    remoteCodex: ">=0.13.6",
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [],
      actions: ["rewriteReply", "reviewDocument", "testConnection", "afterTurn"]
    }
  },
  settingsSections: [
    {
      id: "quality",
      get label() {
        return translate("quality.name");
      },
      get description() {
        return translate("quality.description");
      },
      render: (context) => /* @__PURE__ */ jsx2(ContentQualitySettings, { ...context })
    }
  ],
  presentMessage: ({ item, streaming }) => {
    const reply = item.polishedReply;
    if (item.kind !== "agentMessage" || streaming || !reply || typeof reply.text !== "string" || !reply.text.trim() || typeof reply.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(reply.sourceHash))
      return null;
    return {
      id: `quality:${reply.sourceHash}:${reply.createdAt}`,
      text: reply.text,
      label: translate("quality.polished"),
      originalLabel: translate("quality.original"),
      validate: async () => {
        const hash = await globalThis.crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(item.text)
        );
        return Array.from(
          new Uint8Array(hash),
          (byte) => byte.toString(16).padStart(2, "0")
        ).join("") === reply.sourceHash;
      }
    };
  }
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
  deepseekHarnessPlugin,
  contentQualityPlugin
];
export {
  CONTENT_QUALITY_PLUGIN_ID,
  DEEPSEEK_HARNESS_PANEL_KIND,
  DEEPSEEK_HARNESS_PLUGIN_ID,
  builtinFrontendPlugins,
  builtinFrontendPlugins as defaultBuiltinFrontendPlugins
};
