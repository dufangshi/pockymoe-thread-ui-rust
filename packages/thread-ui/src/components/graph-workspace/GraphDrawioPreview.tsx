import { getLocale } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import { useMemo } from 'react';

/** The hosting app serves the pinned official viewer locally, like 3Dmol. */
export const DRAWIO_VIEWER_PATH = '/vendor/drawio/viewer-static.v32.3.0.min.js';
export const DRAWIO_BOOTSTRAP_PATH = '/vendor/drawio/bootstrap.v2.js';

export function drawioPreviewDocument(xml: string, origin: string) {
  const viewerUrl = new URL(DRAWIO_VIEWER_PATH, origin).href;
  const bootstrapUrl = new URL(DRAWIO_BOOTSTRAP_PATH, origin).href;
  // XML is data, never HTML or executable script. Escaping '<' also protects
  // script closing tags embedded in diagram labels or comments.
  const data = JSON.stringify(xml).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${viewerUrl} ${bootstrapUrl}; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'">
<style>html,body{height:100%;margin:0;background:#fff;color:#222;font:14px system-ui;overflow:hidden}#diagram{position:absolute;inset:0;overflow:auto}#error{padding:20px;white-space:pre-wrap}button,select{font:inherit}</style>
</head><body><div id="diagram"></div><p id="loading" role="status">${translate('files.loadingDiagram')}</p><div id="error" role="alert" hidden></div>
<script id="diagram-data" type="application/json">${data}</script>
<script src="${bootstrapUrl}"></script></body></html>`;
}

export function GraphDrawioPreview({ content, name, truncated }: { content: string; name: string; truncated: boolean }) {
  const { locale } = useI18n();
  const srcDoc = useMemo(() => drawioPreviewDocument(content, typeof window === 'undefined' ? 'http://localhost' : window.location.origin), [content, locale]);
  if (truncated) return <p role="status" className="p-5 text-sm">{translate("files.diagramPreviewRequiresTheCompleteFileLoad")}</p>;
  return (
    <iframe
      title={translate("files.drawIoPreview", { value1: name })}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className="min-h-0 w-full flex-1 border-0"
      style={{ minHeight: 260, background: '#fff' }}
    />
  );
}
