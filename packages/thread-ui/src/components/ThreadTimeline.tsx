import { translate, useI18n } from '../i18n';
import { mergeThreadHistoryItem } from '@pockymoe/shared';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  RespondThreadActionRequestInput,
  ThreadActionRequestDto,
  ThreadActivityNoteDto,
  ThreadAnsweredRequestNoteDto,
  ThreadHistoryItemDetailDto,
  ThreadHistoryItemDto,
  ThreadPendingSteerDto,
  ThreadTurnDto,
} from '@pockymoe/shared';
import { useAppShellNav } from '../app-shell/AppShellNavContext';
import { LongTextDialog } from './LongTextDialog';
import { PeerWorkGroup } from './timeline/PeerWorkGroup';
import { aggregatePeerWorkTurn, groupPeerWorkTurns, peerWorkForTurn, peerWorkPreview } from './timeline/peerWork';
import type { ThreadTimelineAdapter } from '../adapters';
import { GraphChatCompactMessageItem as CompactMessageItem } from './graph-chat/GraphChatCompactMessageItem';
import {
  isRunningHistoryStatus,
  countTurnSteps,
  parseHookPromptText,
  type TimelineTurn,
} from './timeline/timelineItems';
import {
  buildActivityNoteAnchors,
  buildRequestEntryAnchors,
} from './timeline/timelineAnchors';
import {
  ActivityNoteSection,
  ActivityRequestEntrySection,
  RequestEntrySection,
  RequestEntrySectionForTurn,
} from './timeline/TimelineRequestCards';
import {
  HistoryItemRow,
  ThreadTurnRow,
} from './timeline/TimelineTurnRows';
import {
  buildSyntheticLiveTurn,
} from './timeline/timelineScroll';
import { useDeferredHistoryDetail } from './timeline/useDeferredHistoryDetail';
import { useTimelineScroll } from './timeline/useTimelineScroll';
import { TranscriptLogContext, type TranscriptLogActions } from './timeline/TranscriptLog';
import { ThreadLinkContext } from './graph-chat/PromptEnvelope';
import { ScrollAnchorContext } from './timeline/scrollAnchor';
import { storySegments } from './timeline/activity';

export interface ThreadTimelineProps {
  threadId?: string | undefined;
  turns: ThreadTurnDto[];
  totalTurnCount?: number;
  pendingRequests?: ThreadActionRequestDto[];
  activeTurnId?: string | null;
  threadRunning?: boolean;
  backgroundAgentCount?: number;
  backendProgress?: { turnId: string; receivedAt: string } | null;
  livePlan?: {
    turnId: string;
    explanation: string | null;
    plan: Array<{ step: string; status: string }>;
    updatedAt?: string | null;
  } | null;
  liveItems?: {
    turnId: string;
    items: ThreadHistoryItemDto[];
    updatedAt?: string | null;
  } | null;
  respondingRequestId?: string | null;
  onRespondToRequest?: (
    requestId: string,
    input: RespondThreadActionRequestInput,
  ) => Promise<void> | void;
  liveOutput: string;
  scrollRequestKey?: number;
  searchTarget?: { turnId: string; itemId: string; key: number };
  previousTurnScrollRequestKey?: number;
  nextTurnScrollRequestKey?: number;
  bottomSpacer?: number;
  className?: string;
  onTailVisibilityChange?: (isVisible: boolean) => void;
  onPreviousTurnAvailabilityChange?: (available: boolean) => void;
  onNextTurnAvailabilityChange?: (available: boolean) => void;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  ephemeralUserNote?: string | null;
  answeredRequestNotes?: ThreadAnsweredRequestNoteDto[];
  activityNotes?: ThreadActivityNoteDto[];
  pendingSteers?: ThreadPendingSteerDto[];
  optimisticSteers?: Array<{
    id: string;
    clientRequestId: string;
    turnId: string;
    prompt: string;
    createdAt: string;
    status: 'steering' | 'accepted';
  }>;
  optimisticTurn?: TimelineTurn | null;
  onLoadHistoryItemDetail?: (
    itemId: string,
  ) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
  onLoadTurnDetail?: (
    turnId: string,
  ) => Promise<ThreadTurnDto> | ThreadTurnDto;
  onOpenThread?: (threadId: string) => void;
  onSelectArtifact?: (input: {
    item: ThreadHistoryItemDto & { kind: 'artifact' };
    artifact: NonNullable<ThreadHistoryItemDto['artifact']>;
  }) => void;
  onSelectHistoryItemDetail?: (input: {
    item: ThreadHistoryItemDto;
    detail: ThreadHistoryItemDetailDto;
  }) => void;
  adapter?: ThreadTimelineAdapter | undefined;
  autoCollapseCompletedTurns?: boolean;
}

function isTerminalTurnStatus(status: TimelineTurn['status']) {
  return status === 'completed' || status === 'failed' || status === 'interrupted';
}

function latestTimestamp(...timestamps: Array<string | null | undefined>) {
  let latest: { timestamp: string; millis: number } | null = null;
  for (const timestamp of timestamps) {
    if (!timestamp) {
      continue;
    }
    const millis = Date.parse(timestamp);
    if (Number.isFinite(millis) && (!latest || millis > latest.millis)) {
      latest = { timestamp, millis };
    }
  }
  return latest?.timestamp ?? null;
}

function mergeOptimisticTurnItems(
  turn: TimelineTurn,
  optimisticTurn: TimelineTurn | null,
) {
  if (!optimisticTurn || optimisticTurn.id !== turn.id || optimisticTurn.items.length === 0) {
    return turn;
  }

  const materializedItemIds = new Set(turn.items.map((item) => item.id));
  const optimisticOnlyItems = optimisticTurn.items.filter(
    (item) => !materializedItemIds.has(item.id),
  );

  if (optimisticOnlyItems.length === 0) {
    return turn;
  }

  return {
    ...turn,
    items: [...optimisticOnlyItems, ...turn.items],
  };
}

/**
 * Turns a reader folded or opened, per thread, for as long as the page lives: a
 * timeline that mounts again (another thread and back, a view that reloads) shows
 * them as they were instead of falling back to the defaults.
 */
const foldChoices = new Map<string, Record<string, boolean>>();
const FOLD_CHOICE_THREADS = 40;
function rememberFoldChoices(threadId: string, choices: Record<string, boolean>) {
  foldChoices.delete(threadId);
  foldChoices.set(threadId, choices);
  while (foldChoices.size > FOLD_CHOICE_THREADS) foldChoices.delete(foldChoices.keys().next().value!);
}
type FoldChoicesUpdate = Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>);

function ThreadTimelineComponent({
  threadId,
  turns,
  totalTurnCount,
  pendingRequests = [],
  activeTurnId = null,
  threadRunning = false,
  backgroundAgentCount = 0,
  pendingSteers = [],
  livePlan = null,
  liveItems = null,
  backendProgress = null,
  respondingRequestId = null,
  onRespondToRequest,
  liveOutput,
  scrollRequestKey = 0,
  searchTarget,
  previousTurnScrollRequestKey = 0,
  nextTurnScrollRequestKey = 0,
  bottomSpacer = 0,
  className = '',
  onTailVisibilityChange,
  onPreviousTurnAvailabilityChange,
  onNextTurnAvailabilityChange,
  loadingEarlier = false,
  onLoadEarlier,
  ephemeralUserNote = null,
  answeredRequestNotes = [],
  activityNotes = [],
  optimisticSteers = [],
  optimisticTurn = null,
  onLoadHistoryItemDetail,
  onLoadTurnDetail,
  onOpenThread,
  onSelectArtifact,
  onSelectHistoryItemDetail,
  adapter,
  autoCollapseCompletedTurns,
}: ThreadTimelineProps) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  const effectiveAutoCollapseCompletedTurns =
    autoCollapseCompletedTurns ??
    shellNav?.autoCollapseCompletedTurns ??
    false;
  // The reader's choices belong to one thread; another thread starts from its own.
  const [folds, setFolds] = useState(() => ({ threadId, choices: (threadId && foldChoices.get(threadId)) || {} }));
  const foldThreadRef = useRef(threadId);
  foldThreadRef.current = threadId;
  const collapsedTurnOverrides = useMemo(
    () => (folds.threadId === threadId ? folds.choices : (threadId && foldChoices.get(threadId)) || {}),
    [folds, threadId],
  );
  const setCollapsedTurnOverrides = useCallback((update: FoldChoicesUpdate) => {
    setFolds(current => {
      const owner = foldThreadRef.current;
      const base = current.threadId === owner ? current.choices : (owner && foldChoices.get(owner)) || {};
      const choices = typeof update === 'function' ? update(base) : update;
      if (owner) rememberFoldChoices(owner, choices);
      return { threadId: owner, choices };
    });
  }, []);
  const [cancelingSteerIds, setCancelingSteerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const navigationTargetRef = useRef<string | null>(null);
  const pendingPreviousNavigationRef = useRef(false);
  const navigationResetRef = useRef({ threadId, scrollRequestKey, searchKey: searchTarget?.key });
  const handledNavigationRef = useRef({ previous: previousTurnScrollRequestKey, next: nextTurnScrollRequestKey });
  const lastSearchKeyRef = useRef<number | null>(null);
  const loadHistoryItemDetail =
    adapter?.onLoadHistoryItemDetail ?? onLoadHistoryItemDetail;
  const loadTurnDetail = adapter?.onLoadTurnDetail ?? onLoadTurnDetail;
  const [loadedTurnDetails, setLoadedTurnDetails] = useState<
    Record<string, ThreadTurnDto>
  >({});
  const [loadingTurnDetailIds, setLoadingTurnDetailIds] = useState<Set<string>>(
    () => new Set(),
  );
  // A turn's last live operations outlive it until its summary carries them,
  // so its work folds into the work line instead of vanishing first.
  const [endedLiveItems, setEndedLiveItems] = useState<{ turnId: string; items: ThreadHistoryItemDto[] } | null>(null);
  if (liveItems?.items.length && endedLiveItems?.items !== liveItems.items) {
    setEndedLiveItems({ turnId: liveItems.turnId, items: liveItems.items });
  }
  const [turnDetailErrors, setTurnDetailErrors] = useState<
    Record<string, string | undefined>
  >({});
  const openLinkedThread = adapter?.onOpenLinkedThread;
  // A search result opens its turn once; folding it again afterwards sticks, even
  // while a running thread keeps refreshing its turns.
  const openedSearchKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!searchTarget || openedSearchKeyRef.current === searchTarget.key || !turns.some(turn => turn.id === searchTarget.turnId)) return;
    openedSearchKeyRef.current = searchTarget.key;
    const parent = groupPeerWorkTurns(turns).find(group => group.continuations.some(turn => turn.id === searchTarget.turnId));
    setCollapsedTurnOverrides(current => ({ ...current, [searchTarget.turnId]: false, ...(parent ? { [parent.turn.id]: false } : {}) }));
  }, [searchTarget, turns, setCollapsedTurnOverrides]);
  const {
    expandedText,
    openExpandedText: handleOpenExpandedText,
    openCommandDetail: handleOpenCommandDetail,
    openToolCallDetail: handleOpenToolCallDetail,
    openDeferredHistoryItemDetail: handleOpenDeferredHistoryItemDetail,
    closeExpandedText,
  } = useDeferredHistoryDetail({
    loadHistoryItemDetail,
    onSelectHistoryItemDetail,
  });
  const {
    scrollContainerRef,
    scrollContentRef,
    tailSentinelRef,
    topSentinelRef,
    handleScroll,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    preserveScrollPositionForResize,
    holdAnchorNow,
    releaseAnchor,
    serverManagedHistory,
    effectiveTotalTurnCount,
    startIndex,
    visibleTurnAbsoluteOffset,
    hiddenCount,
    loadedHiddenCount,
    unloadedHiddenCount,
    showLoadAll,
    handleLoadEarlierClick,
    handleLoadAllClick,
  } = useTimelineScroll({
    threadId,
    turnsLength: turns.length,
    totalTurnCount,
    loadingEarlier,
    onLoadEarlier,
    scrollRequestKey,
    bottomSpacer,
    onTailVisibilityChange,
    contentRevisionInputs: [
      turns,
      pendingRequests,
      pendingSteers,
      optimisticSteers,
      liveOutput,
      livePlan,
      liveItems,
      optimisticTurn,
      answeredRequestNotes,
      activityNotes,
      ephemeralUserNote,
      bottomSpacer,
    ],
  });
  const transcriptLogActions = useMemo<TranscriptLogActions>(() => ({
    loadDetail: loadHistoryItemDetail,
    workspaceRoot: adapter?.workspaceRootPath,
    openText: handleOpenExpandedText,
    anchor: preserveScrollPositionForResize,
  }), [loadHistoryItemDetail, adapter?.workspaceRootPath, handleOpenExpandedText, preserveScrollPositionForResize]);
  const scrollAnchor = useMemo(() => ({ hold: holdAnchorNow }), [holdAnchorNow]);
  const openThreadLink = onOpenThread ?? adapter?.onOpenLinkedThread;
  const threadLinks = useMemo(() => ({
    ...(adapter?.getThreadHref ? { href: adapter.getThreadHref } : {}),
    ...(openThreadLink ? { open: openThreadLink } : {}),
  }), [adapter?.getThreadHref, openThreadLink]);
  useEffect(() => {
    // A composer floating over the transcript hides its bottom; sticky controls
    // (an opened message's "Show less") stop above it, and above the turn strip
    // on its top edge only where the strip is actually under them.
    const container = scrollContainerRef.current;
    const composer = container?.closest('.thread-graph-chat-panel')?.querySelector<HTMLElement>(':scope > .thread-graph-composer-host');
    if (!container || typeof ResizeObserver === 'undefined') return;
    const placeToggles = () => {
      const strip = composer?.querySelector<HTMLElement>('.thread-jump-nav')?.getBoundingClientRect();
      const bottom = container.getBoundingClientRect().bottom;
      for (const toggle of container.querySelectorAll<HTMLElement>('.thread-graph-show-more[aria-expanded="true"]')) {
        const box = toggle.getBoundingClientRect();
        if (strip && strip.width > 0 && box.left < strip.right && box.right > strip.left) {
          toggle.style.setProperty('--sticky-inset', `${Math.max(bottomSpacer, Math.round(bottom - strip.top))}px`);
        } else toggle.style.removeProperty('--sticky-inset');
      }
    };
    const measure = () => {
      const overlap = composer ? container.getBoundingClientRect().bottom - composer.getBoundingClientRect().top : 0;
      container.style.setProperty('--timeline-bottom-inset', `${Math.max(bottomSpacer, Math.round(overlap))}px`);
      placeToggles();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (composer) observer.observe(composer);
    // Opening a message, or switching hands (the strip changes sides).
    const toggles = new MutationObserver(placeToggles);
    toggles.observe(container, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
    const workbench = container.closest('.matter-workbench');
    if (workbench) toggles.observe(workbench, { attributes: true, attributeFilter: ['class'] });
    return () => { observer.disconnect(); toggles.disconnect(); };
  }, [bottomSpacer, scrollContainerRef]);



  useEffect(() => {
    setLoadedTurnDetails({});
    setEndedLiveItems(null);
    setLoadingTurnDetailIds(new Set());
    setTurnDetailErrors({});
  }, [threadId]);

  useEffect(() => {
    if (!searchTarget || lastSearchKeyRef.current === searchTarget.key || collapsedTurnOverrides[searchTarget.turnId] !== false) return;
    preserveScrollPositionForResize();
    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const turn = Array.from(container?.querySelectorAll<HTMLElement>('[data-turn-id]') ?? []).find(node => node.dataset.turnId === searchTarget.turnId);
      const message = Array.from(turn?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find(node => node.dataset.messageId === searchTarget.itemId);
      const target = message ?? turn;
      if (!container || !target) return;
      lastSearchKeyRef.current = searchTarget.key;
      container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 24, behavior: 'instant' });
      target.animate([{ backgroundColor: 'var(--theme-accent-soft)' }, { backgroundColor: 'transparent' }], { duration: 1400 });
    });
    return () => cancelAnimationFrame(frame);
  }, [searchTarget, collapsedTurnOverrides, preserveScrollPositionForResize]);

  const handleToggleCollapse = useCallback((
    turn: TimelineTurn,
    currentCollapsed: boolean,
    loadDetails = false,
  ) => {
    preserveScrollPositionForResize();
    // With turns kept open, a folded summary opens as its narration; only a run
    // the reader opens loads the turn's operations.
    if (currentCollapsed && !loadDetails && !effectiveAutoCollapseCompletedTurns && isTerminalTurnStatus(turn.status) && storySegments(turn)) {
      setCollapsedTurnOverrides((current) => ({ ...current, [turn.id]: false }));
      return;
    }
    if (
      !currentCollapsed ||
      (!turn.hasDeferredItems && !peerWorkForTurn(loadedTurnDetails[turn.id] ?? turn)?.messages.some(message => message.text === undefined)) ||
      !loadTurnDetail ||
      (loadedTurnDetails[turn.id] && isTerminalTurnStatus(loadedTurnDetails[turn.id]!.status)
        && loadedTurnDetails[turn.id]!.status === turn.status)
    ) {
      setCollapsedTurnOverrides((current) => ({
        ...current,
        [turn.id]: !currentCollapsed,
      }));
      return;
    }

    if (loadingTurnDetailIds.has(turn.id)) {
      return;
    }

    setLoadingTurnDetailIds((current) => new Set(current).add(turn.id));
    setTurnDetailErrors((current) => ({ ...current, [turn.id]: undefined }));
    void Promise.resolve(loadTurnDetail(turn.id))
      .then((loadedTurn) => {
        if (loadedTurn.id !== turn.id) {
          throw new Error(translate("chat.loadedTurnDetailDidNotMatchThe"));
        }
        setLoadedTurnDetails((current) => ({
          ...current,
          [turn.id]: loadedTurn,
        }));
        setCollapsedTurnOverrides((current) => ({
          ...current,
          [turn.id]: false,
        }));
      })
      .catch((caught: unknown) => {
        setTurnDetailErrors((current) => ({
          ...current,
          [turn.id]:
            caught instanceof Error
              ? caught.message
              : translate("chat.unableToLoadCompleteTurnHistory"),
        }));
      })
      .finally(() => {
        setLoadingTurnDetailIds((current) => {
          const next = new Set(current);
          next.delete(turn.id);
          return next;
        });
      });
  }, [effectiveAutoCollapseCompletedTurns, loadTurnDetail, loadedTurnDetails, loadingTurnDetailIds, preserveScrollPositionForResize, setCollapsedTurnOverrides]);

  useEffect(() => {
    if (!loadTurnDetail) return;
    // Finish an expanded live history with the authoritative final operation
    // states. Collapsed turns never trigger this additional request.
    for (const turn of turns) {
      const loaded = loadedTurnDetails[turn.id];
      if (collapsedTurnOverrides[turn.id] !== false || !loaded ||
          loaded.status !== 'inProgress' || !isTerminalTurnStatus(turn.status) ||
          loadingTurnDetailIds.has(turn.id) || turnDetailErrors[turn.id]) continue;
      setLoadingTurnDetailIds((current) => new Set(current).add(turn.id));
      void Promise.resolve().then(() => loadTurnDetail(turn.id)).then((detail) => {
        if (detail.id !== turn.id) throw new Error(translate("chat.loadedTurnDetailDidNotMatchThe"));
        setLoadedTurnDetails((current) => ({ ...current, [turn.id]: detail }));
      }).catch((error: unknown) => {
        setTurnDetailErrors((current) => ({ ...current, [turn.id]: error instanceof Error ? error.message : translate("chat.unableToLoadCompleteTurnHistory") }));
      }).finally(() => {
        setLoadingTurnDetailIds((current) => { const next = new Set(current); next.delete(turn.id); return next; });
      });
    }
  }, [turns, loadTurnDetail, loadedTurnDetails, collapsedTurnOverrides, loadingTurnDetailIds, turnDetailErrors]);

  useEffect(() => {
    if (!loadTurnDetail) return;
    // A working turn reads open, so it loads what its summary deferred, once.
    for (const turn of turns) {
      if (turn.status !== 'inProgress' || !turn.hasDeferredItems || collapsedTurnOverrides[turn.id] === true ||
          loadedTurnDetails[turn.id] || loadingTurnDetailIds.has(turn.id) || turnDetailErrors[turn.id]) continue;
      setLoadingTurnDetailIds((current) => new Set(current).add(turn.id));
      void Promise.resolve().then(() => loadTurnDetail(turn.id)).then((detail) => {
        if (detail.id !== turn.id) throw new Error(translate("chat.loadedTurnDetailDidNotMatchThe"));
        setLoadedTurnDetails((current) => ({ ...current, [turn.id]: detail }));
      }).catch((error: unknown) => {
        setTurnDetailErrors((current) => ({ ...current, [turn.id]: error instanceof Error ? error.message : translate("chat.unableToLoadCompleteTurnHistory") }));
      }).finally(() => {
        setLoadingTurnDetailIds((current) => { const next = new Set(current); next.delete(turn.id); return next; });
      });
    }
  }, [turns, loadTurnDetail, loadedTurnDetails, collapsedTurnOverrides, loadingTurnDetailIds, turnDetailErrors]);

  const collapsedStateForTurn = useCallback((
    turn: TimelineTurn,
    input: {
      forceActive: boolean;
      hasLiveActivity: boolean;
    },
  ) => {
    const override = collapsedTurnOverrides[turn.id];
    if (override !== undefined) {
      return override;
    }
    if (!effectiveAutoCollapseCompletedTurns && isTerminalTurnStatus(turn.status) && storySegments(turn)) {
      return false;
    }

    // A working turn stays open, its latest work unfolded; once finished it folds
    // into its work line.
    if (turn.status === 'inProgress' || turn.status === 'sending' || input.forceActive) {
      return false;
    }
    return Boolean(
      turn.hasDeferredItems ||
        (effectiveAutoCollapseCompletedTurns &&
          isTerminalTurnStatus(turn.status) &&
          !input.hasLiveActivity),
    );
  }, [collapsedTurnOverrides, effectiveAutoCollapseCompletedTurns]);

  const visibleTurns = serverManagedHistory ? turns : turns.slice(startIndex);
  const optimisticAbsoluteIndex = effectiveTotalTurnCount + 1;
  const forceLatestTurnActive =
    threadRunning &&
    (
      !activeTurnId ||
      (
        !visibleTurns.some((turn) => turn.id === activeTurnId) &&
        optimisticTurn?.id !== activeTurnId
      )
    );
  const latestVisibleTurnId =
    optimisticTurn?.id ?? visibleTurns.at(-1)?.id ?? null;
  const shouldForceLatestVisibleTurnActive =
    forceLatestTurnActive && latestVisibleTurnId !== null;
  const liveItemsAttachedToVisibleTurn =
    !!liveItems &&
    (visibleTurns.some((turn) => turn.id === liveItems.turnId) ||
      optimisticTurn?.id === liveItems.turnId);
  const liveItemsTargetTurnId =
    liveItems && liveItemsAttachedToVisibleTurn
      ? liveItems.turnId
      : liveItems && shouldForceLatestVisibleTurnActive
        ? latestVisibleTurnId
        : null;
  const optimisticLiveItems =
    optimisticTurn && liveItemsTargetTurnId === optimisticTurn.id
      ? liveItems?.items ?? null
      : null;
  const hasStructuredLiveItems = (liveItems?.items.length ?? 0) > 0;
  const unattachedLiveItems =
    liveItems && liveItemsTargetTurnId === null ? liveItems.items : null;
  const unattachedLiveTurn = useMemo(
    () =>
      liveItems && liveItemsTargetTurnId === null && liveItems.items.length > 0
        ? buildSyntheticLiveTurn(liveItems.turnId, liveItems.items)
        : null,
    [liveItems, liveItemsTargetTurnId],
  );
  const unattachedLiveTurnIndex = Math.max(
    1,
    effectiveTotalTurnCount + (optimisticTurn ? 1 : 0),
  );
  const liveOutputAttachedToOptimisticTurn =
    !!liveOutput &&
    !!optimisticTurn &&
    optimisticTurn.status !== 'failed' &&
    !optimisticLiveItems;
  const liveOutputTargetTurnId =
    liveOutput && visibleTurns.length > 0
      ? (
          activeTurnId && visibleTurns.some((turn) => turn.id === activeTurnId)
            ? activeTurnId
            : visibleTurns.findLast((turn) => isRunningHistoryStatus(turn.status))?.id ??
              (shouldForceLatestVisibleTurnActive ? latestVisibleTurnId : null)
        )
      : null;
  const liveOutputAttachedToVisibleTurn = Boolean(liveOutputTargetTurnId);
  const liveOutputActivityAt = useMemo(
    () => (liveOutput ? new Date().toISOString() : null),
    [liveOutput],
  );
  const unattachedLiveHookPromptItem = useMemo(
    () => parseHookPromptText(liveOutput),
    [liveOutput, i18nLocale],
  );
  const queuedSteers = [
    ...pendingSteers.filter((steer) => !turns.some((turn) =>
      turn.items.some((item) => item.id === `steer:${steer.id}`),
    )).map((steer) => ({
      id: steer.id,
      prompt: steer.prompt,
      status: 'Accepted',
      createdAt: steer.createdAt,
      canCancel: true,
    })),
    ...optimisticSteers.map((steer) => ({
      id: steer.id,
      prompt: steer.prompt,
      status: steer.status === 'steering' ? 'Steering' : null,
      createdAt: steer.createdAt,
      canCancel: false,
    })),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const requestEntryAnchors = useMemo(
    () =>
      buildRequestEntryAnchors({
        answeredRequestNotes,
        pendingRequests,
        visibleTurns,
        optimisticTurn,
      }),
    [answeredRequestNotes, optimisticTurn, pendingRequests, visibleTurns],
  );
  const activityNoteAnchors = useMemo(
    () =>
      buildActivityNoteAnchors({
        activityNotes,
        visibleTurns,
        optimisticTurn,
      }),
    [activityNotes, optimisticTurn, visibleTurns],
  );

  const findTurn = useCallback((direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-timeline-turn]'));
    const selected = elements.findIndex(element => element.dataset.turnId === navigationTargetRef.current);
    if (selected >= 0) return elements[selected + direction] ?? null;
    const anchor = container.getBoundingClientRect().top + 8;
    return direction < 0
      ? elements.findLast(element => element.getBoundingClientRect().top < anchor - 10) ?? null
      : elements.find(element => element.getBoundingClientRect().top > anchor + 2) ?? null;
  }, [scrollContainerRef]);
  const updateNavigationAvailability = useCallback(() => {
    onPreviousTurnAvailabilityChange?.(!loadingEarlier && (Boolean(findTurn(-1)) || hiddenCount > 0));
    onNextTurnAvailabilityChange?.(Boolean(findTurn(1)));
  }, [findTurn, hiddenCount, loadingEarlier, onPreviousTurnAvailabilityChange, onNextTurnAvailabilityChange]);
  const resetNavigation = useCallback(() => {
    navigationTargetRef.current = null;
    pendingPreviousNavigationRef.current = false;
    updateNavigationAvailability();
  }, [updateNavigationAvailability]);
  const handleTimelineScroll = useCallback(() => {
    handleScroll();
    updateNavigationAvailability();
  }, [handleScroll, updateNavigationAvailability]);
  useEffect(() => {
    const previous = navigationResetRef.current;
    if (previous.threadId === threadId && previous.scrollRequestKey === scrollRequestKey && previous.searchKey === searchTarget?.key) return;
    navigationResetRef.current = { threadId, scrollRequestKey, searchKey: searchTarget?.key };
    resetNavigation();
  }, [threadId, scrollRequestKey, searchTarget?.key, resetNavigation]);
  useEffect(() => { updateNavigationAvailability(); }, [visibleTurns, updateNavigationAvailability]);
  const navigateToTurn = useCallback((target: HTMLElement) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    navigationTargetRef.current = target.dataset.turnId ?? null;
    preserveScrollPositionForResize();
    const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 8;
    container.scrollTo({ top, behavior: 'smooth' });
    updateNavigationAvailability();
  }, [scrollContainerRef, preserveScrollPositionForResize, updateNavigationAvailability]);
  useEffect(() => {
    if (!pendingPreviousNavigationRef.current || loadingEarlier) return;
    const target = findTurn(-1);
    if (!target) return;
    pendingPreviousNavigationRef.current = false;
    navigateToTurn(target);
  }, [visibleTurns, loadingEarlier, findTurn, navigateToTurn]);
  useEffect(() => {
    const previousChanged = handledNavigationRef.current.previous !== previousTurnScrollRequestKey;
    const nextChanged = handledNavigationRef.current.next !== nextTurnScrollRequestKey;
    handledNavigationRef.current = { previous: previousTurnScrollRequestKey, next: nextTurnScrollRequestKey };
    if (!previousChanged && !nextChanged) return;
    const target = findTurn(previousChanged ? -1 : 1);
    const container = scrollContainerRef.current;
    if (!target && previousChanged && hiddenCount > 0 && !loadingEarlier && container) {
      navigationTargetRef.current = container.querySelector<HTMLElement>('[data-timeline-turn]')?.dataset.turnId ?? null;
      pendingPreviousNavigationRef.current = true;
      handleLoadEarlierClick();
      return;
    }
    if (!target || !container) return;
    pendingPreviousNavigationRef.current = false;
    navigateToTurn(target);
  }, [previousTurnScrollRequestKey, nextTurnScrollRequestKey, findTurn, scrollContainerRef, hiddenCount, loadingEarlier, handleLoadEarlierClick, navigateToTurn]);
  const peerGroups = groupPeerWorkTurns(visibleTurns);
  const renderPeerWork = (turn: ThreadTurnDto, omitAgentId?: string) => {
    // Hydrate the wake envelope without freezing live status or billing at
    // the time its details were opened.
    const peerTurn = { ...turn, items: loadedTurnDetails[turn.id]?.items ?? turn.items };
    const context = peerWorkForTurn(peerTurn)!;
    const expanded = collapsedTurnOverrides[turn.id] === false;
    return <PeerWorkGroup key={turn.id} turn={peerTurn} context={context} expanded={expanded}
      loading={loadingTurnDetailIds.has(turn.id)} error={turnDetailErrors[turn.id]}
      onToggle={() => handleToggleCollapse(turn, !expanded)} scrollRootRef={scrollContainerRef}>
      {renderWorkTurn(turn, visibleTurns.indexOf(turn), [], true, omitAgentId)}
      {(requestEntryAnchors.notesByTurnId.get(turn.id)?.length) ? <RequestEntrySectionForTurn
        notes={requestEntryAnchors.notesByTurnId.get(turn.id) ?? []} requests={[]}
        respondingRequestId={respondingRequestId} onRespondToRequest={onRespondToRequest ?? undefined} /> : null}
    </PeerWorkGroup>;

  };
  const renderWorkTurn = (turn: ThreadTurnDto, visibleIndex: number, continuations: ThreadTurnDto[] = [], nested = false, omitAgentId?: string): React.ReactNode => {
    const loadedTurn = loadedTurnDetails[turn.id];
    // Detail loaded while the turn worked is behind it once it ends; the
    // summary then says what is still deferred.
    const loadedWhileWorking = loadedTurn?.status === 'inProgress' && isTerminalTurnStatus(turn.status);
    // A summary refresh must update messages/usage without dropping the
    // operations explicitly loaded earlier or restoring stale text.
    const mergedItems = new Map(loadedTurn?.items.map((item) => [item.id, item]));
    for (const item of turn.items) mergedItems.set(item.id, mergeThreadHistoryItem(mergedItems.get(item.id), item));
    const hydratedTurn = loadedTurn
      ? {
          ...loadedTurn, ...turn,
          hasDeferredItems: loadedWhileWorking ? turn.hasDeferredItems : loadedTurn.hasDeferredItems,
          deferredItemCount: loadedWhileWorking ? turn.deferredItemCount : loadedTurn.deferredItemCount,
          items: [...mergedItems.values()],
        }
      : turn;
    let displayTurn = mergeOptimisticTurnItems(
      hydratedTurn,
      optimisticTurn,
    );
    const rowLivePlan = livePlan?.turnId === turn.id ? livePlan : null;
    const rowLiveItems =
      liveItemsTargetTurnId === turn.id ? liveItems?.items ?? null : null;
    const rowEndedItems = !rowLiveItems?.length && (!loadedTurn || loadedWhileWorking) && endedLiveItems?.turnId === turn.id && isTerminalTurnStatus(turn.status)
      ? endedLiveItems.items : null;
    const rowLiveOutput =
      liveOutputTargetTurnId === turn.id ? liveOutput : '';
    let rowLiveActivityAt = latestTimestamp(
      backendProgress?.turnId === turn.id ? backendProgress.receivedAt : null,
      rowLivePlan?.updatedAt,
      liveItemsTargetTurnId === turn.id ? liveItems?.updatedAt : null,
      rowLiveOutput ? liveOutputActivityAt : null,
    );
    let rowForceActive =
      activeTurnId === turn.id ||
      (
        shouldForceLatestVisibleTurnActive &&
        latestVisibleTurnId === turn.id
      );
    const rowHasLiveActivity =
      Boolean(rowLivePlan) ||
      Boolean(rowLiveOutput) ||
      Boolean(rowLiveItems && rowLiveItems.length > 0);
    const latestContinuation = continuations.at(-1);
    const preview = latestContinuation ? peerWorkPreview(latestContinuation, liveItemsTargetTurnId === latestContinuation.id ? liveItems?.items : null) : null;
    const continuationSteps = continuations.reduce((sum, continuation) => sum + 1 + countTurnSteps(continuation, continuation.items), 0);
    const continuationContent = continuations.length ? continuations.map(continuation => renderPeerWork(continuation, preview?.id)) : undefined;
    if (latestContinuation) {
      displayTurn = aggregatePeerWorkTurn(displayTurn, continuations);
      rowLiveActivityAt = latestTimestamp(rowLiveActivityAt, backendProgress?.turnId === latestContinuation.id ? backendProgress.receivedAt : null,
        liveItemsTargetTurnId === latestContinuation.id ? liveItems?.updatedAt : null,
        ...latestContinuation.items.map(item => item.updatedAt ?? item.createdAt));
      rowForceActive = rowForceActive || latestContinuation.id === activeTurnId || isRunningHistoryStatus(latestContinuation.status);
    }
    const rowCollapsed = collapsedStateForTurn(displayTurn, {
      forceActive: rowForceActive,
      hasLiveActivity: rowHasLiveActivity,
    });

    return (
      <ThreadTurnRow
        threadId={threadId}
        peerWorkChildren={continuationContent}
        peerWorkSteps={continuationSteps}
        {...(latestContinuation ? { peerWaitingForWake: [...new Map([...latestContinuation.items, ...(liveItemsTargetTurnId === latestContinuation.id ? liveItems?.items ?? [] : [])].map(item => [item.id, item])).values()].some(item => item.origin === 'nativeBackgroundWait' && item.status === 'waiting') } : {})}
        {...(continuations.length ? { summaryAgentOverride: preview } : {})}
        nestedPeerWork={nested}
        omitAgentId={omitAgentId}
        {...(adapter ? { adapter } : {})}
        turn={displayTurn}
        revealTarget={searchTarget?.turnId === displayTurn.id ? searchTarget : undefined}
        backgroundAgentCount={backgroundAgentCount}
        absoluteIndex={visibleTurnAbsoluteOffset + visibleIndex + 1}
        isCollapsed={rowCollapsed}
        livePlan={rowLivePlan}
        liveItems={rowEndedItems ?? rowLiveItems}
        liveActivityAt={rowLiveActivityAt}
        liveOutput={rowLiveOutput}
        forceActive={rowForceActive}
        onToggleCollapse={handleToggleCollapse}
        narrationMode={!effectiveAutoCollapseCompletedTurns}
        deferredItemsLoading={loadingTurnDetailIds.has(turn.id)}
        deferredItemsError={turnDetailErrors[turn.id]}
        onOpenExpandedText={handleOpenExpandedText}
        onOpenCommandDetail={handleOpenCommandDetail}
        onOpenToolCallDetail={handleOpenToolCallDetail}
        onOpenDeferredHistoryItemDetail={handleOpenDeferredHistoryItemDetail}
        onBeforeMessageResize={preserveScrollPositionForResize}
        {...(onSelectArtifact ? { onSelectArtifact } : {})}
        scrollRootRef={scrollContainerRef}
        articleRef={undefined}
      />
    );

  };
  return (
    <ScrollAnchorContext.Provider value={scrollAnchor}>
    <ThreadLinkContext.Provider value={threadLinks}>
    <TranscriptLogContext.Provider value={transcriptLogActions}>
      <section className={`flex min-h-0 flex-1 flex-col ${className}`.trim()}>
        <div
          ref={scrollContainerRef}
          data-testid="thread-scroll-container"
          data-thread-transcript=""
          onScroll={handleTimelineScroll}
          onWheel={(event) => { resetNavigation(); handleWheel(event); }}
          onTouchStart={(event) => { resetNavigation(); handleTouchStart(event); }}
          onPointerDown={(event) => { resetNavigation(); if (event.target === event.currentTarget) releaseAnchor(); }}
          onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) { resetNavigation(); releaseAnchor(); } }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="thread-graph-scroll-container min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={bottomSpacer > 0 ? { paddingBottom: bottomSpacer } : undefined}
        >
          <div ref={scrollContentRef} className="thread-graph-scroll-content">
          <div ref={topSentinelRef} aria-hidden="true" className="h-px" />
          {turns.length > 0 && (
            <div className="thread-graph-history-control px-3 pb-1 pt-2 sm:px-5 sm:pb-1.5 sm:pt-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={handleLoadEarlierClick}
                    disabled={loadingEarlier}
                    aria-busy={loadingEarlier}
                    className="thread-history-earlier flex items-center gap-2 px-2 py-2 text-xs transition"
                  >
                    <span className="thread-history-arrow" aria-hidden="true">↑</span>
                    {loadingEarlier ? translate("chat.loadingEarlier") : translate("chat.earlierMessages")}
                  </button>
                )}
                {showLoadAll && (
                  <button
                    type="button"
                    onClick={handleLoadAllClick}
                    className="rounded-full border border-amber-300/40 px-2.5 py-1.5 text-amber-200 transition hover:bg-amber-300/10"
                  >
                    {translate("chat.loadFullHistory")}</button>
                )}
                <p className="timeline-meta-text">
                  {translate("chat.showing")} {visibleTurns.length} {translate("chat.of")} {effectiveTotalTurnCount} {translate("chat.turns")}{hiddenCount > 0
                    ? translate("chat.earlierHidden", { value1: hiddenCount, value2: loadedHiddenCount > 0 && unloadedHiddenCount > 0
                          ? ` (${loadedHiddenCount} loaded)`
                          : '' })
                    : ''}
                </p>
              </div>
            </div>
          )}

          {turns.length === 0 && !liveOutput && !optimisticTurn && (
            <div className="thread-graph-empty-state px-3 py-8 text-sm sm:px-5">
              {translate("chat.sendTheFirstPromptToStartThe")}</div>
          )}

          {(visibleTurns.length > 0 ||
            optimisticTurn ||
            activityNoteAnchors.leading.length > 0 ||
            activityNoteAnchors.trailing.length > 0) && (
            <div className="thread-graph-message-list">
              {activityNoteAnchors.leading.length > 0 ? (
                <ActivityNoteSection
                  notes={activityNoteAnchors.leading}
                  onOpenThread={onOpenThread}
                  onOpenLinkedThread={openLinkedThread}
                />
              ) : null}
              {peerGroups.map(({ turn, index: visibleIndex, continuations }) => (
                <div key={turn.id} data-timeline-turn data-turn-id={turn.id}>
                  {(activityNoteAnchors.beforeTurnId.get(turn.id)?.length ?? 0) > 0 ? (
                    <ActivityNoteSection
                      notes={activityNoteAnchors.beforeTurnId.get(turn.id) ?? []}
                      onOpenThread={onOpenThread}
                      onOpenLinkedThread={openLinkedThread}
                    />
                  ) : null}
                  {(requestEntryAnchors.beforeTurnId.get(turn.id)?.length ?? 0) > 0 ? (
                    <RequestEntrySection
                      entries={requestEntryAnchors.beforeTurnId.get(turn.id) ?? []}
                      respondingRequestId={respondingRequestId}
                      onRespondToRequest={onRespondToRequest ?? undefined}
                    />
                  ) : null}
                  {peerWorkForTurn(turn) && !continuations.length ? renderPeerWork(turn) : renderWorkTurn(turn, visibleIndex, continuations)}
                  {continuations.map(child => <div key={`peer-requests:${child.id}`}>
                    {(activityNoteAnchors.beforeTurnId.get(child.id)?.length ?? 0) > 0 ? <ActivityNoteSection
                      notes={activityNoteAnchors.beforeTurnId.get(child.id) ?? []} onOpenThread={onOpenThread} onOpenLinkedThread={openLinkedThread} /> : null}
                    {(requestEntryAnchors.beforeTurnId.get(child.id)?.length ?? 0) > 0 ? <RequestEntrySection
                      entries={requestEntryAnchors.beforeTurnId.get(child.id) ?? []} respondingRequestId={respondingRequestId} onRespondToRequest={onRespondToRequest ?? undefined} /> : null}
                    {(requestEntryAnchors.pendingRequestsByTurnId.get(child.id)?.length ?? 0) > 0 ? <RequestEntrySectionForTurn
                      notes={[]} requests={requestEntryAnchors.pendingRequestsByTurnId.get(child.id) ?? []} respondingRequestId={respondingRequestId} onRespondToRequest={onRespondToRequest ?? undefined} /> : null}
                    {(activityNoteAnchors.afterTurnId.get(child.id)?.length ?? 0) > 0 ? <ActivityNoteSection
                      notes={activityNoteAnchors.afterTurnId.get(child.id) ?? []} onOpenThread={onOpenThread} onOpenLinkedThread={openLinkedThread} /> : null}
                  </div>)}
                  {(activityNoteAnchors.afterTurnId.get(turn.id)?.length ?? 0) > 0 ? (
                    <ActivityNoteSection
                      notes={activityNoteAnchors.afterTurnId.get(turn.id) ?? []}
                      onOpenThread={onOpenThread}
                      onOpenLinkedThread={openLinkedThread}
                    />
                  ) : null}
                  {(requestEntryAnchors.notesByTurnId.get(turn.id)?.length || requestEntryAnchors.pendingRequestsByTurnId.get(turn.id)?.length) ? (
                    <RequestEntrySectionForTurn
                      notes={requestEntryAnchors.notesByTurnId.get(turn.id) ?? []}
                      requests={requestEntryAnchors.pendingRequestsByTurnId.get(turn.id) ?? []}
                      respondingRequestId={respondingRequestId}
                      onRespondToRequest={onRespondToRequest ?? undefined}
                    />
                  ) : null}
                </div>
              ))}
              {optimisticTurn && visibleTurns.every((turn) => turn.id !== optimisticTurn.id) && (
                <>
                  {(activityNoteAnchors.beforeTurnId.get(optimisticTurn.id)?.length ?? 0) > 0 ? (
                    <ActivityNoteSection
                      notes={activityNoteAnchors.beforeTurnId.get(optimisticTurn.id) ?? []}
                      onOpenThread={onOpenThread}
                      onOpenLinkedThread={openLinkedThread}
                    />
                  ) : null}
                  {(requestEntryAnchors.beforeTurnId.get(optimisticTurn.id)?.length ?? 0) > 0 ? (
                    <RequestEntrySection
                      entries={
                        requestEntryAnchors.beforeTurnId.get(optimisticTurn.id) ??
                        []
                      }
                      respondingRequestId={respondingRequestId}
                      onRespondToRequest={onRespondToRequest ?? undefined}
                    />
                  ) : null}
                  {(() => {
                    const rowLiveOutput = liveOutputAttachedToOptimisticTurn ? liveOutput : '';
                    let rowLiveActivityAt = latestTimestamp(
                      backendProgress?.turnId === optimisticTurn.id ? backendProgress.receivedAt : null,
                      liveItemsTargetTurnId === optimisticTurn.id
                        ? liveItems?.updatedAt
                        : null,
                      rowLiveOutput ? liveOutputActivityAt : null,
                    );
                    const rowForceActive =
                      activeTurnId === optimisticTurn.id ||
                      (
                        shouldForceLatestVisibleTurnActive &&
                        latestVisibleTurnId === optimisticTurn.id
                      );
                    const rowHasLiveActivity =
                      Boolean(optimisticLiveItems && optimisticLiveItems.length > 0) ||
                      Boolean(rowLiveOutput);
                    const rowCollapsed = collapsedStateForTurn(optimisticTurn, {
                      forceActive: rowForceActive,
                      hasLiveActivity: rowHasLiveActivity,
                    });

                    return (
                  <ThreadTurnRow
                    threadId={threadId}
                    {...(adapter ? { adapter } : {})}
                    turn={optimisticTurn}
                    backgroundAgentCount={backgroundAgentCount}
                    absoluteIndex={optimisticAbsoluteIndex}
                    isCollapsed={rowCollapsed}
                    livePlan={null}
                    liveItems={optimisticLiveItems}
                    liveActivityAt={rowLiveActivityAt}
                    liveOutput={rowLiveOutput}
                    forceActive={rowForceActive}
                    onToggleCollapse={handleToggleCollapse}
                    onOpenExpandedText={handleOpenExpandedText}
                    onOpenCommandDetail={handleOpenCommandDetail}
                    onOpenToolCallDetail={handleOpenToolCallDetail}
                    onOpenDeferredHistoryItemDetail={handleOpenDeferredHistoryItemDetail}
                    onBeforeMessageResize={preserveScrollPositionForResize}
                    {...(onSelectArtifact ? { onSelectArtifact } : {})}
                    scrollRootRef={scrollContainerRef}
                  />
                    );
                  })()}
                  {(activityNoteAnchors.afterTurnId.get(optimisticTurn.id)?.length ?? 0) > 0 ? (
                    <ActivityNoteSection
                      notes={activityNoteAnchors.afterTurnId.get(optimisticTurn.id) ?? []}
                      onOpenThread={onOpenThread}
                      onOpenLinkedThread={openLinkedThread}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}

          {queuedSteers.length > 0 && (
            <div className="thread-graph-message-section space-y-3 px-3 py-4 sm:px-5">
              {queuedSteers.map((steer) => (
                <div key={steer.id} className="space-y-1.5">
                  <CompactMessageItem
                    threadId={threadId}
                    item={{
                      id: steer.id,
                      kind: 'userMessage',
                      text: steer.prompt,
                      status: steer.status,
                    }}
                    scrollRootRef={scrollContainerRef}
                    onBeforeMessageResize={preserveScrollPositionForResize}
                    {...(adapter ? { adapter } : {})}
                  />
                  {threadId && steer.canCancel && adapter?.cancelPendingSteer ? (
                    <div className="flex justify-end px-1">
                      <button
                        type="button"
                        className="thread-graph-history-button rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={cancelingSteerIds.has(steer.id)}
                        onClick={() => {
                          setCancelingSteerIds((current) => new Set(current).add(steer.id));
                          void Promise.resolve(adapter.cancelPendingSteer?.(threadId, steer.id))
                            .catch(() => undefined)
                            .finally(() => {
                              setCancelingSteerIds((current) => {
                                const next = new Set(current);
                                next.delete(steer.id);
                                return next;
                              });
                            });
                        }}
                      >
                        {cancelingSteerIds.has(steer.id) ? translate("chat.canceling") : translate("chat.cancel")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {(requestEntryAnchors.trailing.length > 0 ||
            activityNoteAnchors.trailing.length > 0) && (
            <ActivityRequestEntrySection
              entries={[
                ...activityNoteAnchors.trailing.map((note) => ({
                  kind: 'activity' as const,
                  id: note.id,
                  createdAt: note.createdAt,
                  note,
                })),
                ...requestEntryAnchors.trailing,
              ]}
              respondingRequestId={respondingRequestId}
              onRespondToRequest={onRespondToRequest ?? undefined}
              onOpenThread={onOpenThread}
              onOpenLinkedThread={openLinkedThread}
            />
          )}

          {ephemeralUserNote && (
            <div className="thread-graph-message-section px-3 py-2.5 sm:px-5">
              <CompactMessageItem
                threadId={threadId}
                item={{
                  id: 'ephemeral-plan-decision-note',
                  kind: 'userMessage',
                  text: ephemeralUserNote,
                }}
                scrollRootRef={scrollContainerRef}
                onBeforeMessageResize={preserveScrollPositionForResize}
              />
            </div>
          )}

          {unattachedLiveTurn && unattachedLiveItems && unattachedLiveItems.length > 0 && (
            <ThreadTurnRow
              threadId={threadId}
              {...(adapter ? { adapter } : {})}
              turn={unattachedLiveTurn}
              backgroundAgentCount={backgroundAgentCount}
              absoluteIndex={unattachedLiveTurnIndex}
              isCollapsed={collapsedTurnOverrides[unattachedLiveTurn.id] ?? false}
              livePlan={livePlan?.turnId === unattachedLiveTurn.id ? livePlan : null}
              liveItems={unattachedLiveItems}
              liveActivityAt={latestTimestamp(
                backendProgress?.turnId === unattachedLiveTurn.id ? backendProgress.receivedAt : null,
                livePlan?.turnId === unattachedLiveTurn.id ? livePlan.updatedAt : null,
                liveItems?.turnId === unattachedLiveTurn.id ? liveItems.updatedAt : null,
              )}
              liveOutput=""
              forceActive
              onToggleCollapse={handleToggleCollapse}
              onOpenExpandedText={handleOpenExpandedText}
              onOpenCommandDetail={handleOpenCommandDetail}
              onOpenToolCallDetail={handleOpenToolCallDetail}
              onOpenDeferredHistoryItemDetail={handleOpenDeferredHistoryItemDetail}
              onBeforeMessageResize={preserveScrollPositionForResize}
              {...(onSelectArtifact ? { onSelectArtifact } : {})}
              scrollRootRef={scrollContainerRef}
            />
          )}

          {liveOutput &&
            !liveOutputAttachedToVisibleTurn &&
            !liveOutputAttachedToOptimisticTurn &&
            !hasStructuredLiveItems && (
            <div className="thread-graph-message-section px-3 py-2.5 sm:px-5">
              {unattachedLiveHookPromptItem ? (
                <HistoryItemRow
                  threadId={threadId}
                  item={unattachedLiveHookPromptItem}
                  scrollRootRef={scrollContainerRef}
                  onOpenExpandedText={handleOpenExpandedText}
                  onOpenCommandDetail={handleOpenCommandDetail}
                  onOpenToolCallDetail={handleOpenToolCallDetail}
                  onOpenDeferredHistoryItemDetail={handleOpenDeferredHistoryItemDetail}
                  onBeforeMessageResize={preserveScrollPositionForResize}
                  {...(onSelectArtifact ? { onSelectArtifact } : {})}
                  {...(adapter ? { adapter } : {})}
                />
              ) : (
                <CompactMessageItem
                  threadId={threadId}
                  item={{
                    id: 'live-agent-message-fallback',
                    kind: 'agentMessage',
                    text: liveOutput,
                  }}
                  scrollRootRef={scrollContainerRef}
                  streaming
                  onBeforeMessageResize={preserveScrollPositionForResize}
                  {...(adapter ? { adapter } : {})}
                />
              )}
            </div>
          )}

          <div
            ref={tailSentinelRef}
            aria-hidden="true"
            className="h-px w-full"
          />
          </div>
        </div>
      </section>

      <LongTextDialog
        open={expandedText !== null}
        title={expandedText?.title ?? translate("chat.fullText")}
        text={expandedText?.text ?? ''}
        kind={expandedText?.kind}
        onClose={closeExpandedText}
      />
    </TranscriptLogContext.Provider>
    </ThreadLinkContext.Provider>
    </ScrollAnchorContext.Provider>
  );
}

export const ThreadTimeline = memo(ThreadTimelineComponent);
