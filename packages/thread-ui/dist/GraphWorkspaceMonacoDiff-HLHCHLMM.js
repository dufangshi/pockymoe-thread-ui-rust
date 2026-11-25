import {
  editorThemeFor
<<<<<<<< HEAD:packages/thread-ui/dist/GraphWorkspaceMonacoDiff-ARO5AYSM.js
} from "./chunk-Y7PJL7OW.js";
========
} from "./chunk-OL27POSN.js";
>>>>>>>> 8faa2c6 (Settings strings: name the device the device-level settings act on):packages/thread-ui/dist/GraphWorkspaceMonacoDiff-HLHCHLMM.js
import {
  useDocumentThemeRevision
} from "./chunk-JIPNJR2N.js";
import {
  translate
<<<<<<<< HEAD:packages/thread-ui/dist/GraphWorkspaceMonacoDiff-ARO5AYSM.js
} from "./chunk-R2LITDNV.js";
========
} from "./chunk-PV62C22N.js";
>>>>>>>> 8faa2c6 (Settings strings: name the device the device-level settings act on):packages/thread-ui/dist/GraphWorkspaceMonacoDiff-HLHCHLMM.js
import {
  editor
} from "./chunk-PEHPFHY2.js";
import "./chunk-SSOM5P4O.js";
import "./chunk-7O5E2ZHX.js";

// src/components/graph-workspace/GraphWorkspaceMonacoDiff.tsx
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
function WorkspaceDocumentDiff({
  original,
  modified,
  language,
  dark,
  compact
}) {
  const host = useRef(null);
  const themeRevision = useDocumentThemeRevision();
  useEffect(() => {
    if (!host.current) return;
    const left = editor.createModel(
      original,
      language === "text" ? "plaintext" : language
    );
    const right = editor.createModel(
      modified,
      language === "text" ? "plaintext" : language
    );
    const editor2 = editor.createDiffEditor(host.current, {
      readOnly: true,
      automaticLayout: true,
      renderSideBySide: !compact,
      originalEditable: false,
      theme: editorThemeFor(dark, host.current),
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      ariaLabel: translate("files.safeCompare")
    });
    editor2.setModel({ original: left, modified: right });
    return () => {
      editor2.dispose();
      left.dispose();
      right.dispose();
    };
  }, [original, modified, language, dark, compact, themeRevision]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: host,
      className: "h-full w-full",
      "data-testid": "workspace-conflict-diff"
    }
  );
}
export {
  WorkspaceDocumentDiff as default
};
