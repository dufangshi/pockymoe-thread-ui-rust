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
/** Wire formats a saved upstream connection can speak; not a model brand. */
type UpstreamConnectionProtocol = 'openai_chat' | 'openai_responses' | 'anthropic' | 'gemini';
interface UpstreamConnectionPickerValue {
    connectionId: string;
    model: string;
}
interface UpstreamConnectionPickerProps extends UpstreamConnectionPickerValue {
    /** Only connections speaking one of these protocols can be selected. */
    protocols?: UpstreamConnectionProtocol[];
    disabled?: boolean;
    onChange: (value: UpstreamConnectionPickerValue) => void;
}
/**
 * Optional host capability: the host renders its saved-connection selector, including
 * its own add/edit form. Selecting or saving a connection never applies it anywhere.
 */
interface UpstreamConnectionHost {
    renderPicker: (props: UpstreamConnectionPickerProps) => ReactNode;
}
interface PluginSettingsContext {
    pluginId: string;
    load: () => Promise<PluginSettingsSnapshot>;
    save: (settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
    connections?: UpstreamConnectionHost;
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
interface PluginActionOutputContext {
    action: string;
    output: unknown;
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
    /** Historical receipts remain readable after disabling the plugin. */
    renderActionOutput?: (context: PluginActionOutputContext) => ReactNode | null;
    defaultEnabled?: boolean;
    presentMessage?: (context: MessagePresentationContext) => MessagePresentation | null;
    /** Available even when disabled so the plugin can be configured before enabling. */
    settingsSections?: PluginSettingsContribution[];
    /** Preferences kept in this browser, shown in settings only while the plugin is enabled. */
    browserSettingsSections?: Array<{
        id: string;
        readonly label: string;
        readonly description?: string;
        render: () => ReactNode;
    }>;
    manifest: PluginManifestDto;
    threadPanels?: ThreadPanelContribution[];
    renderArtifact?: (context: ArtifactRenderContext) => ReactNode;
    inlineCodeRenderers?: Array<{
        languages: string[];
        render: (context: InlineCodeRenderContext) => ReactNode | null;
    }>;
}

export type { ArtifactRenderContext as A, FrontendPluginModule as F, InlineCodeRenderContext as I, MessagePresentation as M, PluginSettingsSnapshot as P, ThreadPanelContribution as T, UpstreamConnectionHost as U, PluginActionOutputContext as a, MessagePresentationContext as b, PluginSettingsContext as c, PluginSettingsContribution as d, UpstreamConnectionPickerProps as e, UpstreamConnectionPickerValue as f, UpstreamConnectionProtocol as g };
