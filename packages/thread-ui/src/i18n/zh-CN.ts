import { adminZhCN } from './admin.zh-CN';
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
  ...adminZhCN,
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

  "desktopShell.activity": "活动",
  "desktopShell.needsYou": "需要你",
  "desktopShell.running": "进行中",
  "desktopShell.justCompleted": "刚完成",
  "desktopShell.approval": "审批",
  "desktopShell.input": "输入",
  "desktopShell.map": "地图",
  "desktopShell.mapWaiting": "地图，{{count}} 个需要你",
  "desktopShell.mapShortcut": "地图 (⌘0)",
  "desktopShell.mapWindowTitle": "地图 · Pockymoe",
  "desktopShell.devices": "设备",
  "desktopShell.device": "设备",
  "desktopShell.deviceDetails": "设备详情",
  "desktopShell.checkUpdates": "检查更新",
  "desktopShell.rename": "重命名",
  "desktopShell.manageInBrowser": "在浏览器中管理",
  "desktopShell.memory": "内存",
  "desktopShell.settings": "设置",
  "desktopShell.newThread": "新线程",
  "desktopShell.dismissNotice": "关闭提示",
  "desktopShell.quickLookLabel": "{{title}} · 详情",
  "desktopShell.closeDetails": "关闭详情",
  "desktopShell.waitingApproval": "等待审批",
  "desktopShell.waitingInput": "等待输入",
  "desktopShell.processing": "处理中…",
  "desktopShell.approve": "批准",
  "desktopShell.deny": "拒绝",
  "desktopShell.openToAnswer": "打开线程回答",
  "desktopShell.latestPrompt": "最近的提问",
  "desktopShell.noActivitySummary": "暂无线程活动摘要",
  "desktopShell.model": "模型",
  "desktopShell.turns": "轮数",
  "desktopShell.totalRuntime": "总运行时间",
  "desktopShell.currentStatus": "当前状态",
  "desktopShell.last24Hours": "近 24 小时",
  "desktopShell.hourlyRuntime": "每小时运行时间",
  "desktopShell.hourRuntime": "{{hours}} 小时前：{{duration}}",
  "desktopShell.partialPrices": "部分轮次没有已知价格",
  "desktopShell.openThread": "打开线程",
  "desktopShell.openNewWindow": "在新窗口打开",
  "desktopShell.multiWindowUnavailable": "当前桌面外壳不支持多窗口。",
  "desktopShell.notificationPreferences": "系统通知 · 桌宠",
  "desktopShell.notificationPreferencesLabel": "系统通知与桌宠",
  "desktopShell.notificationsManaged": "提醒方式和桌宠显示由桌面应用管理。",
  "desktopShell.updateShellForPreferences": "请更新桌面外壳以打开通知偏好设置。",
  "desktopShell.signInRequired": "请先登录你的 Pockymoe 账号。",
  "desktopShell.requestResolved": "请求已处理。",
  "desktopShell.inputNeedsThread": "请打开线程，回答这个输入请求。",
  "desktopShell.optionsNeedThread": "请在线程中检查并回答这个请求。",
  "desktopShell.invalidPath": "无法打开这个应用路径。",
  "desktopShell.emptyReply": "回复不能为空。",
  "desktopShell.actionFailed": "操作没有完成，请重试。",
} satisfies Record<keyof typeof en, string | { readonly one: string; readonly other: string }>;
