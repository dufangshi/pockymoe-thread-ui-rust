import { usePhoneDock } from '../workbench/phoneDockContext';
import { useAppShellNav } from '../../app-shell/AppShellNavContext';
import { useEffect, type DragEvent, type FormEvent, type MutableRefObject, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { translate } from '../../i18n';

import type { AgentSubscriptionUsageDto, PromptAttachmentKindDto } from '@pockymoe/shared';
import { useCompactComposer } from './useCompactComposer';
import { InputGroup } from '../graph-ui/InputGroup';
import { ErrorMark } from '../copy/ErrorMark';
import { ComposerHiddenAttachmentInputs } from './ComposerHiddenAttachmentInputs';
import { ComposerJumpLatestButton } from './ComposerJumpLatestButton';
import { ComposerSubscriptionUsage, visibleSubscriptionWindows } from './ComposerSubscriptionUsage';

export interface ComposerFrameProps {
  activeView: 'chat' | 'shell';
  /** Theme avatar key of the thread's harness; presentation only. */
  agent?: string | undefined;
  busy?: boolean;
  layerClassName: string;
  formClassName: string;
  shellClassName: string;
  inputGroupClassName: string;
  error: string | null | undefined;
  followTail: boolean;
  photoInputRef: MutableRefObject<HTMLInputElement | null>;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onAppendAttachments: (
    files: FileList | null,
    kind: PromptAttachmentKindDto,
  ) => void;
  onToggleFollow?: () => void;
  canJumpToPreviousTurn?: boolean;
  onJumpToPreviousTurn?: () => void;
  canJumpToNextTurn?: boolean;
  onJumpToNextTurn?: () => void;
  subscriptionUsage?: AgentSubscriptionUsageDto | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formRef: MutableRefObject<HTMLFormElement | null>;
  promptSlot: ReactNode;
  pendingQueueSlot?: ReactNode;
  /** Small marks above the composer's corner, beside its failure mark. */
  cornerSlot?: ReactNode;
  toolbarSlot: ReactNode;
  goalSlot: ReactNode;
  shellPromptSlot: ReactNode;
  /** Files dragged over the composer: the whole frame is the drop target. */
  drop?: {
    active: boolean;
    onDragEnter: (event: DragEvent<HTMLFormElement>) => void;
    onDragOver: (event: DragEvent<HTMLFormElement>) => void;
    onDragLeave: (event: DragEvent<HTMLFormElement>) => void;
    onDrop: (event: DragEvent<HTMLFormElement>) => void;
  } | undefined;
}

function hasFiles(event: globalThis.DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function ComposerFrame({
  activeView,
  agent,
  busy = false,
  layerClassName,
  formClassName,
  shellClassName,
  inputGroupClassName,
  error,
  followTail,
  photoInputRef,
  fileInputRef,
  onAppendAttachments,
  onToggleFollow,
  canJumpToPreviousTurn,
  onJumpToPreviousTurn,
  canJumpToNextTurn,
  onJumpToNextTurn,
  subscriptionUsage,
  onSubmit,
  formRef,
  promptSlot,
  pendingQueueSlot,
  cornerSlot,
  toolbarSlot,
  goalSlot,
  shellPromptSlot,
  drop,
}: ComposerFrameProps) {
  const dropEnabled = Boolean(drop);
  useEffect(() => {
    // A file dropped beside the composer must not replace the app with the
    // file. Whatever accepted the drop (the composer, the file explorer) has
    // already called preventDefault; nothing else takes it.
    if (!dropEnabled) return;
    const over = (event: globalThis.DragEvent) => {
      if (event.defaultPrevented || !hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };
    const dropped = (event: globalThis.DragEvent) => {
      if (!event.defaultPrevented && hasFiles(event)) event.preventDefault();
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', dropped);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', dropped);
    };
  }, [dropEnabled]);
  const { expanded, focusOwner, ...focusEvents } = useCompactComposer(formRef, activeView === 'chat');
  // The phone dock's status bar shows usage instead.
  const dock = usePhoneDock();
  const phoneHand = useAppShellNav()?.phoneHand;
  const leftHanded = Boolean(dock) && phoneHand === 'left';
  const usage = !dock && activeView === 'chat' && visibleSubscriptionWindows(subscriptionUsage).length > 0
    ? <ComposerSubscriptionUsage usage={subscriptionUsage} />
    : null;
  return (
    <div className={layerClassName}>
      <ComposerHiddenAttachmentInputs
        photoInputRef={photoInputRef}
        fileInputRef={fileInputRef}
        onAppendAttachments={onAppendAttachments}
      />
      <ComposerJumpLatestButton
        activeView={activeView}
        followTail={followTail}
        onToggleFollow={onToggleFollow}
        canJumpToPreviousTurn={canJumpToPreviousTurn}
        onJumpToPreviousTurn={onJumpToPreviousTurn}
        canJumpToNextTurn={canJumpToNextTurn}
        onJumpToNextTurn={onJumpToNextTurn}
      />

      {pendingQueueSlot}

      {/* The last failure is a quiet mark above the composer, across from the
          turn navigation (which a left-handed phone dock moves to the left), so
          nothing moves. It stays outside the form: pressing it must not open the
          composer (and a phone's keyboard). */}
      {error || cornerSlot ? (
        <div className={`thread-composer-error-tag pointer-events-none absolute top-0 z-[90] flex h-11 -translate-y-full items-center gap-1.5 sm:h-10 ${leftHanded ? 'right-0 flex-row-reverse pr-3' : 'left-0 pl-3 sm:pl-5'}`}>
          {error ? (
            <span className="pointer-events-auto inline-flex rounded-full bg-[var(--theme-panel)]">
              <ErrorMark message={error} />
            </span>
          ) : null}
          {/* Small standing notes, such as the wakes this agent waits for. */}
          {cornerSlot ? <span className="pointer-events-auto inline-flex">{cornerSlot}</span> : null}
        </div>
      ) : null}

      <form
        ref={formRef}
        {...focusEvents}
        data-composer-focus-owner={focusOwner}
        data-agent={agent}
        data-composer-busy={busy ? 'true' : undefined}
        data-composer-layout={activeView === 'chat' ? (expanded ? 'expanded' : 'collapsed') : undefined}
        data-testid={activeView === 'chat' ? 'chat-composer' : undefined}
        data-drop-target={drop?.active ? 'true' : undefined}
        {...(drop ? { onDragEnter: drop.onDragEnter, onDragOver: drop.onDragOver, onDragLeave: drop.onDragLeave, onDrop: drop.onDrop } : {})}
        onSubmit={onSubmit}
        className={formClassName}
      >
        <div
          className={`${shellClassName} relative flex w-full flex-col overflow-visible rounded-[16px] sm:rounded-[18px]`}
        >
          <InputGroup className={inputGroupClassName}>
            {promptSlot}
            {toolbarSlot}
          </InputGroup>

          {goalSlot}
          {shellPromptSlot}
          {drop?.active ? (
            <div className="composer-drop-hint" aria-hidden="true">
              <Download className="h-4 w-4" />
              {translate('chat.dropToAttach')}
            </div>
          ) : null}
          {usage ? <div className="thread-composer-usage-tag">{usage}</div> : null}
        </div>
      </form>
    </div>
  );
}
