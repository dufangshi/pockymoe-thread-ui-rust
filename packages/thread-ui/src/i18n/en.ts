import { automationEn } from './automation.en';
import { contentQualityEn } from './content-quality.en';
import { searchEn } from './search.en';
import { tourEn } from './tour.en';
import { authEn } from './auth.en';
import { chatEn } from './chat.en';
import { commonEn } from './common.en';
import { devicesEn } from './devices.en';
import { filesEn } from './files.en';
import { settingsEn } from './settings.en';
import { sharingEn } from './sharing.en';
import { workbenchEn } from './workbench.en';
export const en = {
  ...automationEn,
  ...contentQualityEn,
  ...authEn,
  ...chatEn,
  ...commonEn,
  ...devicesEn,
  ...filesEn,
  ...settingsEn,
  ...sharingEn,
  ...workbenchEn,
  ...searchEn,
  ...tourEn,
} as const;
