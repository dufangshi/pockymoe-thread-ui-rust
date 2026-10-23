import DOMPurify from 'dompurify';

/** Only infer diagrams in unlabelled/text blocks; never reinterpret program code. */
export function isMermaidCode(language: string, source: string) {
  const label = language.toLowerCase();
  if (label === 'mermaid') return true;
  return ['', 'text', 'plaintext', 'flowchart', 'graph'].includes(label)
    && /^(?:\s|%%[^\n]*(?:\n|$))*(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\b/.test(source);
}

/** Markdown's code node includes the fence, even though its children do not. */
export function hasClosedMarkdownFence(markdown: string, startLine?: number, endLine?: number) {
  if (!startLine || !endLine || endLine <= startLine) return false;
  const lines = markdown.split('\n');
  const opening = lines[startLine - 1]?.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/);
  const closing = lines[endLine - 1]?.match(/^\s*(?:>\s*)*(`{3,}|~{3,})\s*$/);
  return Boolean(opening && closing && opening[1]?.[0] === closing[1]?.[0]
    && closing[1]!.length >= opening[1]!.length);
}

/** Mermaid's code could not be fetched: a page opened before a deployment asks
    for build files that are gone (Chromium and WebKit word it differently). */
export class MermaidLoadError extends Error {}
const moduleLoadFailure = (error: unknown) => error instanceof TypeError
  && /dynamically imported module|module script failed|error loading dynamically|load failed/i.test(error.message);

let library: Promise<typeof import('mermaid')['default']> | undefined;
let queue: Promise<void> = Promise.resolve();
let nextId = 0;

/** Mermaid has global configuration: serialize render jobs, including both split panes. */
export function renderChatMermaid(source: string, dark: boolean, signal?: AbortSignal): Promise<string> {
  const job = queue.then(async () => {
    if (signal?.aborted) throw new Error('Diagram rendering canceled');
    library ??= import('mermaid').then(module => module.default).catch(error => {
      library = undefined;
      throw moduleLoadFailure(error) ? new MermaidLoadError(String((error as Error).message)) : error;
    });
    const mermaid = await library;
    await document.fonts?.ready;
    if (signal?.aborted) throw new Error('Diagram rendering canceled');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      maxTextSize: 50_000,
      maxEdges: 500,
      theme: dark ? 'dark' : 'default',
      fontFamily: 'system-ui, sans-serif',
      secure: ['secure', 'securityLevel', 'startOnLoad', 'suppressErrorRendering',
        'htmlLabels', 'maxTextSize', 'maxEdges', 'theme', 'themeVariables', 'themeCSS',
        'fontFamily', 'dompurifyConfig'],
    });
    if (source.length > 50_000 || !await mermaid.parse(source, { suppressErrors: true })) {
      throw new Error('Invalid Mermaid diagram');
    }
    const id = `thread-mermaid-${++nextId}`;
    try {
      // Mermaid fetches each diagram type's own code on first use.
      const { svg } = await mermaid.render(id, source).catch((error: unknown) => {
        throw moduleLoadFailure(error) ? new MermaidLoadError(String((error as Error).message)) : error;
      });
      return DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['foreignObject'],
      });
    } finally {
      // Also clean up Mermaid's temporary measurement DOM if rendering throws.
      document.getElementById(`d${id}`)?.remove();
    }
  });
  queue = job.then(() => undefined, () => undefined);
  return job;
}
