import { translate, useI18n } from '../../i18n';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';

import type { ThreadShellControlState } from '../../types';
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from '../graph-ui/InputGroup';
import {
  ChatIcon,
  TerminalIcon,
  WrenchScrewdriverIcon,
} from './composerPresentation';
import { ComposerAttachmentMenu } from './ComposerAttachmentMenu';
import { ComposerSettingsToolbar } from './ComposerSettingsToolbar';
import { ComposerShellToolsPanel } from './ComposerShellToolsPanel';
import { ComposerSlashToolboxMenu } from './ComposerSlashToolboxMenu';
import type { SettingsMenu } from './types';

export type ComposerSlashToolboxProps = ComponentProps<
  typeof ComposerSlashToolboxMenu
>;
export type ComposerAttachmentMenuProps = ComponentProps<
  typeof ComposerAttachmentMenu
>;
export type ComposerSettingsToolbarProps = ComponentProps<
  typeof ComposerSettingsToolbar
>;
export type ComposerShellToolsPanelProps = ComponentProps<
  typeof ComposerShellToolsPanel
>;

export interface ComposerToolbarProps {
  canInterrupt?: boolean;
  interruptLabel?: string;
  onInterrupt?: (() => Promise<void> | void) | undefined;
  isShellView: boolean;
  canToggleShellView: boolean;
  isMobileShell: boolean;
  shellPromptLabel: string | null;
  openMenu: SettingsMenu;
  toolbarClassName: string;
  iconButtonClassName: string;
  slashToolboxProps: ComposerSlashToolboxProps | null;
  attachmentMenuProps: ComposerAttachmentMenuProps | null;
  settingsToolbarProps: ComposerSettingsToolbarProps | null;
  shellToolsPanelProps: ComposerShellToolsPanelProps | null;
  shellControlState: ThreadShellControlState | null;
  onToggleView?: () => void;
  onDismissPromptFocus: () => void;
  onSetOpenMenu: Dispatch<SetStateAction<SettingsMenu>>;
}

export function ComposerToolbar({
  canInterrupt = false,
  interruptLabel,
  onInterrupt,
  isShellView,
  canToggleShellView,
  isMobileShell,
  shellPromptLabel,
  openMenu,
  toolbarClassName,
  iconButtonClassName,
  slashToolboxProps,
  attachmentMenuProps,
  settingsToolbarProps,
  shellToolsPanelProps,
  onToggleView,
  onDismissPromptFocus,
  onSetOpenMenu,
}: ComposerToolbarProps) {
  useI18n();
  return (
    <InputGroupAddon
      align="block-end"
      className={`${toolbarClassName} relative z-[100] mb-0 flex items-center gap-2 text-xs`}
    >
      <div className="composer-tools flex shrink-0 items-center gap-1.5">
        {!isShellView && slashToolboxProps ? (
          <ComposerSlashToolboxMenu {...slashToolboxProps} />
        ) : null}

        {!isShellView && attachmentMenuProps ? (
          <ComposerAttachmentMenu {...attachmentMenuProps} />
        ) : null}

        {canToggleShellView && (
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            data-action={isShellView ? "switch-to-chat" : "switch-to-shell"}
            aria-label={isShellView ? translate("chat.switchToChat") : translate("chat.switchToShell")}
            title={isShellView ? translate("chat.switchToChat") : translate("chat.switchToShell")}
            onClick={() => onToggleView?.()}
            className={`${iconButtonClassName} h-9 w-9 rounded-full sm:h-8 sm:w-8`}
          >
            {isShellView ? <ChatIcon /> : <TerminalIcon />}
          </InputGroupButton>
        )}
      </div>

      <div className="composer-settings flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
        {!isShellView && settingsToolbarProps ? (
          <ComposerSettingsToolbar {...settingsToolbarProps} queueing={canInterrupt} beforeSend={canInterrupt ? (
            <InputGroupButton
              type="button" variant="ghost" size="icon-xs"
              aria-label={interruptLabel} title={interruptLabel}
              onClick={event => { event.preventDefault(); void onInterrupt?.(); }}
              className="thread-graph-composer-stop-button ui-action-danger h-8 w-8 shrink-0 rounded-full"
            >
              <span aria-hidden="true" className="block h-2.5 w-2.5 rounded-[2px] bg-current" />
            </InputGroupButton>
          ) : null} />
        ) : null}

        {isShellView && shellPromptLabel ? (
          <InputGroupText
            className="min-w-0 max-w-[12rem] truncate rounded-full px-1.5 py-1 text-stone-400"
            title={shellPromptLabel}
          >
            {shellPromptLabel}
          </InputGroupText>
        ) : null}

        {isMobileShell && (
          <div className="relative">
            <button
              type="button"
              data-composer-menu-trigger="true"
              aria-label={
                openMenu === 'shellTools'
                  ? translate("chat.closeShellTools")
                  : translate("chat.openShellTools")
              }
              aria-haspopup="menu"
              aria-expanded={openMenu === 'shellTools'}
              title={
                openMenu === 'shellTools'
                  ? translate("chat.closeShellTools")
                  : translate("chat.openShellTools")
              }
              onClick={() => {
                onDismissPromptFocus();
                onSetOpenMenu((current) =>
                  current === 'shellTools' ? null : 'shellTools',
                );
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-700 bg-stone-900/92 text-stone-200 transition hover:bg-stone-800"
            >
              <WrenchScrewdriverIcon />
            </button>
            {openMenu === 'shellTools' && shellToolsPanelProps ? (
              <ComposerShellToolsPanel {...shellToolsPanelProps} />
            ) : null}
          </div>
        )}
      </div>
    </InputGroupAddon>
  );
}
