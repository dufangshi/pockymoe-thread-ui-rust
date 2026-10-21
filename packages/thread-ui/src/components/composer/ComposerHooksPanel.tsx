import { translate, useI18n } from '../../i18n';
import type {
  AgentHookDto,
  AgentHookEventNameDto,
  ThreadHooksDto,
  UpdateThreadHookInput,
} from '@pockymoe/shared';

import {
  editableHookTarget,
  hookEventJsonKey,
  hookEventLabel,
  HOOK_EVENT_OPTIONS,
  hookSourceLabel,
  hookTrustLabel,
} from './composerPresentation';
import { ErrorMark } from '../copy/ErrorMark';
import type { HookScope, HooksPanelMode, SlashPanelState } from './types';

interface ComposerHooksPanelProps {
  hooksPanelMode: HooksPanelMode;
  hooksState: SlashPanelState<ThreadHooksDto>;
  hostConfigFilesAvailable: boolean;
  hookTrustAvailable: boolean;
  hookConfigBusy: boolean;
  hookConfigError: string | null;
  hookConfigSuccess: string | null;
  editingHookTarget: UpdateThreadHookInput['target'] | null;
  hookScope: HookScope;
  hookEventName: AgentHookEventNameDto;
  hookMatcher: string;
  hookCommand: string;
  hookTimeoutSec: string;
  hookStatusMessage: string;
  composerChipButtonClassName: string;
  onResetHookForm: () => void;
  onSetHooksPanelMode: (mode: HooksPanelMode) => void;
  onClearHookConfigStatus: () => void;
  onSetEditingHookTarget: (target: UpdateThreadHookInput['target'] | null) => void;
  onSetHookScope: (scope: HookScope) => void;
  onSetHookEventName: (eventName: AgentHookEventNameDto) => void;
  onSetHookMatcher: (value: string) => void;
  onSetHookCommand: (value: string) => void;
  onSetHookTimeoutSec: (value: string) => void;
  onSetHookStatusMessage: (value: string) => void;
  onSaveHook: () => Promise<void> | void;
  onStartEditingHook: (hook: AgentHookDto) => void;
  onTrustHook: (hook: AgentHookDto) => Promise<void> | void;
  onUntrustHook: (hook: AgentHookDto) => Promise<void> | void;
}

export function ComposerHooksPanel({
  hooksPanelMode,
  hooksState,
  hostConfigFilesAvailable,
  hookTrustAvailable,
  hookConfigBusy,
  hookConfigError,
  hookConfigSuccess,
  editingHookTarget,
  hookScope,
  hookEventName,
  hookMatcher,
  hookCommand,
  hookTimeoutSec,
  hookStatusMessage,
  composerChipButtonClassName,
  onResetHookForm,
  onSetHooksPanelMode,
  onClearHookConfigStatus,
  onSetEditingHookTarget,
  onSetHookScope,
  onSetHookEventName,
  onSetHookMatcher,
  onSetHookCommand,
  onSetHookTimeoutSec,
  onSetHookStatusMessage,
  onSaveHook,
  onStartEditingHook,
  onTrustHook,
  onUntrustHook,
}: ComposerHooksPanelProps) {
  useI18n();
  const editing = hooksPanelMode === 'add' || hooksPanelMode === 'edit';
  // A failed load with hooks already listed, or a failed trust change, is a mark
  // after the heading; a failed save sits after its button; nothing loaded at
  // all takes the list's place.
  const headingErrors = [
    hooksState.data || editing ? hooksState.error : null,
    editing ? null : hookConfigError,
  ].filter((message, index, all): message is string =>
    Boolean(message) && all.indexOf(message) === index && !(editing && message === hookConfigError));
  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-stone-400">
            <span>{translate("chat.hookConfigSources")}</span>
            {headingErrors.map((message) => <ErrorMark key={message} message={message} />)}
          </p>
          <p className="truncate text-[11px] text-stone-500">
            {hooksState.data?.projectHooksPath ?? translate("chat.workspaceHooksConfig")}
          </p>
        </div>
        {hooksPanelMode === 'list' && hostConfigFilesAvailable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onResetHookForm();
              onSetHooksPanelMode('add');
              onClearHookConfigStatus();
            }}
            className="shrink-0 rounded-full border border-sky-300/35 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-300/10"
          >
            {translate("chat.addHook")}</button>
        ) : null}
      </div>
      {hooksState.status === 'loading' && !hooksState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.loadingHooks")}</p>
      ) : null}
      {hooksState.error && !hooksState.data && !editing ? (
        <p className="mb-2 flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          <span className="min-w-0">{translate("workbench.unableToLoadHooks")}</span>
          <ErrorMark message={hooksState.error} />
        </p>
      ) : null}
      {hookConfigSuccess ? (
        <p className="mb-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100/90">
          {hookConfigSuccess}
        </p>
      ) : null}
      {hooksPanelMode === 'add' || hooksPanelMode === 'edit' ? (
        <div className="space-y-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3">
          {hooksPanelMode === 'edit' ? (
            <p className="rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-[11px] text-stone-400">
              {translate("chat.editing")}{' '}
              {hookEventJsonKey(editingHookTarget?.eventName ?? hookEventName)}{' '}
              {translate("chat.in")} {editingHookTarget?.scope === 'global' ? translate("chat.global") : translate("chat.project")}{' '}
              hooks.json
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-stone-400">
              {translate("chat.scope")}<select
                aria-label={translate("chat.hookScope")}
                value={hookScope}
                onChange={(event) => onSetHookScope(event.target.value as HookScope)}
                disabled={hooksPanelMode === 'edit'}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              >
                <option value="project">{translate("chat.project_f6f4da")}</option>
                <option value="global">{translate("chat.global_5f1184")}</option>
              </select>
            </label>
            <label className="block text-xs text-stone-400">
              {translate("chat.event")}<select
                aria-label={translate("chat.hookEvent")}
                value={hookEventName}
                onChange={(event) =>
                  onSetHookEventName(event.target.value as AgentHookEventNameDto)
                }
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              >
                {HOOK_EVENT_OPTIONS.map((eventOption) => (
                  <option key={eventOption.value} value={eventOption.value}>
                    {eventOption.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-400">
              {translate("chat.matcher")}</label>
            <input
              aria-label={translate("chat.hookMatcher")}
              value={hookMatcher}
              onChange={(event) => onSetHookMatcher(event.target.value)}
              placeholder="Bash"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-400">
              {translate("chat.command")}</label>
            <textarea
              aria-label={translate("chat.hookCommand")}
              value={hookCommand}
              onChange={(event) => onSetHookCommand(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-stone-400">
              {translate("chat.timeout")}<input
                aria-label={translate("chat.hookTimeoutSeconds")}
                value={hookTimeoutSec}
                onChange={(event) => onSetHookTimeoutSec(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              />
            </label>
            <label className="block text-xs text-stone-400">
              {translate("chat.statusMessage")}<input
                aria-label={translate("chat.hookStatusMessage")}
                value={hookStatusMessage}
                onChange={(event) => onSetHookStatusMessage(event.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSetHooksPanelMode('list');
                onSetEditingHookTarget(null);
              }}
              className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition`}
            >
              {translate("chat.back")}</button>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void onSaveHook()}
                disabled={hookConfigBusy}
                className="ui-status-info rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {hookConfigBusy
                  ? translate("chat.saving")
                  : hooksPanelMode === 'edit'
                    ? translate("chat.updateHook")
                    : translate("chat.writeHook")}
              </button>
              {hookConfigError ? <ErrorMark message={hookConfigError} /> : null}
            </span>
          </div>
        </div>
      ) : null}
      {hooksPanelMode === 'list' && hooksState.data?.warnings.length ? (
        <div className="mb-2 space-y-2">
          {hooksState.data.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/85"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}
      {/* A config file that could not be read: its path, and why behind a mark. */}
      {hooksPanelMode === 'list' && hooksState.data?.errors.length ? (
        <div className="mb-2 space-y-2">
          {hooksState.data.errors.map((entry) => (
            <div
              key={`${entry.path}:${entry.message}`}
              className="flex items-center gap-1 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2 text-xs text-stone-400"
            >
              <p className="min-w-0 break-all">{entry.path}</p>
              <ErrorMark message={entry.message} />
            </div>
          ))}
        </div>
      ) : null}
      {hooksPanelMode === 'list' && hooksState.data?.hooks.length ? (
        <div className="space-y-2">
          {hooksState.data.hooks.map((hook) => (
            <div
              key={hook.key}
              className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-100">
                  {hookEventLabel(hook.eventName)}
                  {hook.matcher ? ` · ${hook.matcher}` : ''}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-stone-400">
                  {hook.command ?? hook.handlerType}
                </p>
                {hook.statusMessage ? (
                  <p className="mt-1 truncate text-[11px] text-stone-500">
                    {hook.statusMessage}
                  </p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-stone-500">
                {editableHookTarget(hook) ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEditingHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/10`}
                  >
                    {translate("chat.edit")}</button>
                ) : null}
                {hookTrustAvailable &&
                hook.trustStatus === 'trusted' &&
                !hook.isManaged ? (
                  <button
                    type="button"
                    disabled={hookConfigBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUntrustHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-100 transition hover:border-amber-300/35 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {translate("chat.untrust")}</button>
                ) : null}
                {(hook.trustStatus === 'untrusted' ||
                  hook.trustStatus === 'modified') &&
                !hook.isManaged &&
                hookTrustAvailable ? (
                  <button
                    type="button"
                    disabled={hookConfigBusy || !hook.currentHash}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onTrustHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {translate("chat.trust")}</button>
                ) : null}
                <span className="rounded-full border border-stone-700 px-2 py-0.5 text-stone-300">
                  {hookTrustLabel(hook.trustStatus)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hookSourceLabel(hook.source)}
                </span>
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hook.enabled ? translate("chat.enabled") : translate("chat.disabled")}
                </span>
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hook.timeoutSec}{translate("chat.s")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {hooksPanelMode === 'list' &&
      hooksState.status !== 'loading' &&
      !hooksState.error &&
      (hooksState.data?.hooks.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          {translate("chat.noHooksConfiguredForThisWorkspace")}</p>
      ) : null}
    </div>
  );
}
