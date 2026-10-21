import { useCallback, useEffect, useState } from 'react';

import type {
  CollaborationModeDto,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';
import { deriveComposerSettingsUpdateDecision } from './composerUtils';

export interface UseComposerSettingsActionsInput {
  collaborationMode: CollaborationModeDto;
  onUpdateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
  closeMenu: () => void;
}

export interface UseComposerSettingsActionsResult {
  displayedCollaborationMode: CollaborationModeDto;
  updateSettings: (input: UpdateThreadSettingsInput) => Promise<void>;
}

export function useComposerSettingsActions({
  collaborationMode,
  onUpdateSettings,
  closeMenu,
}: UseComposerSettingsActionsInput): UseComposerSettingsActionsResult {
  const [optimisticCollaborationMode, setOptimisticCollaborationMode] =
    useState<CollaborationModeDto | null>(null);
  const displayedCollaborationMode =
    optimisticCollaborationMode ?? collaborationMode;

  useEffect(() => {
    setOptimisticCollaborationMode(null);
  }, [collaborationMode]);

  const updateSettings = useCallback(
    async (input: UpdateThreadSettingsInput) => {
      const settingsUpdateDecision = deriveComposerSettingsUpdateDecision({
        nextMode: input.collaborationMode,
        previousOptimisticMode: optimisticCollaborationMode,
        changed: Object.keys(input).filter((key) => input[key as keyof UpdateThreadSettingsInput] !== undefined),
      });
      if (settingsUpdateDecision.optimisticMode) {
        setOptimisticCollaborationMode(settingsUpdateDecision.optimisticMode);
      }
      try {
        await onUpdateSettings?.(input);
        if (settingsUpdateDecision.closeMenuOnSuccess) {
          closeMenu();
        }
      } catch (error) {
        if (settingsUpdateDecision.shouldRollbackMode) {
          setOptimisticCollaborationMode(settingsUpdateDecision.rollbackMode);
        }
        throw error;
      }
    },
    [closeMenu, onUpdateSettings, optimisticCollaborationMode],
  );

  return {
    displayedCollaborationMode,
    updateSettings,
  };
}
