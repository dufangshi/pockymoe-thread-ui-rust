import { translate } from '../i18n';
import { ContentQualitySettings } from './ContentQualitySettings';
import {
  ContentQualityActionOutput,
  canRenderContentQualityActionOutput,
} from './ContentQualityActionOutput';
import type { FrontendPluginModule } from './plugin-types';

export const CONTENT_QUALITY_PLUGIN_ID = 'pockymoe.content-quality';

export const contentQualityPlugin: FrontendPluginModule = {
  renderActionOutput: (context) =>
    canRenderContentQualityActionOutput(context) ? (
      <ContentQualityActionOutput {...context} />
    ) : null,
  defaultEnabled: false,
  manifest: {
    id: CONTENT_QUALITY_PLUGIN_ID,
    get name() {
      return translate('quality.name');
    },
    version: '0.1.0',
    get description() {
      return translate('quality.description');
    },
    remoteCodex: '>=0.13.6',
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [],
      actions: [
        'rewriteReply',
        'reviewDocument',
        'testConnection',
        'afterTurn',
      ],
    },
  },
  settingsSections: [
    {
      id: 'quality',
      get label() {
        return translate('quality.name');
      },
      get description() {
        return translate('quality.description');
      },
      render: (context) => <ContentQualitySettings {...context} />,
    },
  ],
  presentMessage: ({ item, streaming }) => {
    const reply = item.polishedReply;
    if (
      item.kind !== 'agentMessage' ||
      streaming ||
      !reply ||
      typeof reply.text !== 'string' ||
      !reply.text.trim() ||
      typeof reply.sourceHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(reply.sourceHash)
    )
      return null;
    return {
      id: `quality:${reply.sourceHash}:${reply.createdAt}`,
      text: reply.text,
      label: translate('quality.polished'),
      originalLabel: translate('quality.original'),
      validate: async () => {
        const hash = await globalThis.crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(item.text),
        );
        return (
          Array.from(new Uint8Array(hash), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('') === reply.sourceHash
        );
      },
    };
  },
};
