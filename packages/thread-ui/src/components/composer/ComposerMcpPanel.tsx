import { translate, useI18n } from '../../i18n';
import type { ThreadMcpServersDto } from '@pockymoe/shared';

import { ErrorMark } from '../copy/ErrorMark';
import { authStatusLabel } from './composerPresentation';
import type { McpPanelMode, SlashPanelState } from './types';

interface ComposerMcpPanelProps {
  mcpPanelMode: McpPanelMode;
  mcpState: SlashPanelState<ThreadMcpServersDto>;
  mcpConfigEditing: boolean;
  mcpConfigPath: string | null;
  mcpConfigError: string | null;
  mcpConfigSuccess: string | null;
  mcpConfigBusy: boolean;
  mcpHttpName: string;
  mcpHttpUrl: string;
  mcpRawBlock: string;
  composerPanelButtonClassName: string;
  composerChipButtonClassName: string;
  onSetMcpPanelMode: (mode: McpPanelMode) => void;
  onClearMcpConfigStatus: () => void;
  onSetMcpHttpName: (value: string) => void;
  onSetMcpHttpUrl: (value: string) => void;
  onSetMcpRawBlock: (value: string) => void;
  onPrepareRawMcpBlock: () => Promise<void> | void;
  onSaveHttpMcp: () => Promise<void> | void;
  onSaveRawMcpBlock: () => Promise<void> | void;
}

export function ComposerMcpPanel({
  mcpPanelMode,
  mcpState,
  mcpConfigEditing,
  mcpConfigPath,
  mcpConfigError,
  mcpConfigSuccess,
  mcpConfigBusy,
  mcpHttpName,
  mcpHttpUrl,
  mcpRawBlock,
  composerPanelButtonClassName,
  composerChipButtonClassName,
  onSetMcpPanelMode,
  onClearMcpConfigStatus,
  onSetMcpHttpName,
  onSetMcpHttpUrl,
  onSetMcpRawBlock,
  onPrepareRawMcpBlock,
  onSaveHttpMcp,
  onSaveRawMcpBlock,
}: ComposerMcpPanelProps) {
  useI18n();
  const form = mcpPanelMode === 'http' || mcpPanelMode === 'stdio';
  // A failed save sits after its button; other failures (a load with servers
  // already listed, preparing a block) after the heading; nothing loaded at all
  // takes the list's place.
  const saveError = form ? mcpConfigError : null;
  const headingErrors = [
    mcpState.data || mcpPanelMode !== 'list' ? mcpState.error : null,
    form ? null : mcpConfigError,
  ].filter((message, index, all): message is string =>
    Boolean(message) && all.indexOf(message) === index && message !== saveError);
  const saveMark = saveError ? <ErrorMark message={saveError} /> : null;
  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-stone-400">
            <span>{translate("chat.mCPConfigSource")}</span>
            {headingErrors.map((message) => <ErrorMark key={message} message={message} />)}
          </p>
          <p className="truncate text-[11px] text-stone-500">
            {mcpConfigPath ?? translate("chat.providerConfig")}
          </p>
        </div>
        {mcpPanelMode === 'list' && mcpConfigEditing ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSetMcpPanelMode('add');
              onClearMcpConfigStatus();
            }}
            className="shrink-0 rounded-full border border-sky-300/35 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-300/10"
          >
            {translate("chat.addMCP")}</button>
        ) : null}
      </div>
      {mcpState.status === 'loading' && !mcpState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.loadingMCPServers")}</p>
      ) : null}
      {mcpState.error && !mcpState.data && mcpPanelMode === 'list' ? (
        <p className="mb-2 flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          <span className="min-w-0">{translate("workbench.unableToLoadMCPServers")}</span>
          <ErrorMark message={mcpState.error} />
        </p>
      ) : null}
      {mcpConfigSuccess ? (
        <p className="mb-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100/90">
          {mcpConfigSuccess}
        </p>
      ) : null}
      {mcpPanelMode === 'add' ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSetMcpPanelMode('http');
              onClearMcpConfigStatus();
            }}
            className={`${composerPanelButtonClassName} block w-full rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-left transition`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-stone-100">
                HTTP / Streamable HTTP
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                {translate("chat.form")}</span>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              {translate("chat.addAnMCPServerWithAName")}</p>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onPrepareRawMcpBlock();
            }}
            className={`${composerPanelButtonClassName} block w-full rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-left transition`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-stone-100">
                {translate("chat.stdioRawBlock")}</span>
              <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                TOML
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              {translate("chat.writeASingleMcpServersNameBlock")}</p>
          </button>
        </div>
      ) : null}
      {mcpPanelMode === 'http' ? (
        <div className="space-y-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3">
          <div>
            <label className="mb-1 block text-xs text-stone-400">
              {translate("chat.mCPName")}</label>
            <input
              aria-label={translate("chat.mCPName")}
              value={mcpHttpName}
              onChange={(event) => onSetMcpHttpName(event.target.value)}
              placeholder="openaiDeveloperDocs"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-400">URL</label>
            <input
              aria-label="URL"
              value={mcpHttpUrl}
              onChange={(event) => onSetMcpHttpUrl(event.target.value)}
              placeholder="https://developers.openai.com/mcp"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSetMcpPanelMode('add')}
              className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition`}
            >
              {translate("chat.back")}</button>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void onSaveHttpMcp()}
                disabled={mcpConfigBusy}
                className="ui-status-info rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mcpConfigBusy ? translate("chat.saving") : translate("chat.writeHTTPMCP")}
              </button>
              {saveMark}
            </span>
          </div>
        </div>
      ) : null}
      {mcpPanelMode === 'stdio' ? (
        <div className="space-y-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3">
          <label className="block text-xs text-stone-400">
            {translate("chat.mCPBlockForProviderConfig")}</label>
          <textarea
            aria-label={translate("chat.mCPBlockForProviderConfig")}
            value={mcpRawBlock}
            onChange={(event) => onSetMcpRawBlock(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSetMcpPanelMode('add')}
              className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition`}
            >
              {translate("chat.back")}</button>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void onSaveRawMcpBlock()}
                disabled={mcpConfigBusy}
                className="ui-status-info rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mcpConfigBusy ? translate("chat.saving") : translate("chat.writeRawBlock")}
              </button>
              {saveMark}
            </span>
          </div>
        </div>
      ) : null}
      {mcpPanelMode === 'list' && mcpState.data?.servers.length ? (
        <div className="space-y-2">
          {mcpState.data.servers.map((server) => (
            <div
              key={server.name}
              className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-100">
                    {server.name}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {server.tools.length} {translate("chat.tools")} {server.resourceCount}{' '}
                    {translate("chat.resources")} {server.resourceTemplateCount} {translate("chat.templates")}</p>
                </div>
                <span className="shrink-0 rounded-full border border-stone-700 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-stone-300">
                  {authStatusLabel(server.authStatus)}
                </span>
              </div>
              {server.tools.length > 0 ? (
                <p className="mt-2 line-clamp-2 text-xs text-stone-500">
                  {server.tools
                    .slice(0, 4)
                    .map((tool) => tool.title ?? tool.name)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {mcpPanelMode === 'list' &&
      mcpState.status !== 'loading' &&
      !mcpState.error &&
      (mcpState.data?.servers.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.noMCPServersAvailableRightNow")}</p>
      ) : null}
    </div>
  );
}
