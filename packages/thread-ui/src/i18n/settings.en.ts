export const settingsEn = {
  'settings.pluginSettings': '{{value1}} settings',
  'settings.pluginNotEnabled':
    'This plugin is off. Turn it on in the plugin list for these settings to take effect.',
  'settings.connTitle': 'Connections',
  'settings.connAdd': 'Add connection',
  'settings.connNew': 'New',
  'settings.connAddTitle': 'Add connection',
  'settings.connEditTitle': 'Edit connection',
  'settings.connEdit': 'Edit',
  'settings.connEditNamed': 'Edit {{name}}',
  'settings.connLoading': 'Loading connections…',
  'settings.connLoadFailed': 'Unable to load connections.',
  'settings.connUpdateSupervisor':
    'Update this Supervisor to manage shared connections.',
  'settings.connRetry': 'Retry',
  'settings.connEmpty':
    'No connections yet. Add one here, or sync one saved on another device.',
  'settings.connNoMatches': 'No connections match your search.',
  'settings.connSearch': 'Search connections',
  'settings.connCatalogUnavailable':
    'Connections on other devices are unavailable right now.',
  'settings.connCatalogError':
    'Connections on other devices are unavailable: {{reason}}',
  'settings.connHarnessNative': 'its own sign-in or native configuration',
  'settings.connHarnessLegacy': 'a native profile',
  'settings.connOnDevices': 'On {{devices}}',
  'settings.connStateOffline': 'Offline',
  'settings.connStateConflict': 'Versions differ',
  'settings.connSync': 'Sync',
  'settings.connSyncing': 'Syncing…',
  'settings.connSyncHint':
    'Copy this connection and its key to this device. Nothing is applied.',
  'settings.connSyncFailed': 'Unable to sync this connection.',
  'settings.connSyncedHint': '{{name}} is now on this device.',
  'settings.connSyncedChoose':
    '{{name}} is now on this device and can be chosen above.',
  'settings.connChooseSource': 'Sync from which device?',
  'settings.connChooseSourceHint':
    "These devices hold different versions. The chosen version replaces this device's copy.",
  'settings.connApplyTitle': 'Apply {{name}} to {{harness}}',
  'settings.connApplying': 'Applying…',
  'settings.connApplyHint':
    'Only this harness changes. Running tasks finish first; idle sessions restart with the new upstream.',
  'settings.connApplyFailed': 'Unable to apply this connection.',
  'settings.connApplied': '{{harness}} now uses {{name}} · {{model}}.',
  'settings.connHarnessesTitle': 'Use in harnesses',
  'settings.connHarnessesHint':
    'Choose a saved connection and apply it. Saving or syncing a connection never changes a harness.',
  'settings.connHarnessesNone':
    'No harnesses are installed. Saved connections can still be used by plugins.',
  'settings.connHarnessChoose': 'Connection for {{harness}}',
  'settings.connHarnessPick': 'Choose a connection',
  'settings.connHarnessNoneCompatible': 'No compatible saved connection',
  'settings.connNotInstalled': 'Not installed',
  'settings.connSavedInUse':
    '{{name}} saved. Harnesses using it keep the applied version until you reapply.',
  'settings.connUsagePending': '{{harness}} · not applied',
  'settings.connUsedBy': 'Used by {{harness}}',
  'settings.connPending': 'Not applied',
  'settings.connPendingHint':
    '{{harness}} still uses the version applied earlier. Reapply to use the saved changes.',
  'settings.connAddShort': 'Add',
  'settings.connApplyShort': 'Apply',
  'settings.connReapplyShort': 'Reapply',
  'settings.connApplyNamed': 'Apply {{name}} to {{harness}}',
  'settings.connReapplyNamed': 'Reapply {{name}} to {{harness}}',
  'settings.connSyncNamed': 'Sync {{name}} to this device',
  'settings.connTest': 'Test connection',
  'settings.connTesting': 'Testing…',
  'settings.connTestOk': 'Connection works.',
  'settings.connTestOkLatency': 'Connection works ({{ms}} ms).',
  'settings.connTestOkNamed': '{{name}} works ({{ms}} ms).',
  'settings.connTestOkNamedPlain': '{{name}} works.',
  'settings.connTestFailed': 'Connection test failed.',
  'settings.connTestSaveFirst': 'Save the connection first, then test it.',
  'settings.connRemoveHere': 'Remove from this device',
  'settings.connRemoveTitle': 'Remove connection from this device?',
  'settings.connRemoveHint':
    'Other devices keep their copies. Harnesses and plugins using it must switch first.',
  'settings.connRemoving': 'Removing…',
  'settings.connRemoveFailed': 'Unable to remove this connection.',
  'settings.connRemoved': '{{name}} was removed from this device.',
  'settings.connPreset': 'Preset',
  'settings.connPresetCustom': 'Custom',
  'settings.connName': 'Name',
  'settings.connProtocol': 'API format',
  'settings.connProtocolHint':
    'The wire format the endpoint speaks, not the model brand.',
  'settings.connProtocolNotHere':
    'This format cannot be used here. Choose another format.',
  'settings.connProtocolOpenAIChat': 'OpenAI Chat Completions',
  'settings.connProtocolOpenAIResponses': 'OpenAI Responses',
  'settings.connProtocolAnthropic': 'Anthropic Messages',
  'settings.connProtocolGemini': 'Gemini',
  'settings.connBaseUrl': 'Base URL',
  'settings.connApiKey': 'API key',
  'settings.connApiKeyKeep': 'Leave empty to keep the saved key',
  'settings.connApiKeyEndpointChanged':
    'The URL or API format changed, so enter the key again.',
  'settings.connAuth': 'Authentication',
  'settings.connAuthKey': 'API key (x-api-key)',
  'settings.connAuthBearer': 'Bearer token',
  'settings.connModel': 'Default model',
  'settings.connModelPlaceholder': 'Model ID',
  'settings.connFindModels': 'Find models',
  'settings.connRefreshModels': 'Refresh models',
  'settings.connChooseModel': 'Choose a discovered model',
  'settings.connModelsFound': '{{count}}{{more}} models found',
  'settings.connModelsLoading': 'Looking up models…',
  'settings.connModelsFailed':
    "Couldn't list models ({{reason}}). Type the model ID instead.",
  'settings.connModelsEmpty': 'No models listed. Type the model ID instead.',
  'settings.connModelsNeedEndpoint':
    'Enter the URL and key to list models, or type the model ID.',
  'settings.connModelsUnsupported': 'This Supervisor cannot list models yet.',
  'settings.connUnknownError': 'unknown error',
  'settings.connAdvanced': 'Advanced',
  'settings.connHeaders': 'Custom request headers',
  'settings.connHeadersStored':
    'Saved privately: {{names}}. Leave empty to keep them.',
  'settings.connHeadersInvalid': 'Use one Name: value per line.',
  'settings.connSave': 'Save connection',
  'settings.connSaveShort': 'Save',
  'settings.connSaving': 'Saving…',
  'settings.connSaveFailed': 'Unable to save this connection.',
  'settings.connSaved': '{{name}} saved. Nothing was applied.',
  'settings.connSaveOnlyHint': 'Saving does not change any harness or plugin.',
  'settings.connCancel': 'Cancel',
  'settings.connReloadLatest': 'Load the latest version (discards your edits)',
  'settings.connGone': 'This connection no longer exists on this device.',
  'settings.connDiscardTitle': 'Discard changes?',
  'settings.connDiscardHint':
    'Your unsaved changes to this connection will be lost.',
  'settings.connKeepEditing': 'Keep editing',
  'settings.connDiscard': 'Discard',
  'settings.connPickerLabel': 'Saved connection',
  'settings.connPickerNone': 'Choose a connection',
  'settings.connPickerMissing': 'Unavailable connection',
  'settings.connPickerMissingHint':
    'The chosen connection is not on this device. Sync it or choose another.',
  'settings.connPickerOtherProtocol':
    '{{name}} ({{protocol}}, not supported here)',
  'settings.connPickerRemote': 'On other devices — sync to use here',
  'settings.connAdvancedNative': '{{harness}} native configuration',
  'settings.connAdvancedNativeHint':
    'Import a native or CC Switch configuration, or restore the configuration from before an upstream was applied.',
  'settings.connErrorPeerAccess':
    'Device-to-device access is off. Turn on peer access for both devices in Devices, then sync again.',
  'settings.connErrorNotCertified':
    'Both devices must be bound to your account before credentials can sync. Rebind the device, then try again.',
  'settings.connErrorSourceOffline':
    'The source device is offline. Sync when it is back online.',
  'settings.connErrorSyncConflict':
    "This device's copy changed meanwhile. Refresh, check it, then sync again.",
  'settings.connErrorRevisionMoved':
    'The source saved a newer version. Refresh and sync again.',
  'settings.connErrorTokenExpired':
    'The sync authorization expired. Try again.',
  'settings.connErrorEditConflict':
    'Someone else changed this connection. Load the latest version or keep your edits and save as a new connection.',
  'settings.connErrorInUse':
    'A harness or plugin still uses this connection. Switch it to another connection first.',
  'settings.connErrorHarnessBusy':
    'The harness is busy. Try again after its running tasks finish.',
  'settings.connErrorProtocol':
    "This harness cannot use this connection's API format.",
  'settings.connErrorChanged':
    'The connection changed elsewhere. Refresh and try again.',
  'settings.upstreamsTab': 'Upstreams',
  'settings.upstreamsDescription':
    'Save API connections once, then apply them to harnesses or choose them in plugins.',
  'settings.upstreamsChooseDevice': 'Open a device to manage its upstreams.',
  'settings.upstreamsInventoryError':
    'Unable to check installed harnesses. Refresh to try again.',
  'settings.upstreamsRefresh': 'Refresh',
  'settings.upstreamsNoInstalled':
    'No harnesses are installed on this device. Install one in Harnesses to manage its upstreams.',
  'settings.upstreamsSearch': 'Search upstreams',
  'settings.upstreamsNoMatches': 'No upstreams match your search.',
  'settings.upstreamsDirect': 'Direct connection',
  'settings.upstreamsMoreActions': 'More actions for {{name}}',
  'settings.upstreamsHarness': 'Harness',
  'settings.messageShortcuts': 'Message shortcuts',
  'settings.savedToYourAccountAndAppliedAcross':
    'Saved to your account and applied across devices and browsers. On Mac, Command also works in place of Ctrl.',
  'settings.ctrlEnterToSend': 'Ctrl+Enter to send',
  'settings.enterInsertsANewLineCtrlShift':
    'Enter inserts a new line. Ctrl+Shift+Enter sends directly as steer.',
  'settings.enterToSend': 'Enter to send',
  'settings.shiftEnterInsertsANewLineCtrl':
    'Shift+Enter inserts a new line. Ctrl+Enter sends directly as steer.',
  'settings.saving': 'Saving...',
  'settings.loading': 'Loading...',
  'settings.signInThroughRelayToChangeYour':
    'Sign in through Relay to change your account shortcuts.',
  'settings.steerDeliversToTheRunningTurnImmediately':
    'Steer delivers to the running turn immediately. When idle, it starts a new turn.',
  'settings.retry': 'Retry',
  'settings.workspacePermissions': 'Workspace permissions',
  'settings.fullAccess': 'Full access',
  'settings.harnessSettings': 'Harness settings',
  'settings.model': 'Model',
  'settings.harnessModel': 'Harness model',
  'settings.reasoningEffort': 'Reasoning effort',
  'settings.harnessReasoningEffort': 'Harness reasoning effort',
  'settings.providerDefault': 'Provider default',
  'settings.sessionSettingsCanBeChangedAfterThe':
    'Session settings can be changed after the current turn finishes.',
  'settings.loadingHarnessCapabilities': 'Loading harness capabilities…',
  'settings.harnessPlugins': 'Harness plugins',
  'settings.plugins': 'Plugins ·',
  'settings.profile': 'profile',
  'settings.readOnlySnapshotFromThisSessionS':
    'Read-only snapshot from this session’s process at startup.',
  'settings.filterPlugins': 'Filter plugins',
  'settings.enabled': 'Enabled',
  'settings.disabled': 'Disabled',
  'settings.defaultRestored': 'Default restored.',
  'settings.modelPricesSaved': 'Model prices saved.',
  'settings.unableToSavePrices': 'Unable to save prices.',
  'settings.modelPricing': 'Model pricing',
  'settings.addModel': 'Add model',
  'settings.uSDPer1MTokensInExcludesCache':
    'USD per 1M tokens · In excludes cache. Estimates exclude tool fees and cache storage. Applies to all workspaces on this device.',
  'settings.searchModelPrices': 'Search model prices',
  'settings.searchModelIDOrDisplayName': 'Search model ID or display name',
  'settings.edit': 'Edit',
  'settings.custom': 'custom',
  'settings.edit_c10442': 'Edit {{value1}}',
  'settings.editModelPrices': 'Edit model prices',
  'settings.uSDPer1MTokens': 'USD per 1M tokens',
  'settings.modelID': 'Model ID',
  'settings.pricingModelID': 'Pricing model ID',
  'settings.displayNamesAliasesCommaSeparated':
    'Display names / aliases (comma separated)',
  'settings.modelAliases': 'Model aliases',
  'settings.pricePerMillion': '{{value1}} price per million',
  'settings.longContextAbove': 'Long context: above',
  'settings.inputTokInCache': 'input tok · In/cache ×',
  'settings.out': '· Out ×',
  'settings.officialPricingChecked': 'Official pricing · checked',
  'settings.saving_56a228': 'Saving…',
  'settings.savePrices': 'Save prices',
  'settings.cancel': 'Cancel',
  'settings.resetRemoveCustom': 'Reset / remove custom',
  'settings.updateThisSupervisorToEnableUpstreamAnd':
    'Update this Supervisor to enable upstream and template management.',
  'settings.unableToSaveUpstreamSettings': 'Unable to save upstream settings',
  'settings.deviceTemplates': 'Device templates',
  'settings.upstreamManagement': 'Upstream management',
  'settings.upstreams': '{{value1}} upstreams',
  'settings.upstreams_8b39d6': 'Upstreams',
  'settings.savedOnThisDeviceSwitchProvidersWithout':
    'Saved on this device. Switch providers without opening its terminal.',
  'settings.importConfig': 'Import config',
  'settings.addUpstream': 'Add upstream',
  'settings.addAnAPIProviderOrImportAn':
    'Add an API provider or import an existing configuration to get started.',
  'settings.active': 'Active',
  'settings.duplicate': 'Duplicate {{value1}}',
  'settings.useUpstream': 'Use upstream',
  'settings.sendsASmallRequestUsingThisModel':
    'Sends a small request using this model; API charges may apply',
  'settings.testConnection': 'Test connection',
  'settings.delete': 'Delete {{value1}}',
  'settings.switchAfterCurrentTasksFinishExistingMCP':
    'Switch after current tasks finish. Existing MCP and skill settings are preserved. Connection tests send a small model request and may incur API charges.',
  'settings.configurationBackups': 'Configuration backups',
  'settings.restorePrevious': 'Restore previous',
  'settings.installHarnessesAndConfigureTheirUpstreamsTogether':
    'Install harnesses and configure their upstreams together.',
  'settings.importTemplate': 'Import template',
  'settings.exportTemplate': 'Export template',
  'settings.deactivateAndDeleteUpstream': 'Deactivate and delete upstream',
  'settings.deleteUpstream': 'Delete upstream',
  'settings.thisRestoresTheNativeConfigurationFromBefore':
    'This restores the native configuration from before managed upstreams were enabled. Running tasks must finish first. Other saved upstreams remain available.',
  'settings.removeThisSavedUpstreamFromTheDevice':
    'Remove this saved upstream from the device.',
  'settings.removing': 'Removing…',
  'settings.installingAndConfiguringThisDevice':
    'Installing and configuring this device…',
  'settings.templateAppliedThisDeviceIsReady':
    'Template applied. This device is ready.',
  'settings.editUpstream': 'Edit upstream',
  'settings.name': 'Name',
  'settings.baseURL': 'Base URL',
  'settings.aPIKey': 'API key',
  'settings.leaveEmptyToKeepTheSavedKey': 'Leave empty to keep the saved key',
  'settings.authentication': 'Authentication',
  'settings.aPIKeyXApiKey': 'API key (x-api-key)',
  'settings.bearerToken': 'Bearer token',
  'settings.aPIFormat': 'API format',
  'settings.chatCompletions': 'Chat completions',
  'settings.contextWindow': 'Context window',
  'settings.saveUpstream': 'Save upstream',
  'settings.importUpstreamConfiguration': 'Import upstream configuration',
  'settings.importDeviceTemplate': 'Import device template',
  'settings.aPIKeyIfAbsentFromTheFile': 'API key (if absent from the file)',
  'settings.pasteNativeTOMLJSONOrACC':
    'Paste native TOML/JSON or a CC Switch provider settingsConfig. Only provider fields are imported.',
  'settings.configurationMustBeSmallerThan256KB':
    'Configuration must be smaller than 256 KB.',
  'settings.chooseFile': 'Choose file',
  'settings.configurationJSONOrTOML': 'Configuration JSON or TOML',
  'settings.installIfMissing': 'Install if missing:',
  'settings.none': 'none',
  'settings.message': '自动探测模型',
  'settings.eachCompletedStepIsRetainedIfA':
    'Each completed step is retained if a later step fails. Existing configuration is backed up before switching.',
  'settings.working': 'Working…',
  'settings.importUpstream': 'Import upstream',
  'settings.applyTemplate': 'Apply template',
  'settings.templateNotJson': 'The template is not valid JSON. Check its brackets, quotes and commas. Details: {{value1}}',
  'settings.previewTemplate': 'Preview template',
  'settings.updateThisSupervisorToEnableModelDiscovery':
    'Update this Supervisor to enable model discovery.',
  'settings.unableToLoadModels': 'Unable to load models',
  'settings.loadingModels': 'Loading models…',
  'settings.selectAModel': 'Select a model',
  'settings.configured': '(configured)',
  'settings.enterTheUpstreamURLAndAPIKey':
    'Enter the upstream URL and API key to discover models.',
  'settings.discoveringModelsFromThisUpstream':
    'Discovering models from this upstream…',
  'settings.modelsFound': '{{value1}} models found{{value2}}.',
  'settings.noModelsReturnedByThisUpstream':
    'No models returned by this upstream.',
  'settings.refreshModels': 'Refresh models',
  'settings.unableToLoadYourMessageShortcuts':
    'Unable to load your message shortcuts.',
  'settings.unableToSaveYourMessageShortcuts':
    'Unable to save your message shortcuts.',
  'settings.settings': 'Settings',
  'settings.settingsCategories': 'Settings categories',
  'settings.in': 'In',
  'settings.cached': 'Cached',
  'settings.out_220e06': 'Out',
  'settings.cacheWriteOneHour': 'Cache write (1h)',
  'settings.cacheWrite': 'Cache write',
  'settings.templateExportedWithoutAPIKeysFillThem':
    'Template exported without API keys. Fill them in before importing on another device.',
  'settings.configurationAppliedIdleSessionsWereRestartedThe':
    '{{value1}} configuration applied. Idle sessions were restarted; the next turn uses this upstream.',
  'settings.connectionSucceededMs':
    '{{value1}}: connection succeeded ({{value2}} ms).',
  'settings.previousConfigurationRestoredTheNextTurnReloads':
    'Previous configuration restored. The next turn reloads it.',
  'settings.upstreamRemoved': 'Upstream removed.',
  'settings.listTruncated': ' (list truncated)',
  'settings.dshTitle': 'DeepSeek Harness {{value1}} · {{value2}} profile',
  'settings.dshBridgeNotice':
    'Live controls come from this session’s DSH process through the Pockymoe bridge.',
  'settings.dshAutonomous':
    'DSH is working outside a turn (goal rounds or background work).',
  'settings.dshStop': 'Stop',
  'settings.dshSession': 'Session state',
  'settings.dshPermissionPreset': 'Permission preset',
  'settings.dshPlanMode': 'Plan mode',
  'settings.dshOn': 'On',
  'settings.dshOff': 'Off',
  'settings.dshPending': 'switches at the next turn',
  'settings.dshGoal': 'Goal',
  'settings.dshGoalState': '{{value1}} · {{value2}} · round {{value3}}',
  'settings.dshNone': 'None',
  'settings.dshTodos': 'Todo list',
  'settings.dshProfileSettings': 'Profile settings',
  'settings.dshProfileSettingsNotice':
    'Saved to the DSH profile. Applies to this thread now and to other DSH threads after they reconnect.',
  'settings.dshDefault': 'Default',
  'settings.dshCustomized': 'customized',
  'settings.dshBundles': 'Bundles',
  'settings.dshProviders': 'Model providers',
  'settings.dshInProfile': 'in profile',
  'settings.dshRestartRequired':
    'Saved. The change applies after this thread reconnects.',
  'settings.dshReconnect': 'Reconnect to apply',
  'settings.dshEnable': 'Enable {{value1}}',
  'settings.dshManaged': 'Managed by DSH',
  'settings.dshAfterReconnect': 'applies after reconnect',
  'settings.dshRunMode': 'Run mode',
  'settings.dshRunModeDefault': '{{value1}} (default)',
  'settings.dshRunModeStandard': 'Standard',
  'settings.dshRunModeStandardHint':
    "DSH's full coding tool set for code, files and research. Suits most tasks.",
  'settings.dshRunModePtc': 'PTC',
  'settings.dshRunModePtcHint':
    "Programmatic tool calling: Standard's tools, called from TypeScript programs the agent writes. Suits batch work that filters or summarizes many results.",
  'settings.dshRunModeMinimal': 'Minimal',
  'settings.dshRunModeMinimalHint':
    'Only a persistent terminal. For baselines and model comparisons.',
  'settings.dshRunModeCordis': 'Creator',
  'settings.dshRunModeCordisHint':
    'Standard plus DSH authoring: the agent can write DSH plugins, add UI, and compose its own run modes.',
  'settings.dshRunModeLocked':
    'Fixed once the first turn starts. Start a new DeepSeek Harness thread to use another run mode.',
  'settings.dshRunModeUnavailable':
    'This DSH install offers no run modes or native console here (plain ACP profile).',
  'settings.dshCommands': 'Commands',
  'settings.dshCommandsNotice':
    "Runs in this thread's DSH session, including commands added by DSH plugins. Plan mode, permissions, goals and compaction stay on the thread's own controls.",
  'settings.dshCommandArguments': 'Arguments for /{{value1}}',
  'settings.dshRunCommand': 'Run /{{value1}}',
  'settings.dshRun': 'Run',
  'settings.dshCommandDone': '/{{value1}} finished.',
  'settings.dshThreadControl': 'Thread control',
  'settings.dshInConsole': 'In the native console',
  'settings.dshConsole': 'Native DSH console',
  'settings.dshConsoleNotice':
    "Opens DSH's own Web UI from this thread's DSH process in a new tab, with interfaces added by DSH plugins and DSH's editors. Keep chatting here; prompts sent from the console are not recorded in this thread.",
  'settings.dshOpenConsole': 'Open console',
  'settings.dshConsoleLoopbackOnly':
    "The DSH console listens on the device's loopback address. Open Pockymoe on the device itself (localhost) or through Pockymoe Relay.",
  'settings.dshFeedbackNotice':
    "Sends your text and this session's history to DeepSeek, unless DSH telemetry is turned off on this device (DSH_TELEMETRY_DISABLED).",
  'settings.dshFeedbackSend': 'Send',
  'settings.dshFeedbackConfirm':
    "DSH will send your feedback and this session's history to DeepSeek unless DSH telemetry is turned off on this device. Send it?",
  'settings.upstreamsShowUninstalled': 'Show uninstalled',
  'settings.upstreamsUninstalled':
    'Install this harness in Harnesses before enabling a provider.',
  'settings.upstreamsEnable': 'Enable',
  'settings.upstreamsUsing': 'Using',
  'settings.upstreamsMode': 'Connection mode',
  'settings.upstreamsDirectHint':
    'Providers write directly to the harness configuration.',
  'settings.upstreamsPreset': 'Provider preset',
  'settings.upstreamsCustom': 'Custom provider',
  'settings.upstreamsOpenAICompatible': 'OpenAI compatible',
  'settings.upstreamsModelId': 'Model ID',
  'settings.upstreamsDiscoverModels': 'Discover available models',
  'settings.upstreamsHaiku': 'Haiku model',
  'settings.upstreamsSonnet': 'Sonnet model',
  'settings.upstreamsOpus': 'Opus model',
  'settings.upstreamsMessages': 'Anthropic Messages',
  'settings.upstreamsHeaders': 'Custom request headers',
  'settings.upstreamsHeadersHint':
    'Claude/Gemini: one Name: value per line. Others: a JSON object.',
  'settings.upstreamsStoredHeaders':
    'Headers stored privately. Leave untouched to keep them.',
  'settings.upstreamsConfigFragment': 'Provider configuration (JSON)',
  'settings.upstreamsConfigHint':
    'Provider fields only. Stored secrets appear as [stored privately]; leave those values unchanged to preserve them. Tool credentials and global settings stay in the native configuration.',
  'settings.upstreamsInvalidJSON':
    'Enter a valid JSON object; header values must be strings.',
  'settings.upstreamsImportLive': 'Import current configuration',
  'settings.upstreamsImportedLive':
    'Current live configuration imported as a provider.',
  'settings.upstreamsMoveUp': 'Move up',
  'settings.upstreamsMoveDown': 'Move down',
  'settings.upstreamsSpeedTest': 'Endpoint speed test',
  'settings.upstreamsSpeedResult':
    '{{name}}: {{latency}} ms (HTTP {{status}}).',
  'settings.upstreamsEditConflict': 'Configuration changed',
  'settings.upstreamsEditConflictHint':
    'Another edit or the harness changed this configuration. Reload the current values before saving; your unsaved edits will be discarded when you reload.',
  'settings.upstreamsReloadEditor': 'Reload current configuration',
  'settings.upstreamsKeepEditing': 'Keep editing',
  'settings.harnessMaintenanceDescription':
    'Install and update harnesses and their ACP adapters. Manage providers in Upstreams.',
  'settings.upstreamsDeepSeekOfficial': 'DeepSeek API',
  'settings.upstreamsResponses': 'Responses',
  'settings.dshRunModeBroken': '{{value1}} (unavailable: {{value2}})',
  'settings.dshRunModeBrokenUnknown': 'DSH reports it cannot load',
  'settings.resourcesTab': 'Resources',
  'settings.resourcesDescription':
    'Release idle harnesses and cap how many stay loaded.',
  'settings.resourcesChooseDevice': 'Open a device to manage its resources.',
  'settings.resourcesUnavailable':
    "Update this device's Supervisor to change resource settings.",
  'settings.idleRelease': 'Release idle threads',
  'settings.idleReleaseHint':
    "Ends a thread's harness once no page shows it and it has been idle this long.",
  'settings.idleReleaseUnit': 'min',
  'settings.maxLoadedThreads': 'Limit loaded threads',
  'settings.maxLoadedThreadsHint':
    'Above this, the least recently used idle threads are released first.',
  'settings.maxHarnessMemory': 'Limit harness memory',
  'settings.maxHarnessMemoryHint':
    'Measured as in the device monitor. Busy threads are never stopped.',
  'settings.resourcesMinutesRange': 'Enter 1–1440 minutes.',
  'settings.resourcesThreadsRange': 'Enter 1–200 threads.',
  'settings.resourcesMemoryRange': 'Enter at least 0.25 GiB.',
  'settings.resourcesSaved': 'Saved.',
  'settings.passcodeTitle': 'Access passcode',
  'settings.passcodeOffDescription':
    'Anyone who can open this address can use Pockymoe. Set a passcode to make other browsers enter it first.',
  'settings.passcodeOnDescription':
    'On. Other browsers enter the passcode once before using Pockymoe.',
  'settings.passcodeLabel': 'Passcode',
  'settings.passcodeNewLabel': 'New passcode',
  'settings.passcodeEnable': 'Turn on',
  'settings.passcodeChange': 'Change',
  'settings.passcodeDisable': 'Turn off',
  'settings.passcodeDisableTitle': 'Turn off the passcode?',
  'settings.passcodeDisableAction': 'Turn off',
  'settings.passcodeDisableConfirm':
    'Turn off the passcode? Anyone who can open this address can use Pockymoe again.',
  'settings.passcodeSaved': 'Passcode saved. Other browsers are signed out.',
  'settings.passcodeRemoved': 'Passcode turned off.',
  'settings.passcodeForgot':
    'Forgot it? Run pockymoe passcode off on this computer.',
  'settings.passcodeTooShort': 'Use at least 4 characters.',
} as const;
