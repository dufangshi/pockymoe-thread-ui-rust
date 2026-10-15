import { ReactNode } from 'react';
import { ThreadHistoryItemDto, PluginManifestDto, ThreadArtifactDto } from '@pockymoe/shared';

interface ArtifactRenderContext {
    artifact: ThreadArtifactDto;
    expanded: boolean;
    onToggleExpanded: () => void;
}
interface InlineCodeRenderContext {
    code: string;
    isIncomplete: boolean;
    language: string;
    meta?: string;
}
interface ThreadPanelContribution {
    id: string;
    kind: string;
    label: string;
}
interface PluginSettingsSnapshot {
    revision: number;
    values: Record<string, unknown>;
}
interface PluginSettingsContext {
    pluginId: string;
    load: () => Promise<PluginSettingsSnapshot>;
    save: (settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
}
interface PluginSettingsContribution {
    id: string;
    label: string;
    description?: string;
    render: (context: PluginSettingsContext) => ReactNode;
}
interface MessagePresentationContext {
    item: ThreadHistoryItemDto;
    streaming: boolean;
}
/** An alternate body; the host keeps its existing markdown, expansion and copy controls. */
interface MessagePresentation {
    id: string;
    text: string;
    label: string;
    originalLabel: string;
    validate?: () => Promise<boolean>;
}
interface FrontendPluginModule {
    defaultEnabled?: boolean;
    presentMessage?: (context: MessagePresentationContext) => MessagePresentation | null;
    /** Available even when disabled so the plugin can be configured before enabling. */
    settingsSections?: PluginSettingsContribution[];
    manifest: PluginManifestDto;
    threadPanels?: ThreadPanelContribution[];
    renderArtifact?: (context: ArtifactRenderContext) => ReactNode;
    inlineCodeRenderers?: Array<{
        languages: string[];
        render: (context: InlineCodeRenderContext) => ReactNode | null;
    }>;
}

export type { ArtifactRenderContext as A, FrontendPluginModule as F, InlineCodeRenderContext as I, MessagePresentation as M, PluginSettingsSnapshot as P, ThreadPanelContribution as T, MessagePresentationContext as a, PluginSettingsContext as b, PluginSettingsContribution as c };
