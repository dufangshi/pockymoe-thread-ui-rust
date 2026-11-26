import { translate, useI18n } from '../../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ComposerModelSwitching } from './modelPicker/modelPickerLogic';
import type { SlashPanelView } from './types';

export interface UseComposerForkActionsInput {
  slashPanelView: SlashPanelView;
  onForkLatest?: () => Promise<void> | void;
  onForkTurn?: (turnId: string) => Promise<void> | void;
  /** Forking into another agent (the fork panel's agent row). */
  switching?: ComposerModelSwitching | undefined;
  /** The current agent can fork natively; otherwise only another agent can. */
  nativeFork?: boolean;
  closeMenu: () => void;
}

export interface UseComposerForkActionsResult {
  forkBusy: boolean;
  forkError: string | null;
  forkLatest: () => Promise<void>;
  forkTurn: (turnId: string) => Promise<void>;
  /** The agent the fork panel forks into. */
  forkAgentId: string | null;
  setForkAgentId: (agentId: string) => void;
}

export function useComposerForkActions({
  slashPanelView,
  onForkLatest,
  onForkTurn,
  switching,
  nativeFork = true,
  closeMenu,
}: UseComposerForkActionsInput): UseComposerForkActionsResult {
  useI18n();
  const [forkBusy, setForkBusy] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const crossFork = switching?.fork && switching.agents.length > 1 ? switching : undefined;
  const currentAgentId = crossFork?.currentAgentId ?? null;
  // The current agent when it forks natively, else the first one that can take a fork.
  const fallbackAgent = crossFork
    ? nativeFork ? crossFork.currentAgentId : crossFork.agents.find((agent) => agent.id !== crossFork.currentAgentId)?.id ?? null
    : null;
  const [chosenAgent, setForkAgentId] = useState<string | null>(null);
  const forkAgentId = crossFork && chosenAgent && crossFork.agents.some((agent) => agent.id === chosenAgent) && (nativeFork || chosenAgent !== currentAgentId)
    ? chosenAgent
    : fallbackAgent;
  const foreign = crossFork && forkAgentId && forkAgentId !== currentAgentId ? forkAgentId : null;

  useEffect(() => {
    setForkError(null);
    // Leaving the fork panels forgets the agent chosen there.
    if (slashPanelView !== 'fork' && slashPanelView !== 'forkTurns') setForkAgentId(null);
  }, [slashPanelView]);

  const forkLatest = useCallback(async () => {
    if (inFlight.current) return;
    const run = foreign ? () => crossFork!.fork!({ agentId: foreign, turnId: null }) : onForkLatest;
    if (!run) {
      setForkError(translate("chat.forkIsUnavailableForThisThreadReload"));
      return;
    }

    inFlight.current = true;
    setForkError(null);
    setForkBusy(true);
    try {
      await run();
      closeMenu();
    } catch (error) {
      setForkError(error instanceof Error ? error.message : translate("chat.unableToForkThisThreadPleaseTry"));
    } finally {
      inFlight.current = false;
      setForkBusy(false);
    }
  }, [closeMenu, onForkLatest, foreign, crossFork]);

  const forkTurn = useCallback(
    async (turnId: string) => {
      if (inFlight.current) return;
      const run = foreign ? (turn: string) => crossFork!.fork!({ agentId: foreign, turnId: turn }) : onForkTurn;
      if (!run) {
        setForkError(translate("chat.forkIsUnavailableForThisThreadReload"));
        return;
      }

      inFlight.current = true;
      setForkError(null);
      setForkBusy(true);
      try {
        await run(turnId);
        closeMenu();
      } catch (error) {
        setForkError(error instanceof Error ? error.message : translate("chat.unableToForkThisTurnPleaseTry"));
      } finally {
        inFlight.current = false;
        setForkBusy(false);
      }
    },
    [closeMenu, onForkTurn, foreign, crossFork],
  );

  return {
    forkBusy,
    forkError,
    forkLatest,
    forkTurn,
    forkAgentId,
    setForkAgentId,
  };
}
