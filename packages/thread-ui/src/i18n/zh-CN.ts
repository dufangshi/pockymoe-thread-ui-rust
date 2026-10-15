import { automationZhCN } from './automation.zh-CN';
import { contentQualityZhCN } from './content-quality.zh-CN';
import { searchZhCN } from './search.zh-CN';
import { tourZhCN } from './tour.zh-CN';
import type { en } from './en';
import { authZhCN } from './auth.zh-CN';
import { chatZhCN } from './chat.zh-CN';
import { commonZhCN } from './common.zh-CN';
import { devicesZhCN } from './devices.zh-CN';
import { filesZhCN } from './files.zh-CN';
import { settingsZhCN } from './settings.zh-CN';
import { sharingZhCN } from './sharing.zh-CN';
import { workbenchZhCN } from './workbench.zh-CN';
export const zhCN = {
  ...automationZhCN,
  ...contentQualityZhCN,
  ...authZhCN,
  ...chatZhCN,
  ...commonZhCN,
  ...devicesZhCN,
  ...filesZhCN,
  ...settingsZhCN,
  ...sharingZhCN,
  ...workbenchZhCN,
  ...searchZhCN,
  ...tourZhCN,
} satisfies Record<keyof typeof en, string | { readonly one: string; readonly other: string }>;
