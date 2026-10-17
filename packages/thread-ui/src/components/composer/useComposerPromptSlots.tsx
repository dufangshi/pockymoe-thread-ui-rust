import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  RefObject,
} from 'react';

import { ComposerGoalComposeCard } from './ComposerGoalComposeCard';
import { ComposerModeChip } from './ComposerModeChip';
import { ComposerPromptEditor } from './ComposerPromptEditor';
import { ComposerShellPromptInput } from './ComposerShellPromptInput';

export interface UseComposerPromptSlotsInput {
  isShellView: boolean;
  promptRef: RefObject<HTMLDivElement | null>;
  prompt: string;
  disabled: boolean;
  promptPlaceholder: string;
  promptPlaceholderHint?: string;
  canInterrupt: boolean;
  interruptLabel: string;
  composerPromptRegionClassName: string;
  graphChatInputClassName: string;
  promptInputClassName: string;
  goalComposeMode: boolean;
  /** Plan mode is on: a chip above the prompt says so and turns it off. */
  planMode?: boolean;
  settingsBusy?: boolean;
  onExitPlanMode?: () => void;
  goalTokenBudget: string;
  goalLocalError: string | null;
  goalBusy: boolean;
  busy: boolean;
  sendButtonLabel: string;
  sendButtonClassName: string;
  onInterrupt?: () => Promise<void> | void;
  onPromptInput: () => void;
  onPromptPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPromptKeyUp: () => void;
  onPromptMouseUp: () => void;
  onPromptBlur: () => void;
  onPromptDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onPromptDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onPromptDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onPromptDrop: (event: DragEvent<HTMLDivElement>) => void;
  onGoalTokenBudgetChange: (value: string) => void;
  onCancelGoal: () => void;
  onShellPromptChange: (value: string) => void;
}

export function useComposerPromptSlots({
  isShellView,
  promptRef,
  prompt,
  disabled,
  promptPlaceholder,
  promptPlaceholderHint = '',
  canInterrupt,
  interruptLabel,
  composerPromptRegionClassName,
  graphChatInputClassName,
  promptInputClassName,
  goalComposeMode,
  planMode = false,
  settingsBusy = false,
  onExitPlanMode,
  goalTokenBudget,
  goalLocalError,
  goalBusy,
  busy,
  sendButtonLabel,
  sendButtonClassName,
  onInterrupt,
  onPromptInput,
  onPromptPaste,
  onPromptKeyDown,
  onPromptKeyUp,
  onPromptMouseUp,
  onPromptBlur,
  onPromptDragEnter,
  onPromptDragOver,
  onPromptDragLeave,
  onPromptDrop,
  onGoalTokenBudgetChange,
  onCancelGoal,
  onShellPromptChange,
}: UseComposerPromptSlotsInput) {
  return {
    promptSlot: !isShellView ? (
      <ComposerPromptEditor
        promptRef={promptRef}
        prompt={prompt}
        disabled={disabled}
        promptPlaceholder={promptPlaceholder}
        promptPlaceholderHint={promptPlaceholderHint}
        canInterrupt={canInterrupt}
        interruptLabel={interruptLabel}
        composerPromptRegionClassName={composerPromptRegionClassName}
        graphChatInputClassName={graphChatInputClassName}
        onInterrupt={onInterrupt}
        onInput={onPromptInput}
        onPaste={onPromptPaste}
        onKeyDown={onPromptKeyDown}
        onKeyUp={onPromptKeyUp}
        onMouseUp={onPromptMouseUp}
        onBlur={onPromptBlur}
        onDragEnter={onPromptDragEnter}
        onDragOver={onPromptDragOver}
        onDragLeave={onPromptDragLeave}
        onDrop={onPromptDrop}
      />
    ) : null,
    goalSlot: goalComposeMode && !isShellView ? (
      <ComposerGoalComposeCard
        tokenBudget={goalTokenBudget}
        error={goalLocalError}
        onTokenBudgetChange={onGoalTokenBudgetChange}
        onCancel={onCancelGoal}
      />
    ) : planMode && !isShellView && onExitPlanMode ? (
      <ComposerModeChip busy={settingsBusy} onExit={onExitPlanMode} />
    ) : null,
    shellPromptSlot: isShellView ? (
      <ComposerShellPromptInput
        prompt={prompt}
        promptPlaceholder={promptPlaceholder}
        promptRegionClassName={composerPromptRegionClassName}
        promptInputClassName={promptInputClassName}
        interruptLabel={interruptLabel}
        canInterrupt={canInterrupt}
        sendButtonLabel={sendButtonLabel}
        sendButtonClassName={sendButtonClassName}
        sendDisabled={goalBusy || busy}
        onPromptChange={onShellPromptChange}
        onPromptKeyDown={
          onPromptKeyDown as unknown as (
            event: KeyboardEvent<HTMLTextAreaElement>,
          ) => void
        }
        onInterrupt={onInterrupt}
      />
    ) : null,
  };
}
