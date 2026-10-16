import type { ComponentProps, ReactNode } from 'react';
import { translate, useI18n } from '../i18n';
import { SettingsPanels, type SettingsSection } from './SettingsPanels';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './graph-ui/Dialog';

/** One settings shell for the workbench and pages outside conversations. */
export function SettingsDialog({ sections, themeMode, effectiveTheme, trigger, extraContent, initialId = 'preferences', section, onSectionChange, panelScroll, contentProps, ...rootProps }: ComponentProps<typeof Dialog> & {
  sections: SettingsSection[];
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
  return <Dialog {...rootProps}>
    {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
    <DialogContent {...contentProps} data-theme-effective={effectiveTheme} data-theme-mode={themeMode}
      className="thread-graph-settings-dialog thread-graph-dialog matter-settings-dialog"
      overlayClassName="matter-settings-overlay">
      <DialogHeader>
        <DialogTitle>{translate('files.settings')}</DialogTitle>
        <DialogDescription>{translate('files.yourWorkspaceConnectedDeviceAndPersonalPreferences')}</DialogDescription>
      </DialogHeader>
      {extraContent}
      <SettingsPanels sections={sections} initialId={initialId} selected={section} onSelect={onSectionChange} scroll={panelScroll} />
    </DialogContent>
  </Dialog>;
}
