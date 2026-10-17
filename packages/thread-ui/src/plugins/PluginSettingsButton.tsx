import { Settings } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PluginDto } from '@pockymoe/shared';
import { useI18n } from '../i18n';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/graph-ui/Dialog';
import { usePlugins } from './usePlugins';

/**
 * Opens one plugin's settings above the host dialog. Renders nothing for plugins that
 * contribute no settings or are unavailable on this device; disabled plugins stay
 * configurable.
 */
export function PluginSettingsButton({ plugin, className }: { plugin: Pick<PluginDto, 'id' | 'name' | 'description'>; className?: string }) {
  const { t } = useI18n();
  const plugins = usePlugins();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<{ effective?: string; mode?: string }>({});
  const sections = plugins.getSettingsSections(plugin.id);
  // Settings can be saved while the plugin is off; say plainly that they wait for it.
  const off = plugins.plugins.find(item => item.id === plugin.id)?.enabled === false;
  if (!sections.length) return null;
  const label = t('settings.pluginSettings', { value1: plugin.name });
  const single = sections.length === 1 ? sections[0]! : null;
  return <Dialog open={open} onOpenChange={next => {
    if (next) {
      // The dialog is portaled; carry the host theme across like the Settings dialog does.
      const host = trigger.current?.closest<HTMLElement>('[data-theme-effective]');
      setTheme({ effective: host?.dataset.themeEffective, mode: host?.dataset.themeMode });
    }
    setOpen(next);
  }}>
    <DialogTrigger asChild>
      <button ref={trigger} type="button" className={className ?? 'plugin-settings-trigger'} aria-label={label} title={label}>
        <Settings data-icon="settings" size={15} aria-hidden="true" />
      </button>
    </DialogTrigger>
    {/* Fields may still be loading (disabled); start on the dialog itself rather than ringing the close button. */}
    <DialogContent ref={content} data-theme-effective={theme.effective} data-theme-mode={theme.mode} data-testid="pluginSettingsDialog"
      className="thread-graph-dialog matter-settings-dialog plugin-settings-dialog" overlayClassName="plugin-settings-overlay"
      onOpenAutoFocus={event => { event.preventDefault(); content.current?.focus(); }}>
      <DialogHeader className="plugin-settings-dialog-header">
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{single?.description ?? plugin.description}</DialogDescription>
      </DialogHeader>
      <div className="plugin-settings-dialog-body">
        {off && <p role="note" className="plugin-settings-off">{t('settings.pluginNotEnabled')}</p>}
        {single ? single.content : sections.map(section => <section key={section.id} className="plugin-settings-dialog-section" aria-labelledby={`${section.id}-heading`}>
          <header><h3 id={`${section.id}-heading`}>{section.label}</h3>{section.description && <p>{section.description}</p>}</header>
          {section.content}
        </section>)}
      </div>
    </DialogContent>
  </Dialog>;
}
