export const contentQualityEn = {
  'quality.report.reviewed': 'Reviewed',
  'quality.report.connected': 'Connection succeeded',
  'quality.report.repliesDisabled': 'Automatic reply polishing is disabled',
  'quality.report.noReply': 'No reply to polish',
  'quality.report.shortReply': 'Reply is below the minimum length',
  'quality.report.alreadyPolished': 'Reply is already polished',
  'quality.report.turnNotCompleted': 'Turn did not complete successfully',
  'quality.report.unsupportedMarkup': 'Document markup is unsupported',
  'quality.report.fileWritten': 'Revised file written',
  'quality.report.fileUnchanged': 'File unchanged',
  'quality.report.findings': 'Findings',
  'quality.report.noFindings': 'No findings reported.',
  'quality.report.diff': 'Proposed diff',
  'quality.report.proposal': 'Proposed revised text',
  'quality.report.reply': 'Reply polishing',
  'quality.report.scanError': 'Document scan failed',
  'quality.report.noDocuments': 'No documents reviewed.',
  'quality.report.moreDocuments': 'Additional eligible documents were not reviewed in this run.',
  'quality.name': 'Content Quality',
  'quality.description':
    'Polish long agent replies and review or rewrite documents with your chosen model.',
  'quality.connectionFile': 'Connection profile file',
  'quality.connectionFileHint':
    'Path to a private connection profile on the Supervisor device. Configure credentials in that file; only its path is stored here.',
  'quality.model': 'Model',
  'quality.modelHint': 'Model identifier supported by your connection profile.',
  'quality.language': 'Output language',
  'quality.languageHint': 'Language tag, for example zh-CN or en.',
  'quality.preset': 'Writing preset',
  'quality.preset.concise': 'Concise',
  'quality.preset.concise.description':
    'Lead with the answer and remove repetition.',
  'quality.preset.clear': 'Clear',
  'quality.preset.clear.description':
    'Improve structure and readability while preserving meaning.',
  'quality.preset.technical': 'Technical',
  'quality.preset.technical.description':
    'Keep precise terminology, implementation details and constraints.',
  'quality.preset.beginner': 'Beginner friendly',
  'quality.preset.beginner.description':
    'Explain unfamiliar terms and add approachable context.',
  'quality.preset.copyedit': 'Copyedit',
  'quality.preset.copyedit.description':
    'Correct grammar and wording with minimal changes to voice.',
  'quality.detail': 'Level of detail',
  'quality.detail.short': 'Short',
  'quality.detail.balanced': 'Balanced',
  'quality.detail.detailed': 'Detailed',
  'quality.readerBackground': 'Reader background',
  'quality.readerBackgroundHint':
    'Optional context about the reader’s experience and needs.',
  'quality.minReplyChars': 'Minimum reply length (characters)',
  'quality.autoReplies': 'Automatically polish long replies',
  'quality.autoRepliesHint':
    'Applies when this plugin is enabled. Original replies are always retained. Polishing may incur model usage charges.',
  'quality.autoDocuments': 'Automatically review changed documents',
  'quality.autoDocumentsHint':
    'With this plugin enabled, review up to 5 modified or untracked documents after a successful turn. Findings appear in automation history. Automatic review does not rewrite files or block commits and may incur model charges.',
  'quality.documentMode': 'Default manual document action',
  'quality.documentMode.review': 'Review — findings and proposed changes',
  'quality.documentMode.rewrite': 'Rewrite — write the revised file',
  'quality.documentModeHint':
    'Manual review returns findings and a proposal. Manual rewrite writes the revised file. Automatic document reviews always use review mode.',
  'quality.loading': 'Loading settings…',
  'quality.saving': 'Saving…',
  'quality.save': 'Save settings',
  'quality.saved': 'Settings saved.',
  'quality.reload': 'Reload saved settings',
  'quality.reloadHint':
    'Reloading replaces your edits with the latest saved settings.',
  'quality.loadError': 'Unable to load settings. Reload to try again.',
  'quality.saveError':
    'Unable to save settings. Your edits are retained; try saving again.',
  'quality.conflict':
    'Settings changed elsewhere. Your edits are retained. Reload the latest settings before saving again.',
  'quality.polished': 'Polished',
  'quality.original': 'Original',
  'quality.replyVersion': 'Reply version',
} as const;
