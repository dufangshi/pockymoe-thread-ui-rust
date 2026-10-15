import './styles/base.css';
import './styles/timeline-shell.css';
import './styles/layout-workspace.css';
import './styles/history-markdown.css';
import './styles/composer-plan.css';
import './styles/export-dialog.css';
import './styles/matter-workbench.css';
import './styles/composer-compact.css';
import './styles/composer-reasoning.css';
import './styles/mermaid-diagrams.css';
import './styles/terminal-panel.css';

export type {
  ShellSocketConnection,
  ShellSocketHandlers,
  ThreadDetailUiAdapter,
  ThreadImageAssetVariant,
  ThreadShellAdapter,
  ThreadTimelineAdapter,
  ThreadWorkspaceAdapter,
} from './adapters';
export type {
  PromptAttachmentUpload,
  SendPromptInput,
  ThreadShellControlState,
} from './types';

export {
  ThreadComposer,
  type ThreadComposerProps,
  type ComposerSendShortcut,
} from './components/ThreadComposer';
export { TokenUsageCost, type TokenUsageCostProps } from './components/timeline/TokenUsageCost';
export {
  ThreadCards,
  ThreadWorkspaceLayout,
} from './components/ThreadWorkspaceLayout';
export {
  ThreadTimeline,
  type ThreadTimelineProps,
} from './components/ThreadTimeline';
export {
  ThreadShellPanel,
  type ThreadShellPanelHandle,
} from './components/ThreadShellPanel';
export {
  MemoizedThreadGraphWorkspacePanel,
  ThreadGraphWorkspacePanel,
  type ThreadGraphWorkspaceFeatures,
  type ThreadGraphWorkspacePanelProps,
  type WorkspaceTab,
} from './components/ThreadGraphWorkspacePanelLazy';
export { ConfirmDialog } from './components/ConfirmDialog';
export { isStaleBuildError, RenderErrorBoundary, RenderErrorFallback } from './components/RenderErrorBoundary';
export {
  ExportTranscriptDialog,
  ThreadActionsDialog,
  type CreateThreadShareInput,
  type ThreadActionsDialogProps,
  type ThreadShareSummary,
} from './components/ExportTranscriptDialog';
export { LongTextDialog } from './components/LongTextDialog';
export {
  formatLongTimestamp,
  formatShortTimestamp,
  historyItemAccentClassName,
  historyItemLabel,
  threadStatusClassName,
  threadStatusLabel,
  turnStatusLabel,
} from './components/threadPresentation';
export { hasLikelyMarkdownSyntax } from './components/markdownHeuristics';
export {
  ThreadDetailSurface,
  type ThreadDetailSurfaceProps,
} from './ThreadDetailSurface';

export {
  createDefaultPluginContextValue,
  PluginContext,
  mergePluginState,
  type PluginContextValue,
} from './plugins/plugin-context';
export { PluginProvider } from './plugins/PluginProvider';
export { usePlugins } from './plugins/usePlugins';
export type {
  ArtifactRenderContext,
  FrontendPluginModule,
  InlineCodeRenderContext,
  ThreadPanelContribution,
} from './plugins/plugin-types';
export {
  AppShellNavContext,
  useAppShellNav,
  type AgentBackendId,
  type AppShellNavContextValue,
  type ThemeMode,
} from './app-shell/AppShellNavContext';
export {
  AppShellMenuButton,
  AppShellNavigationMenu,
  AppShellSettingsDialog,
  type AppShellNavigationItem,
  type AppShellNavigationMenuProps,
  type AppShellSettingsDialogProps,
} from './app-shell/AppShellNavigation';
export type { MatterWorkbenchOptions, WorkbenchThread, WorkbenchNotification, WorkbenchToolPanel } from './components/MatterWorkbench';
export { MatterWorkbench } from './components/MatterWorkbench';
export { PublicTranscript, transcriptSnapshot, type PublicTranscriptSnapshot } from './components/PublicTranscript';

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/graph-ui/Dialog";
export { SettingsPanels, type SettingsSection } from './components/SettingsPanels';

export { I18nProvider, LanguageSwitcher, useI18n, initializeI18n, getLocale, setLocale, translate, t, formatDate, formatNumber, normalizeLocale, detectLocale, LOCALE_STORAGE_KEY, LOCALE_OPTIONS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';
export type { Locale, TranslationKey, TranslationValues } from './i18n';
export {
  ConversationSearchScopePicker,
  ConversationSearchExcerpt,
  type ConversationSearchScope,
} from './components/ConversationSearchControls';

export type { WorkspaceDocumentSnapshot, WorkspaceDocumentSaveInput, WorkspaceSaveReceipt } from "./adapters";
export { confirmWorkspaceDocumentLeave } from "./components/graph-workspace/explorer/workspaceDocuments";
export { useWorkbenchPresentation } from "./components/workbench/presentation";
export type { WorkbenchPresentation, ReferenceMode } from "./components/workbench/presentation";
export type { WorkbenchPanelsOptions } from "./components/workbench/WorkbenchPanels";
export type { WorkbenchToolPanelControls } from "./components/workbench/toolPanel";

export { SettingsDialog } from './components/SettingsDialog';

export { createWorkspacePathResolver } from './components/workspacePathLinks';

export { GraphChatThreadChatPanel } from './components/graph-chat/GraphChatThreadChatPanel';

export { THEME_FEATURES, isThemeFeature, useThemeFeature, documentThemeFeatures, type ThemeFeature } from './components/themeHooks';
export { THEME_AGENT_KEY_PATTERN, themeAgentKey, themeAgentName, threadThemeAgentKey } from './components/themeAgent';
export { ThreadLoadingIndicator } from './components/ThreadLoadingIndicator';
