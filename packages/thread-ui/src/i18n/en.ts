import { adminEn } from './admin.en';
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
  ...adminEn,
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

  "desktopShell.activity": "Activity",
  "desktopShell.needsYou": "Needs you",
  "desktopShell.running": "Running",
  "desktopShell.justCompleted": "Just completed",
  "desktopShell.approval": "Approval",
  "desktopShell.input": "Input",
  "desktopShell.map": "Map",
  "desktopShell.mapWaiting": "Map, {{count}} need you",
  "desktopShell.mapShortcut": "Map (⌘0)",
  "desktopShell.mapWindowTitle": "Map · Pockymoe",
  "desktopShell.devices": "Devices",
  "desktopShell.device": "Device",
  "desktopShell.deviceDetails": "Device details",
  "desktopShell.checkUpdates": "Check for updates",
  "desktopShell.rename": "Rename",
  "desktopShell.manageInBrowser": "Manage in browser",
  "desktopShell.memory": "Memory",
  "desktopShell.settings": "Settings",
  "desktopShell.newThread": "New thread",
  "desktopShell.dismissNotice": "Dismiss notice",
  "desktopShell.quickLookLabel": "{{title}} · Details",
  "desktopShell.closeDetails": "Close details",
  "desktopShell.waitingApproval": "Waiting for approval",
  "desktopShell.waitingInput": "Waiting for input",
  "desktopShell.processing": "Processing…",
  "desktopShell.approve": "Approve",
  "desktopShell.deny": "Deny",
  "desktopShell.openToAnswer": "Open thread to answer",
  "desktopShell.latestPrompt": "Latest prompt",
  "desktopShell.noActivitySummary": "No thread activity summary yet",
  "desktopShell.model": "Model",
  "desktopShell.turns": "Turns",
  "desktopShell.totalRuntime": "Total run time",
  "desktopShell.currentStatus": "Current status",
  "desktopShell.last24Hours": "Last 24 hours",
  "desktopShell.hourlyRuntime": "Run time by hour",
  "desktopShell.hourRuntime": "{{hours}} hours ago: {{duration}}",
  "desktopShell.partialPrices": "Some turns have no known price",
  "desktopShell.openThread": "Open thread",
  "desktopShell.openNewWindow": "Open in new window",
  "desktopShell.multiWindowUnavailable": "This desktop shell does not support multiple windows.",
  "desktopShell.notificationPreferences": "System notifications · Pet",
  "desktopShell.notificationPreferencesLabel": "System notifications and pet",
  "desktopShell.notificationsManaged": "Alerts and pet visibility are managed by the desktop app.",
  "desktopShell.updateShellForPreferences": "Update the desktop shell to open notification preferences.",
  "desktopShell.signInRequired": "Sign in to your Pockymoe account first.",
  "desktopShell.requestResolved": "This request has already been handled.",
  "desktopShell.inputNeedsThread": "Open the thread to answer this input request.",
  "desktopShell.optionsNeedThread": "Open the thread to review and answer this request.",
  "desktopShell.invalidPath": "This app path cannot be opened.",
  "desktopShell.emptyReply": "Reply cannot be empty.",
  "desktopShell.actionFailed": "The action could not be completed. Try again.",
} as const;
