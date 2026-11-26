import type { ComponentProps, ReactNode } from 'react';
import { translate, useI18n } from '../i18n';
import { SettingsPanels, type SettingsSection } from './SettingsPanels';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './graph-ui/Dialog';
import { useSheetViewport } from './useSheetViewport';

/** One settings shell for the workbench and pages outside conversations. */
export function SettingsDialog({ sections, themeMode, effectiveTheme, trigger, extraContent, title, description, initialId = 'preferences', section, onSectionChange, panelScroll, contentProps, ...rootProps }: ComponentProps<typeof Dialog> & {
  sections: SettingsSection[];
  /** The window's title; "Settings" unless the owner names what they act on ("Settings · mac"). */
  title?: string | undefined;
  /** The line under the title; what the window holds where the owner knows better. */
  description?: string | undefined;
  section?: string | undefined;
  onSectionChange?: ((id: string) => void) | undefined;
  panelScroll?: ComponentProps<typeof SettingsPanels>['scroll'];
  themeMode?: string;
  effectiveTheme?: 'light' | 'dark';
  trigger?: ReactNode;
  extraContent?: ReactNode;
  initialId?: string;
  contentProps?: Omit<ComponentProps<typeof DialogContent>, 'children' | 'className' | 'overlayClassName'> & { 'data-testid'?: string };
}) {
  useI18n();
  // On phones the window is a bottom sheet on the visible part of the page (UI §4).
  const sheet = useSheetViewport(rootProps.open !== false);
  return <Dialog {...rootProps}>
    {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
    <DialogContent {...contentProps} style={{ ...sheet, ...contentProps?.style }} data-theme-effective={effectiveTheme} data-theme-mode={themeMode}
      className="thread-graph-settings-dialog thread-graph-dialog matter-settings-dialog"
      overlayClassName="matter-settings-overlay">
      <DialogHeader>
        <DialogTitle>{title ?? translate('files.settings')}</DialogTitle>
        <DialogDescription>{description ?? translate('files.yourWorkspaceConnectedDeviceAndPersonalPreferences')}</DialogDescription>
      </DialogHeader>
      {extraContent}
      <SettingsPanels sections={sections} initialId={initialId} selected={section} onSelect={onSectionChange} scroll={panelScroll} />
    </DialogContent>
  </Dialog>;
}
