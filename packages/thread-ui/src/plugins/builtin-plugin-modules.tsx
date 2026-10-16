import { translate } from '../i18n';
import { terminalPluginManifest } from '@pockymoe/plugin-terminal';
import { deepseekHarnessPlugin } from './deepseek-harness-plugin';
import { contentQualityPlugin } from './content-quality-plugin';
import type { FrontendPluginModule } from './plugin-types';
import { TerminalSettings } from '../components/shell/TerminalSettings';

export const builtinFrontendPlugins: FrontendPluginModule[] = [
  {
    manifest: terminalPluginManifest,
    threadPanels: [
      {
        id: 'terminal',
        kind: 'terminal',
        get label() { return translate("workbench.terminal"); },
      },
    ],
    browserSettingsSections: [{
      id: 'clipboard',
      get label() { return translate('workbench.terminal'); },
      get description() { return translate('files.terminalSettingsDescription'); },
      render: () => <TerminalSettings />,
    }],
  },
  deepseekHarnessPlugin,
  contentQualityPlugin,
];
