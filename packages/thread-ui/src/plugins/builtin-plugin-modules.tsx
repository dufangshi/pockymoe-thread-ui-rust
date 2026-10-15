import { translate } from '../i18n';
import { terminalPluginManifest } from '@pockymoe/plugin-terminal';
import { deepseekHarnessPlugin } from './deepseek-harness-plugin';
import { contentQualityPlugin } from './content-quality-plugin';
import type { FrontendPluginModule } from './plugin-types';

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
  },
  deepseekHarnessPlugin,
  contentQualityPlugin,
];
