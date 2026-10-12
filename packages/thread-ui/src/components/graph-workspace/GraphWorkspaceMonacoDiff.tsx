import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import { editorThemeFor } from './GraphWorkspaceMonacoEditor';
import { useDocumentThemeRevision } from '../themeHooks';
import { translate } from '../../i18n';
export default function WorkspaceDocumentDiff({
  original,
  modified,
  language,
  dark,
  compact,
}: {
  original: string;
  modified: string;
  language: string;
  dark: boolean;
  compact: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const themeRevision = useDocumentThemeRevision();
  useEffect(() => {
    if (!host.current) return;
    const left = monaco.editor.createModel(
      original,
      language === 'text' ? 'plaintext' : language,
    );
    const right = monaco.editor.createModel(
      modified,
      language === 'text' ? 'plaintext' : language,
    );
    const editor = monaco.editor.createDiffEditor(host.current, {
      readOnly: true,
      automaticLayout: true,
      renderSideBySide: !compact,
      originalEditable: false,
      theme: editorThemeFor(dark, host.current),
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      ariaLabel: translate('files.safeCompare'),
    });
    editor.setModel({ original: left, modified: right });
    return () => {
      editor.dispose();
      left.dispose();
      right.dispose();
    };
  }, [original, modified, language, dark, compact, themeRevision]);
  return (
    <div
      ref={host}
      className="h-full w-full"
      data-testid="workspace-conflict-diff"
    />
  );
}
