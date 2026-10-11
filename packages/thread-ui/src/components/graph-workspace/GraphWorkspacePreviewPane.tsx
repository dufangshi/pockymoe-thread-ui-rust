import type { WorkspaceDocuments } from "./explorer/useWorkspaceDocuments";
import { isProtected, downloadDraft } from "./explorer/workspaceDocuments";
import { getLocale, en, type TranslationKey } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import { externalLinkProps } from '../externalLinkProps';
import { WorkspaceFileLink } from '../WorkspaceFileLink';
import { WorkspaceImagePreview, ZoomableImage as GraphWorkspaceZoomableImage } from '../ZoomableImage';
import {
  createContext,
  useContext,
  lazy,
  memo,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Download,
  Pencil,
  PanelLeftOpen,
  MoreHorizontal,
  PanelRightClose,
  Save,
  X,
} from 'lucide-react';
import { useFilePanel } from '../workbench/FilePanelContext';
import { WorkspaceFileActions } from './WorkspaceFileMenu';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import { localFileHref, relativeWorkspacePath, normalizeFileSystemPath } from '../workspacePaths';
import remarkGfm from 'remark-gfm';
import { markdownHtmlPlugins } from '../markdownHtml';
import { MarkdownImageLinkContext } from '../ZoomableImage';
import type { HighlighterCore } from 'shiki/core';

import type { ThreadWorkspaceFilePreview } from '../../adapters';
import type { PluginContextValue } from '../../plugins/plugin-context';
import { getGraphChatHighlighter } from '../graph-chat/graphChatShiki';
import {
  MOLECULAR_EXTENSIONS,
  buildMoleculePreviewSnapshot,
  extensionOf,
  languageForPath,
  type WorkspaceTreeNode,
} from './workspaceTree';
import { WorkspaceInfoCard } from './GraphWorkspaceCards';
import { GraphMoleculeViewer } from './GraphMoleculeViewer';
import { GraphDrawioPreview } from './GraphDrawioPreview';
import { isDrawioPath } from './explorer/filePreviewPolicy';
import {
  WorkspaceFileTabs,
  type WorkspaceFileTab,
} from './WorkspaceFileTabs';

const GraphWorkspaceMonacoEditor = lazy(
  () => import('./GraphWorkspaceMonacoEditor'),
);

export type GraphWorkspacePreviewTarget =
  | { kind: 'live-molecule'; node: WorkspaceTreeNode }
  | { kind: 'workspace-file'; node: WorkspaceTreeNode }
  | { kind: 'artifact'; node: WorkspaceTreeNode }
  | { kind: 'event'; node: WorkspaceTreeNode }
  | { kind: 'meta'; node: WorkspaceTreeNode }
  | null;

function DownloadFilePreview({ node, onDownload, readOnlyReason }: {
  readOnlyReason?: string;
  node: WorkspaceTreeNode;
  onDownload?: () => Promise<void> | void;
}) {
  const { locale: i18nLocale } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = node.size;
  const sizeLabel = size === undefined ? null : size < 1024 ? `${size} B`
    : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="thread-graph-download-preview">
      <Download aria-hidden="true" className="thread-graph-download-preview-icon" />
      <strong>{node.name}</strong>
      {sizeLabel ? <span>{sizeLabel}</span> : null}
      <p>{translate("files.thisFileIsAvailableToDownload")}</p>
      {readOnlyReason ? <p>{translateReadOnly(readOnlyReason)}</p> : null}
      {onDownload ? (
        <button type="button" disabled={pending} aria-label={translate("files.download", { value1: node.name })}
          onClick={async () => {
            setPending(true);
            setError(null);
            try { await onDownload(); }
            catch (caught) { setError(caught instanceof Error ? caught.message : translate("files.downloadFailedPleaseTryAgain")); }
            finally { setPending(false); }
          }}>
          <Download aria-hidden="true" size={16} />
          {pending ? translate("files.downloading") : translate("files.downloadFile")}
        </button>
      ) : <span>{translate("files.downloadsAreUnavailableForThisConnection")}</span>}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

function translateReadOnly(reason: string) {
  const key = `files.safeReason.${reason}`;
  return Object.hasOwn(en,key) ? translate(key as TranslationKey) : reason;
}
const WorkspaceDocumentDiff = lazy(() => import('./GraphWorkspaceMonacoDiff'));
const SMALL_TEXT_FILE_MAX_BYTES = 50 * 1024;
const SMALL_TEXT_FILE_MAX_LINES = 1000;
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  cs: 'csharp',
  jsonl: 'json',
  md: 'markdown',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  yml: 'yaml',
};

function transparentHighlightBackground(html: string) {
  return html
    .replace(/background-color:[^;"]+;?/g, 'background-color: transparent;')
    .replace(/background:[^;"]+;?/g, 'background: transparent;');
}

export function resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath = '' }: {
  markdownPath: string; resourceUrl: string; workspaceRootPath?: string;
}) {
  const raw = localFileHref(resourceUrl, typeof window === 'undefined' ? undefined : window.location.origin);
  if (!raw) return null;
  const path = raw.split('#')[0] ?? '';
  if (path.startsWith('/') || /^[a-z]:\//i.test(path)) {
    return workspaceRootPath ? relativeWorkspacePath(path, workspaceRootPath) : path.replace(/^\/+/, '');
  }
  const base = workspaceRootPath ? relativeWorkspacePath(markdownPath, workspaceRootPath) : normalizeFileSystemPath(markdownPath);
  if (base === null) return null;
  const directory = base.slice(0, Math.max(0, base.lastIndexOf('/')));
  return relativeWorkspacePath(directory ? `${directory}/${path}` : path, workspaceRootPath);
}

function isSmallEditableTextFile(file: ThreadWorkspaceFilePreview) {
  return (
    !file.truncated &&
    file.size <= SMALL_TEXT_FILE_MAX_BYTES &&
    file.content.split('\n').length <= SMALL_TEXT_FILE_MAX_LINES
  );
}

function previewTargetTitle(target: GraphWorkspacePreviewTarget) {
  if (!target) {
    return null;
  }
  return target.node.path || target.node.name || null;
}

export function graphWorkspacePreviewTargetFromNode(
  node: WorkspaceTreeNode | null,
): GraphWorkspacePreviewTarget {
  if (!node) {
    return null;
  }

  switch (node.kind) {
    case 'live-artifact':
      return { kind: 'live-molecule', node };
    case 'file':
      return { kind: 'workspace-file', node };
    case 'artifact':
      return { kind: 'artifact', node };
    case 'event':
      return { kind: 'event', node };
    case 'meta':
      return { kind: 'meta', node };
    case 'directory':
      return null;
  }
}

const GraphWorkspaceCodePreview = memo(function GraphWorkspaceCodePreview({
  content,
  focusLine,
  language = 'text',
}: {
  content: string;
  focusLine?: number | null;
  language?: string;
}) {
  const { locale: i18nLocale } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let alive = true;
    getGraphChatHighlighter()
      .then((loadedHighlighter) => {
        if (alive) {
          setHighlighter(loadedHighlighter);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const shell = rootRef.current?.closest<HTMLElement>('.thread-ui-shell');
    const readDark = () =>
      shell
        ? shell.getAttribute('data-theme-effective') === 'dark' ||
          shell.classList.contains('dark') ||
          shell.classList.contains('thread-ui-theme-dark')
        : document.documentElement.classList.contains('dark');

    setDark(readDark());
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(() => setDark(readDark()));
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ['class', 'data-theme-effective'],
    });
    return () => observer.disconnect();
  }, []);

  const highlightedHtml = useMemo(() => {
    if (!highlighter) {
      return '';
    }
    const loadedLanguages = highlighter.getLoadedLanguages?.() ?? [];
    const normalizedLanguage = CODE_LANGUAGE_ALIASES[language] ?? language;
    const resolvedLanguage = loadedLanguages.includes(normalizedLanguage)
      ? normalizedLanguage
      : 'text';
    try {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: resolvedLanguage,
          theme: dark ? 'ayu-dark' : 'github-light-default',
        }),
      );
    } catch {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: 'text',
          theme: dark ? 'ayu-dark' : 'github-light-default',
        }),
      );
    }
  }, [content, dark, highlighter, language]);

  useEffect(() => {
    const root = rootRef.current;
    root
      ?.querySelectorAll('.is-focused-line')
      .forEach((element) => element.classList.remove('is-focused-line'));
    if (!root || !focusLine || focusLine < 1) {
      return;
    }
    const target =
      root.querySelector<HTMLElement>(`[data-line="${focusLine}"]`) ??
      root.querySelector<HTMLElement>(`.line:nth-child(${focusLine})`);
    target?.classList.add('is-focused-line');
    target?.scrollIntoView?.({ block: 'center' });
  }, [focusLine, highlightedHtml]);

  const lines = content.split('\n');
  return (
    <div
      ref={rootRef}
      className="thread-graph-code-preview min-h-0 flex-1 overflow-auto"
      role="region"
      aria-label={translate("files.sourceCode")}
    >
      {highlightedHtml ? (
        <div
          className="thread-graph-highlighted-code-preview"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="thread-graph-plain-code-preview">
          <code>
            {lines.map((line, index) => (
              <span
                className={`thread-graph-code-line ${
                  focusLine === index + 1 ? 'is-focused-line' : ''
                }`}
                data-line={index + 1}
                key={index}
              >
                <span
                  className="thread-graph-code-line-number"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>{line || ' '}</span>
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
});

type MarkdownResourceContextValue = {
  markdownPath: string;
  workspaceRootPath?: string;
  onOpenWorkspaceFile?: (path: string) => void;
  resolveWorkspaceFileUrl?: (path: string) => string | null;
};
const MarkdownResourceContext = createContext<MarkdownResourceContextValue>({ markdownPath: '' });

// Stable component types keep image state alive when Explorer updates its callbacks.
// Defining these inside the preview remounted every image (and closed its lightbox).
const workspaceMarkdownComponents: Components = {
  a({ href, children: originalChildren, node: _node, ...props }) {
    const { markdownPath, workspaceRootPath, onOpenWorkspaceFile } = useContext(MarkdownResourceContext);
    const children = <MarkdownImageLinkContext.Provider value={true}>{originalChildren}</MarkdownImageLinkContext.Provider>;
    const workspacePath = href ? resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl: href, workspaceRootPath: workspaceRootPath ?? '' }) : null;
    if (workspacePath && onOpenWorkspaceFile) {
      return <WorkspaceFileLink path={workspacePath} onOpen={({ path }) => onOpenWorkspaceFile(path)}>{children}</WorkspaceFileLink>;
    }
    return <a {...props} {...externalLinkProps(href)} href={href}>{children}</a>;
  },
  img({ src, alt, ...props }) {
    const { markdownPath, workspaceRootPath, resolveWorkspaceFileUrl } = useContext(MarkdownResourceContext);
    const workspacePath = src ? resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl: src, workspaceRootPath: workspaceRootPath ?? '' }) : null;
    const resolvedSrc = workspacePath ? (resolveWorkspaceFileUrl?.(workspacePath) ?? src) : src;
    return resolvedSrc ? <GraphWorkspaceZoomableImage src={resolvedSrc} alt={alt ?? ''} loading="lazy"
      className={props.className} width={props.width} height={props.height} /> : null;
  },
};

const GraphWorkspaceMarkdownPreview = memo(
  function GraphWorkspaceMarkdownPreview({
    content,
    markdownPath,
    readingPositions,
    onOpenWorkspaceFile,
    resolveWorkspaceFileUrl,
    workspaceRootPath,
  }: {
    content: string;
    markdownPath: string;
    readingPositions?: Map<string, number>;
    onOpenWorkspaceFile?: (path: string) => void;
    resolveWorkspaceFileUrl?: (path: string) => string | null;
    workspaceRootPath?: string;
  }) {
  const { locale: i18nLocale } = useI18n();
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const lastScrollTop = useRef(0);
    useLayoutEffect(() => {
      const element = scrollRef.current;
      if (!element) return;
      const target = readingPositions?.get(markdownPath) ?? 0;
      lastScrollTop.current = target;
      let restoring = true;
      const restore = () => { if (restoring) element.scrollTop = target; };
      restore();
      // Images and fonts can change document height after the first layout.
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(restore);
      if (element.firstElementChild) observer?.observe(element.firstElementChild);
      const stop = () => { restoring = false; observer?.disconnect(); };
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.addEventListener(type, stop, { passive: true });
      element.addEventListener('load', restore, true);
      return () => {
        readingPositions?.set(markdownPath, lastScrollTop.current);
        observer?.disconnect();
        for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.removeEventListener(type, stop);
        element.removeEventListener('load', restore, true);
      };
    }, [markdownPath, readingPositions]);
    return (
      <div ref={scrollRef} onScroll={event => { lastScrollTop.current = event.currentTarget.scrollTop; readingPositions?.set(markdownPath, lastScrollTop.current); }} className="thread-graph-markdown thread-graph-markdown-preview min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-7 sm:py-6">
        <div className="thread-graph-markdown-document">
        <MarkdownResourceContext.Provider value={{ markdownPath, workspaceRootPath, onOpenWorkspaceFile, resolveWorkspaceFileUrl }}>
        <ReactMarkdown
          urlTransform={url => localFileHref(url, typeof window === 'undefined' ? undefined : window.location.origin) ? url : defaultUrlTransform(url)}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[...markdownHtmlPlugins]}
          components={workspaceMarkdownComponents}
        >
          {content}
        </ReactMarkdown>
        </MarkdownResourceContext.Provider>
        </div>
      </div>
    );
  },
);

export function GraphWorkspacePreviewPane({
  activeFilePath,
  dirtyFilePaths = new Set(),
  error,
  fileTabs = [],
  focusLine,
  downloadOnly,
  onDownloadFile,
  imageUrl,
  loadingMore,
  documents,
  resourceScopeKey,
  canSaveDocument,
  onSaveAndClose,
  onReturnToFiles,
  onCloseFileTab,
  onDirtyChange,
  mobileNavigation = false,
  readingPositions,
  onNavigateBack,
  previousFilePath,
  onNavigateForward,
  onExpandExplorer,
  onOpenWorkspaceFile,
  onLoadMore,
  onSelectFileTab,
  onCollapse,
  pdfUrl,
  previewFile,
  previewLoading,
  plugins,
  resolveWorkspaceFileUrl,
  selectedTarget,
  workspaceRootPath,
}: {
  activeFilePath?: string | null;
  dirtyFilePaths?: ReadonlySet<string>;
  error?: string | null;
  fileTabs?: WorkspaceFileTab[];
  focusLine?: number | null;
  downloadOnly?: boolean;
  onDownloadFile?: () => Promise<void> | void;
  imageUrl?: string | null;
  loadingMore?: boolean;
  documents?: WorkspaceDocuments;
  resourceScopeKey?: string;
  canSaveDocument?: boolean;
  onSaveAndClose?: (path: string) => Promise<void>;
  onReturnToFiles?: () => void;
  onCloseFileTab?: (path: string) => void;
  onDirtyChange?: (path: string, dirty: boolean) => void;
  mobileNavigation?: boolean;
  readingPositions?: Map<string, number>;
  onNavigateBack?: () => void;
  previousFilePath?: string;
  onNavigateForward?: () => void;
  onExpandExplorer?: () => void;
  onOpenWorkspaceFile?: (path: string) => void;
  onLoadMore?: () => void;
  onSelectFileTab?: (path: string) => void;
  onCollapse?: () => void;
  pdfUrl?: string | null;
  previewFile?: ThreadWorkspaceFilePreview | null;
  previewLoading?: boolean;
  plugins: PluginContextValue;
  resolveWorkspaceFileUrl?: (path: string) => string | null;
  selectedTarget: GraphWorkspacePreviewTarget;
  workspaceRootPath?: string;
}) {
  const { locale: i18nLocale } = useI18n();
  const filePanel = useFilePanel();
  const surfaceRef = useRef<HTMLElement | null>(null);
  const document = previewFile ? documents?.documents.get(previewFile.path) : undefined;
  const editing = document?.editing ?? false;
  const draftContent = document?.content ?? previewFile?.content ?? '';
  const saving = document?.phase === 'saving';
  const saveError = document?.error;
  const setDraftContent = (content: string) => { if (previewFile) documents?.change(previewFile.path,content); };
  const setEditing = (value: boolean) => { if (previewFile) documents?.setEditing(previewFile.path,value); };
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showConflict, setShowConflict] = useState(true);
  const [diffMode, setDiffMode] = useState<'draftDisk'|'baseDraft'|'baseDisk'>('draftDisk');
  const [markdownView, setMarkdownView] = useState<'preview' | 'source'>(
    'preview',
  );
  const [compactViewer, setCompactViewer] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(max-width: 639px)').matches,
  );
  const [dark, setDark] = useState(false);
  const activeNode = selectedTarget?.node ?? null;
  const renderedArtifact = activeNode?.artifact
    ? plugins.renderArtifact({
        artifact: activeNode.artifact,
        expanded: true,
        onToggleExpanded: () => undefined,
      })
    : null;
  const moleculeSnapshot = buildMoleculePreviewSnapshot(previewFile ?? null);
  const fileLanguage =
    previewFile?.language || languageForPath(previewFile?.path ?? '');
  const extension = previewFile ? extensionOf(previewFile.path) : '';
  const isMarkdownFile = MARKDOWN_EXTENSIONS.has(extension);
  const isDrawioFile = isDrawioPath(previewFile?.path ?? '');
  const renderedViewLabel = isDrawioFile ? translate("files.diagram") : 'Markdown';
  const title = previewTargetTitle(selectedTarget);
  const canEditFile =
    Boolean(previewFile && canSaveDocument && document && !document.snapshot.readOnlyReason && document.snapshot.contentHash) &&
    !(previewFile && MOLECULAR_EXTENSIONS.has(extension)) &&
    isSmallEditableTextFile(previewFile!);
  const isLiveArtifactPreview = selectedTarget?.kind === 'live-molecule';
  const isArtifactPreview = Boolean(activeNode?.artifact && renderedArtifact);
  const isMoleculePreview = Boolean(moleculeSnapshot) || isArtifactPreview;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setCompactViewer(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const shell = surfaceRef.current?.closest<HTMLElement>('.thread-ui-shell');
    const update = () =>
      setDark(
        shell?.getAttribute('data-theme-effective') === 'dark' ||
          shell?.classList.contains('dark') ||
          shell?.classList.contains('thread-ui-theme-dark') ||
          false,
      );
    update();
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(update);
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ['class', 'data-theme-effective'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMarkdownView('preview'); setShowConflict(true); setDiffMode('draftDisk'); setActionsOpen(false);
  }, [activeNode?.path]);
  useEffect(() => {
    if (!actionsOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (event.target instanceof HTMLElement && event.target.closest('.monaco-editor'))) return;
      event.preventDefault(); event.stopPropagation(); setActionsOpen(false); actionTrigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [actionsOpen]);
  async function handleSaveFile() {
    if (previewFile) await documents?.save(previewFile.path);
  }

  const fileToolbar =
    previewFile && (isMarkdownFile || isDrawioFile || canEditFile) ? (
      <div className="flex shrink-0 items-center gap-1">
        {(isMarkdownFile || isDrawioFile) && !editing ? (
          <button type="button" className="thread-graph-editor-toolbar-button workspace-mobile-view-toggle" aria-label={translate(markdownView==='preview' ? 'files.source' : 'files.preview', { value1: renderedViewLabel })} title={translate(markdownView==='preview' ? 'files.source' : 'files.preview', { value1: renderedViewLabel })} onClick={() => setMarkdownView(view => view==='preview'?'source':'preview')}>
            {markdownView==='preview' ? <Code2 size={16}/> : <BookOpen size={16}/>}
          </button>
        ) : null}
        {canEditFile ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (document && isProtected(document) && !window.confirm(translate('files.safeDiscard'))) return;
                    setDraftContent(document?.baseContent ?? previewFile.content);
                    setEditing(false);
                  }}
                  disabled={saving || document?.phase === 'unknown'}
                  className="thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40"
                  title={translate("files.cancelEdits")}
                  aria-label={translate("files.cancelEdits")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveFile()}
                  disabled={saving || document?.phase === 'unknown' || draftContent === document?.baseContent}
                  className="thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40"
                  title={translate("files.saveFile")}
                  aria-label={translate("files.saveFile")}
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMarkdownView('source');
                  setEditing(true);
                }}
                className="thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition"
                title={translate("files.editFile")}
                aria-label={translate("files.editFile")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : null}
      </div>
    ) : null;
  const documentState = document ? translate(document.snapshot.readOnlyReason ? 'files.safeReadOnly' : document.needsVerification && document.phase==='clean' ? 'files.safeAdoptedSnapshot' : `files.safePhase.${document.phase}`, { reason: document.snapshot.readOnlyReason ? translateReadOnly(document.snapshot.readOnlyReason) : '' }) : null;
  const documentMetadata = document ? `${documentState} · ${document.snapshot.encoding==='utf-8' ? 'UTF-8' : translate('files.safeUnknownEncoding')}${document.snapshot.bom ? ' BOM' : ''} · ${document.snapshot.eol.toUpperCase()}` : undefined;
  const inlineStatus = document && <span role="status" data-testid="workspace-document-status" className="sr-only" data-phase={document.phase}>{documentState}</span>;
  const backLabel = previousFilePath ? translate('files.backToDocument', { name: previousFilePath.split('/').pop() ?? previousFilePath }) : translate('workbench.goBack');
  const navigationControls = <>
    {onNavigateForward && <button type="button" onClick={onNavigateForward} aria-label={translate('files.goForward')} title={translate('files.goForward')} className="thread-graph-editor-toolbar-button flex h-6 w-6 shrink-0 items-center justify-center rounded"><ArrowRight size={14} /></button>}
  </>;
  const copyPath = activeNode?.path && !/^(?:\/|[a-z]:[\\/])/i.test(activeNode.path) && workspaceRootPath ? `${workspaceRootPath.replace(/[\\/]+$/, '')}/${activeNode.path}` : activeNode?.path ?? '';
  const fileActions = activeNode && <WorkspaceFileActions path={copyPath} key={activeNode.path} {...((documentMetadata || filePanel?.label) ? { metadata:[filePanel?.label, documentMetadata].filter(Boolean).join(' · ') } : {})}
    {...(document ? {onDownload:()=>{ if (!isProtected(document) && onDownloadFile) void onDownloadFile(); else downloadDraft(document); }, onRefresh: async () => {
      const previous = document.snapshot.contentHash;
      await documents?.checkDisk(document.snapshot.path);
      const current = documents?.documents.get(document.snapshot.path);
      if (current?.error) throw new Error(current.error);
      return translate(current?.phase==='conflict' ? 'files.safePhase.conflict' : current?.snapshot.contentHash===previous ? 'files.fileAlreadyCurrent' : 'files.fileReloaded');
    }} : onDownloadFile ? {onDownload:()=>void onDownloadFile()} : {})}>{fileToolbar}{inlineStatus}{navigationControls}</WorkspaceFileActions>;
  const viewerPaneToggle = onExpandExplorer ? (
    <button
      type="button"
      onClick={onExpandExplorer}
      data-testid="expand-explorer"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]"
      title={translate("files.showExplorer")}
      aria-label={translate("files.showExplorer")}
    >
      <PanelLeftOpen className="h-3.5 w-3.5" />
    </button>
  ) : onCollapse ? (
    <button
      type="button"
      onClick={onCollapse}
      data-testid="collapse-viewer"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]"
      title={translate("files.hideEditor")}
      aria-label={translate("files.hideEditor")}
    >
      <PanelRightClose className="h-3.5 w-3.5" />
    </button>
  ) : null;

  const previewNavigation = (onNavigateBack || onReturnToFiles || onExpandExplorer) && <button type="button" className="workspace-preview-back" onClick={onNavigateBack ?? onReturnToFiles ?? onExpandExplorer} aria-label={onNavigateBack ? backLabel : translate('files.backToFiles')} title={onNavigateBack ? backLabel : translate('files.backToFiles')} data-testid="expand-explorer"><ArrowLeft size={18}/></button>;
  const previewActions = <button ref={actionTrigger} type="button" className="thread-graph-editor-toolbar-button workspace-file-more" aria-label={translate('files.fileActions')} title={translate('files.fileActions')} aria-expanded={actionsOpen} onClick={() => setActionsOpen(open => !open)}><MoreHorizontal size={18}/></button>;

  return (
    <section
      ref={surfaceRef}
      className="thread-graph-viewer flex h-full min-h-0 flex-col overflow-hidden rounded-md"
      data-preview-target-kind={selectedTarget?.kind ?? 'none'}
    >
      {!mobileNavigation && selectedTarget?.kind !== 'workspace-file' ? (
        <div className="thread-graph-viewer-header flex h-9 shrink-0 items-center justify-between gap-2 border-b px-2.5">
          <span className="min-w-0 truncate text-xs font-medium text-[var(--theme-fg)]">
            {title ?? translate("files.preview_f1fbb2")}
          </span>
          {viewerPaneToggle}
        </div>
      ) : null}
      {fileTabs.length === 0 && <div className="workspace-file-toolbar flex min-h-9 shrink-0 items-center justify-between border-b px-1">
        <div className="workspace-file-navigation flex items-center">{previewNavigation}</div><span className="min-w-0 flex-1 truncate text-xs" title={filePanel?.label}>{title}</span><div className="flex shrink-0 items-center">{previewActions}</div>
      </div>}
      {fileTabs.length > 0 && onCloseFileTab && onSelectFileTab ? (
        <WorkspaceFileTabs
          activePath={activeFilePath ?? null}
          dirtyPaths={dirtyFilePaths}
          onClose={onCloseFileTab}
          onSelect={onSelectFileTab}
          tabs={fileTabs}
          {...(onSaveAndClose ? { onSaveAndClose } : {})}
          blockedClosePaths={new Set([...documents?.documents ?? []].filter(([,doc]) => ['saving','unknown'].includes(doc.phase)).map(([path]) => path))}
          leadingAction={previewNavigation}
          trailingAction={previewActions}
        />
      ) : null}
      {actionsOpen && fileActions}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        {!selectedTarget ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500">
            {translate("files.pickALiveMoleculeWorkspaceFileArtifact")}</div>
        ) : selectedTarget.kind === 'workspace-file' && previewLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500">
            {translate("files.loadingFilePreview")}</div>
        ) : selectedTarget.kind === 'workspace-file' && downloadOnly ? (
          <DownloadFilePreview key={selectedTarget.node.path} node={selectedTarget.node} onDownload={onDownloadFile} {...(activeFilePath && documents?.documents.get(activeFilePath)?.snapshot.readOnlyReason ? {readOnlyReason:documents.documents.get(activeFilePath)!.snapshot.readOnlyReason!}: {})} />
        ) : selectedTarget.kind === 'workspace-file' && moleculeSnapshot ? (
          <div className="thread-graph-molecule-preview min-h-0 flex-1 overflow-hidden">
            <GraphMoleculeViewer
              source={moleculeSnapshot}
              moleculeId={moleculeSnapshot.uuid ?? selectedTarget.node.path}
              title={translate("files.pyMOLStylePDBCIF")}
            />
          </div>
        ) : selectedTarget.kind === 'workspace-file' && imageUrl ? (
          <WorkspaceImagePreview key={imageUrl} src={imageUrl} alt={selectedTarget.node.path || selectedTarget.node.name} />
        ) : selectedTarget.kind === 'workspace-file' && pdfUrl ? (
          <div className="thread-graph-file-preview-frame min-h-0 flex-1 overflow-hidden">
            <iframe
              src={pdfUrl}
              title={translate("files.pDFPreview", { value1: selectedTarget.node.path || selectedTarget.node.name })}
              className="h-full w-full border-0"
            />
          </div>
        ) : selectedTarget.kind === 'workspace-file' && previewFile ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {document && (document.snapshot.readOnlyReason || ['conflict','unknown','error'].includes(document.phase)) ? (
              <div className="workspace-document-status" role="status">
                <span>{document.snapshot.readOnlyReason ? translate('files.safeReadOnly', {reason: translateReadOnly(document.snapshot.readOnlyReason)}) : translate(document.needsVerification && document.phase==='clean' ? 'files.safeAdoptedSnapshot':`files.safePhase.${document.phase}`)} · {document.snapshot.encoding==='utf-8' ? 'UTF-8':translate('files.safeUnknownEncoding')}{document.snapshot.bom ? ' BOM' : ''} · {document.snapshot.eol.toUpperCase()} · r{document.revision}</span>
                <div className="workspace-document-actions">
                  {document.phase === 'unknown' ? <button type="button" onClick={() => void documents?.reconcile(document.snapshot.path)}>{translate('files.safeVerifySave')}</button> : null}
                  {document.phase === 'unknown' && document.conflict ? <button type="button" disabled={document.operationPending} onClick={() => {if(window.confirm(translate('files.safeManualRebase'))) documents?.acceptVerifiedDisk(document.snapshot.path);}}>{translate('files.safeUseCheckedBase')}</button> : null}
                  {document.phase === 'conflict' && !showConflict ? <button type="button" onClick={() => setShowConflict(true)}>{translate('files.safeViewConflict')}</button> : null}
                </div>
              </div>
            ) : !document && canSaveDocument ? <div className="workspace-document-status">{translate('files.safeUnavailable')}</div> : null}
            {document && (document.phase === 'conflict' || (document.phase === 'unknown' && document.conflict)) && showConflict ? (
              <div className="workspace-document-conflict" data-testid="workspace-document-conflict">
                <strong>{translate(document.phase==='unknown' ? 'files.safePhase.unknown':'files.safeConflictTitle')}</strong>
                <p>{translate(document.phase==='unknown' ? 'files.safeUnknown':'files.safeConflictBody')}</p>
                <div className="workspace-document-actions">
                  <button type="button" onClick={() => setShowConflict(false)}>{translate('files.safeKeepDraft')}</button>
                  <button type="button" disabled={document.phase==='unknown' || document.conflict?.content == null} onClick={() => {const revision=document.revision; if(window.confirm(translate('files.safeDiscard'))) documents?.adoptDisk(document.snapshot.path,revision);}}>{translate('files.safeAdoptDisk')}</button>
                  <button type="button" disabled={document.phase==='unknown' || !document.conflict?.contentHash || Boolean(document.conflict.readOnlyReason)} onClick={() => {if(window.confirm(translate('files.safeOverwriteConfirm'))) void documents?.save(document.snapshot.path,true);}}>{translate('files.safeOverwriteShown')}</button>
                  <button type="button" disabled={document.conflict?.content == null} onClick={() => downloadDraft(document,true)}>{translate('files.safeDownloadDisk')}</button>
                </div>
                {document.conflict?.content != null ? <>
                  <label>{translate('files.safeCompare')} <select value={diffMode} onChange={e => setDiffMode(e.target.value as typeof diffMode)}>
                    <option value="draftDisk">{translate('files.safeDraftDisk')}</option><option value="baseDraft">{translate('files.safeBaseDraft')}</option><option value="baseDisk">{translate('files.safeBaseDisk')}</option>
                  </select></label>
                  <div className="workspace-document-diff"><Suspense fallback={<span>{translate('files.loadingEditor')}</span>}><WorkspaceDocumentDiff
                    original={diffMode==='draftDisk' ? document.content : document.baseContent}
                    modified={diffMode==='baseDraft' ? document.content : document.conflict.content}
                    language={fileLanguage} dark={dark} compact={compactViewer} /></Suspense></div>
                  <p className="workspace-document-snapshot">{translate('files.safeFixedSnapshot')} · {document.conflict.contentHash?.slice(0,23)}</p>
                </> : <p>{translate('files.safeMissing')}</p>}
              </div>
            ) : null}
            {saveError ? (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200">
                {saveError}
              </div>
            ) : null}
            {editing && compactViewer ? (
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.currentTarget.value)}
                spellCheck={false}
                aria-label={translate("files.workspaceFileEditor")}
                className="thread-graph-file-editor min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-5 text-slate-900 outline-none dark:text-slate-100"
              />
            ) : isDrawioFile && markdownView === 'preview' && !editing ? (
              <GraphDrawioPreview content={previewFile.content} name={previewFile.name} truncated={previewFile.truncated} />
            ) : isMarkdownFile && markdownView === 'preview' && !editing ? (
              <GraphWorkspaceMarkdownPreview
                key={previewFile.path}
                content={previewFile.content}
                markdownPath={previewFile.path}
                {...(readingPositions ? { readingPositions } : {})}
                {...(onOpenWorkspaceFile ? { onOpenWorkspaceFile } : {})}
                {...(resolveWorkspaceFileUrl
                  ? { resolveWorkspaceFileUrl }
                  : {})}
                {...(workspaceRootPath ? { workspaceRootPath } : {})}
              />
            ) : compactViewer ? (
              <GraphWorkspaceCodePreview
                content={previewFile.content}
                focusLine={focusLine}
                language={fileLanguage}
              />
            ) : (
              <Suspense
                fallback={
                  <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--theme-fg-muted)]">
                    {translate("files.loadingEditor")}</div>
                }
              >
                <GraphWorkspaceMonacoEditor
                  key={document?.key ?? `${resourceScopeKey}:${previewFile.path}`}
                  resourceKey={document?.key ?? `${resourceScopeKey}:${previewFile.path}`}
                  retainModel={Boolean(document)}
                  content={editing ? draftContent : previewFile.content}
                  dark={dark}
                  focusLine={focusLine}
                  language={fileLanguage}
                  onChange={setDraftContent}
                  onSave={() => void handleSaveFile()}
                  path={previewFile.path}
                  readOnly={!editing}
                />
              </Suspense>
            )}
            {previewFile.truncated && !onLoadMore ? <div className="workspace-document-status">{translate("files.safeFirstPreview")}</div> : null}
            {previewFile.truncated && onLoadMore ? (
              <div className="thread-graph-file-preview-footer flex justify-center border-t px-4 py-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  title={translate("files.loadMoreWorkspacePreview")}
                  aria-label={translate("files.loadMoreWorkspacePreview")}
                  className="thread-graph-load-more-button rounded-md px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  {loadingMore
                    ? translate("files.loading")
                    : translate("files.loadMoreBytesRemaining", { value1: (
                        previewFile.size - previewFile.nextOffset
                      ).toLocaleString(getLocale()) })}
                </button>
              </div>
            ) : null}
          </div>
        ) : (selectedTarget.kind === 'live-molecule' ||
            selectedTarget.kind === 'artifact') &&
          selectedTarget.node.artifact ? (
          <div
            className={
              isMoleculePreview || isLiveArtifactPreview
                ? 'min-h-0 flex-1 overflow-hidden'
                : 'min-h-0 flex-1 overflow-auto p-3'
            }
          >
            {renderedArtifact}
          </div>
        ) : selectedTarget.kind === 'meta' ? (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="grid gap-3">
              <WorkspaceInfoCard label={translate("files.workspaceData")}>
                <GraphWorkspaceCodePreview
                  content={selectedTarget.node.detail ?? ''}
                />
              </WorkspaceInfoCard>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="thread-graph-file-preview-header border-b px-4 py-3 text-xs uppercase tracking-[0.12em]">
              {selectedTarget.node.kind}
            </div>
            <GraphWorkspaceCodePreview
              content={
                selectedTarget.node.detail ??
                selectedTarget.node.preview ??
                selectedTarget.node.name
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
