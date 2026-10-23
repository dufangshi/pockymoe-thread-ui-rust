import { usePhoneDock } from '../workbench/phoneDockContext';
import { useAppShellNav } from '../../app-shell/AppShellNavContext';
import type {
  FormEvent,
  MutableRefObject,
  ReactNode,
} from 'react';

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
}: ComposerFrameProps) {
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
          {usage ? <div className="thread-composer-usage-tag">{usage}</div> : null}
        </div>
      </form>
    </div>
  );
}
