import { ThreadLoadingIndicator } from '../ThreadLoadingIndicator';
import { translate, useI18n } from '../../i18n';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type RefCallback,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronRight } from 'lucide-react';

import type { ThreadHistoryItemDto, ThreadTurnActivitySegmentDto } from '@pockymoe/shared';

import type { ThreadTimelineAdapter } from '../../adapters';
import {
  formatLongTimestamp,
  formatMessageTimestamp,
  formatPreciseMessageTimestamp,
  formatShortTimestamp,
} from '../threadPresentation';
import {
  GraphChatAgentToolCallItem as AgentToolCallItem,
  GraphChatArtifactHistoryItem as ArtifactHistoryItem,
  GraphChatCommandItem as CommandItem,
  GraphChatContextCompactionItem as ContextCompactionItem,
  GraphChatFileChangeItem as FileChangeItem,
  GraphChatFileReadItem as FileReadItem,
  GraphChatGenericHistoryItem as GenericHistoryItem,
  GraphChatHookItem as HookItem,
  GraphChatImageItem as ImageItem,
  GraphChatPlanHistoryItem as PlanHistoryItem,
  GraphChatSkillToolCallItem as SkillToolCallItem,
  GraphChatToolCallItem as ToolCallItem,
  GraphChatWebSearchItem as WebSearchItem,
} from '../graph-chat/GraphChatHistoryItems';
import { GraphChatCompactMessageItem as CompactMessageItem } from '../graph-chat/GraphChatCompactMessageItem';
import { MessageExpansionScope } from '../graph-chat/MessageExpansionScope';
import { GraphChatTurnBody } from '../graph-chat/GraphChatTurnBody';
import { GraphChatTurnFrame } from '../graph-chat/GraphChatTurnFrame';
import { TranscriptAgentByline } from '../graph-chat/TranscriptAgent';
import {
  countTurnSteps,
  getLiveOutputTailForTurn,
  groupTimelineHistoryItems,
  isActiveTurnStatus,
  isCompactChatItem,
  isRunningHistoryStatus,
  mergeLiveTurnItems,
  parseHookPromptText,
  prepareTurnItemsForRendering,
  type TimelineHistoryEntry,
  type TimelineTurn,
} from './timelineItems';
import { groupAnswerSections, isSubstantiveAnswer } from './answerSections';
import { TurnTokenSummary } from './tokenFormatting';
import { TurnStatusBar } from './turnStatus';
import { TurnUsageInline } from './TurnUsageInline';
import { activityParts, hasActivity, storySegments, turnActivity, turnChangedFiles } from './activity';
import { ActivitySummary, ChangedFiles, isLogItem, LogRow, LogRun, opensDiff, RunPlaceholder } from './TranscriptLog';
import { useAppShellNav } from '../../app-shell/AppShellNavContext';

type LivePlan = {
  turnId: string;
  explanation: string | null;
  plan: Array<{ step: string; status: string }>;
  updatedAt?: string | null;
};

type SelectArtifactHandler = (input: {
  item: ThreadHistoryItemDto & { kind: 'artifact' };
  artifact: NonNullable<ThreadHistoryItemDto['artifact']>;
}) => void;

type OpenExpandedTextHandler = (title: string, text: string) => void;

type OpenCommandDetailHandler = (
  item: ThreadHistoryItemDto & { kind: 'commandExecution' },
  title: string,
) => void;

type OpenToolCallDetailHandler = (
  item: ThreadHistoryItemDto & {
    kind: 'toolCall' | 'agentToolCall' | 'skillToolCall';
  },
  title: string,
) => void;

type OpenDeferredHistoryItemDetailHandler = (
  item: ThreadHistoryItemDto,
  title: string,
  fallbackText: string,
  loadingText: string,
  errorText: string,
) => void;

function timestampForHistoryItem(
  item: ThreadHistoryItemDto,
  fallback: string | null,
) {
  return item.createdAt ?? fallback;
}

interface HistoryItemRowProps {
  threadId: string | undefined;
  item: ThreadHistoryItemDto;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  timeLabel?: ReactNode;
  timeTitle?: string | null | undefined;
  timeMeta?: ReactNode;
  autoOpenToolDetails?: boolean;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: () => void;
  adapter?: ThreadTimelineAdapter | undefined;
}

export const HistoryItemRow = memo(function HistoryItemRow({
  threadId,
  item,
  scrollRootRef,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  adapter,
  timeLabel,
  timeTitle,
  timeMeta,
  autoOpenToolDetails = false,
}: HistoryItemRowProps) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  if (item.kind === 'reasoning' && !shellNav?.showReasoningSummaries) return null;
  if (isCompactChatItem(item.kind)) {
    return (
      <CompactMessageItem
        threadId={threadId}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'userMessage' | 'agentMessage';
          }
        }
        scrollRootRef={scrollRootRef}
        timeLabel={timeLabel}
        timeTitle={timeTitle}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
        {...(adapter ? { adapter } : {})}
      />
    );
  }

  if (item.kind === 'reasoning') {
    return (
      <CompactMessageItem
        item={{
          ...item,
          kind: 'agentMessage',
          status: item.status ?? null,
        }}
        variant="reasoning"
        scrollRootRef={scrollRootRef}
        timeLabel={timeLabel}
        timeTitle={timeTitle}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      />
    );
  }

  if (item.kind === 'artifact') {
    return (
      <ArtifactHistoryItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'artifact';
          }
        }
        timeMeta={timeMeta}
        {...(onSelectArtifact
          ? {
              onSelect: (nextItem, artifact) =>
                onSelectArtifact({ item: nextItem, artifact }),
            }
          : {})}
      />
    );
  }

  if (item.kind === 'commandExecution') {
    return (
      <CommandItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'commandExecution';
          }
        }
        onOpen={onOpenCommandDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'toolCall') {
    return (
      <ToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'toolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'agentToolCall') {
    return (
      <AgentToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'agentToolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'skillToolCall') {
    return (
      <SkillToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'skillToolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'webSearch') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'webSearch';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.webSearch");
    return (
      <WebSearchItem
        autoOpen={autoOpenToolDetails}
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.webSearchDetails"),
            detailText,
            translate("chat.loadingFullWebSearchDetails"),
            translate("chat.unableToLoadFullWebSearchDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'fileRead') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'fileRead';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.fileRead");
    return (
      <FileReadItem
        autoOpen={autoOpenToolDetails}
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.fileReadDetails"),
            detailText,
            translate("chat.loadingFullFileReadDetails"),
            translate("chat.unableToLoadFullFileReadDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'image') {
    return (
      <ImageItem
        threadId={threadId}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'image';
          }
        }
        onOpen={onOpenExpandedText}
        getImageAssetUrl={adapter?.getImageAssetUrl}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'plan') {
    return (
      <PlanHistoryItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'plan';
          }
        }
        scrollRootRef={scrollRootRef}
        timeMeta={timeMeta}
        {...(onBeforeMessageResize
          ? { onBeforeResize: onBeforeMessageResize }
          : {})}
      />
    );
  }

  if (item.kind === 'fileChange') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'fileChange';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.fileChange");
    return (
      <FileChangeItem
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.fileChangeDetails"),
            detailText,
            translate("chat.loadingFullFileChangeDetails"),
            translate("chat.unableToLoadFullFileChangeDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'contextCompaction') {
    return (
      <ContextCompactionItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'contextCompaction';
          }
        }
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'hook') {
    return (
      <HookItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'hook';
          }
        }
        timeMeta={timeMeta}
      />
    );
  }

  return <GenericHistoryItem item={item} timeMeta={timeMeta} />;
});

interface ThreadTurnRowProps {
  peerWorkChildren?: ReactNode;
  peerWorkSteps?: number;
  peerWaitingForWake?: boolean;
  summaryAgentOverride?: (ThreadHistoryItemDto & { kind: 'agentMessage' }) | null;
  nestedPeerWork?: boolean;
  omitAgentId?: string | undefined;
  revealTarget?: { itemId: string; key: number } | undefined;
  threadId: string | undefined;
  adapter?: ThreadTimelineAdapter | undefined;
  turn: TimelineTurn;
  absoluteIndex: number;
  isCollapsed: boolean;
  livePlan: LivePlan | null;
  liveItems: ThreadHistoryItemDto[] | null;
  liveActivityAt?: string | null;
  liveOutput: string;
  forceActive?: boolean;
  backgroundAgentCount?: number;
  onToggleCollapse: (turn: TimelineTurn, currentCollapsed: boolean, loadDetails?: boolean) => void;
  deferredItemsLoading?: boolean;
  deferredItemsError?: string | undefined;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: () => void;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  articleRef?: RefCallback<HTMLElement> | undefined;
}

function isTerminalTurnStatus(status: TimelineTurn['status']) {
  return (
    status === 'completed' || status === 'failed' || status === 'interrupted'
  );
}

function itemCreatedAtMillis(item: ThreadHistoryItemDto) {
  const millis = Date.parse(item.createdAt ?? '');
  return Number.isFinite(millis) ? millis : null;
}

function latestItemTimestamp(items: ThreadHistoryItemDto[]) {
  let latest: number | null = null;
  for (const item of items) {
    const millis = itemCreatedAtMillis(item);
    if (millis === null) {
      continue;
    }
    latest = latest === null ? millis : Math.max(latest, millis);
  }
  return latest;
}

function latestActivityTimestamp(
  startedAt: string | null | undefined,
  items: ThreadHistoryItemDto[],
  liveActivityAt: string | null | undefined,
) {
  const candidates = [
    Date.parse(startedAt ?? ''),
    latestItemTimestamp(items) ?? Number.NaN,
    Date.parse(liveActivityAt ?? ''),
  ].filter(Number.isFinite);

  return candidates.length > 0
    ? new Date(Math.max(...candidates)).toISOString()
    : null;
}

export function formatWorkedDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  items: ThreadHistoryItemDto[],
) {
  const startMillis = Date.parse(startedAt ?? '');
  const completedMillis = Date.parse(completedAt ?? '');
  const endMillis = Number.isFinite(completedMillis)
    ? completedMillis
    : latestItemTimestamp(items);
  if (
    !Number.isFinite(startMillis) ||
    endMillis === null ||
    endMillis < startMillis
  ) {
    return translate("chat.worked");
  }

  const totalSeconds = Math.max(
    1,
    Math.round((endMillis - startMillis) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return translate("chat.workedForHours", { hours, minutes });
  }
  if (minutes > 0) {
    return translate("chat.workedForMinutes", { minutes, seconds });
  }
  return translate("chat.workedForSeconds", { seconds });
}

import { TimelineTimeToggle } from './TimelineTimeToggle';



function collapsedSummaryMessages(entries: TimelineHistoryEntry[], active: boolean) {
  const itemEntries = entries.filter(
    (entry): entry is TimelineHistoryEntry & { kind: 'item' } =>
      entry.kind === 'item',
  );
  const users = itemEntries
    .map((entry) => entry.item)
    .filter(
      (item): item is ThreadHistoryItemDto & { kind: 'userMessage' } =>
        item.kind === 'userMessage',
    );
  const latestAgent = itemEntries
    .map((entry) => entry.item)
    .reverse()
    .find(
      (item): item is ThreadHistoryItemDto & { kind: 'agentMessage' } =>
        item.kind === 'agentMessage' && item.text.trim().length > 0,
    );
  const hasBackgroundOrigin = (entry: TimelineHistoryEntry): boolean => {
    if (entry.kind === 'agentActivityGroup') return entry.entries.some(hasBackgroundOrigin);
    return entry.kind === 'item' &&
      (entry.item.origin === 'nativeBackgroundWait' || entry.item.origin === 'nativeTaskNotification');
  };
  const hasBackground = entries.some(hasBackgroundOrigin);
  // Keep the latest narration visible while working, including during tools or
  // a background wait. Completed background turns require a confirmed final
  // reply; a completed progress item alone is not proof that the turn finished.
  const summaryAgent = active || !hasBackground
    ? latestAgent
    : (latestAgent?.responsePhase === 'final' ? latestAgent : undefined);
  const hiddenEntries = entries.filter((entry) => {
    if (entry.kind !== 'item') {
      return true;
    }

    return (
      entry.item.kind !== 'userMessage' && entry.item.id !== summaryAgent?.id
    );
  });

  return {
    users,
    latestAgent,
    summaryAgent,
    hiddenEntries,
  };
}

export const ThreadTurnRow = memo(function ThreadTurnRow({
  peerWorkChildren,
  peerWorkSteps = 0,
  peerWaitingForWake,
  summaryAgentOverride,
  nestedPeerWork = false,
  omitAgentId,
  threadId,
  revealTarget,
  adapter,
  turn,
  absoluteIndex,
  isCollapsed,
  livePlan,
  liveItems,
  liveActivityAt = null,
  liveOutput,
  forceActive = false,
  backgroundAgentCount = 0,
  onToggleCollapse,
  deferredItemsLoading = false,
  deferredItemsError,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  scrollRootRef,
  articleRef,
}: ThreadTurnRowProps) {
  const { locale: i18nLocale } = useI18n();
  const showReasoningSummaries = useAppShellNav()?.showReasoningSummaries ?? false;
  const hasLiveActivity =
    Boolean(livePlan) ||
    Boolean(liveOutput) ||
    Boolean(liveItems && liveItems.length > 0);
  const activeForRendering =
    forceActive ||
    isActiveTurnStatus(turn.status) ||
    (hasLiveActivity && !isTerminalTurnStatus(turn.status));
  const activeFooterTurn: TimelineTurn =
    activeForRendering && !isActiveTurnStatus(turn.status)
      ? {
          ...turn,
          status: 'inProgress',
        }
      : turn;
  const mergedItems = useMemo(
    () => mergeLiveTurnItems(turn.items, liveItems),
    [liveItems, turn.items],
  );
  const stepCount = useMemo(
    () => countTurnSteps({ hasDeferredItems: turn.hasDeferredItems, deferredItemCount: turn.deferredItemCount }, mergedItems, turn.items),
    [mergedItems, turn.items, turn.hasDeferredItems, turn.deferredItemCount],
  );
  const lastActivityAt = useMemo(
    () => latestActivityTimestamp(turn.startedAt, mergedItems, liveActivityAt),
    [liveActivityAt, mergedItems, turn.startedAt],
  );
  // The plan reads as the agent last reported it; the transcript does not guess progress.
  const displayedLivePlan = livePlan;
  const visibleLiveOutput = useMemo(
    () => getLiveOutputTailForTurn(liveOutput, mergedItems),
    [liveOutput, mergedItems],
  );
  const preparedItems = useMemo(
    () => prepareTurnItemsForRendering(mergedItems, activeForRendering).filter(item =>
      (showReasoningSummaries || item.kind !== 'reasoning') &&
      (!nestedPeerWork || item.kind !== 'userMessage') && item.id !== omitAgentId),
    [activeForRendering, mergedItems, showReasoningSummaries, nestedPeerWork, omitAgentId],
  );
  const groupedItems = useMemo(
    () => groupTimelineHistoryItems(preparedItems),
    [preparedItems],
  );
  const autoOpenLatestToolDetails =
    activeForRendering;
  const turnTimeLabel = formatShortTimestamp(turn.startedAt);
  const turnTimeTitle = formatLongTimestamp(turn.startedAt);
  const visibleLiveHookPrompt = useMemo(
    () => parseHookPromptText(visibleLiveOutput),
    [visibleLiveOutput, i18nLocale],
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  // The run a reader opened from a folded turn's narration; null is the last run.
  const [openRunBefore, setOpenRunBefore] = useState<string | null | undefined>(undefined);
  const revealedSearch = useRef<number | null>(null);
  useEffect(() => {
    if (!revealTarget || revealedSearch.current === revealTarget.key) return;
    const keys: string[] = [];
    function contains(entry: TimelineHistoryEntry): boolean {
      if (entry.kind === 'item') return entry.item.id === revealTarget?.itemId;
      const found = entry.kind === 'agentActivityGroup'
        ? entry.entries.some(contains)
        : entry.items.some(item => item.id === revealTarget?.itemId);
      if (found) keys.push(entry.key);
      return found;
    }
    if (groupedItems.some(contains)) {
      revealedSearch.current = revealTarget.key;
      setExpandedGroups(current => ({ ...current, ...Object.fromEntries(keys.map(key => [key, true])) }));
    }
  }, [groupedItems, revealTarget]);

  const toggleGroupedItem = useCallback((groupKey: string, currentExpanded: boolean) => {
    onBeforeMessageResize?.();
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !currentExpanded,
    }));
  }, [onBeforeMessageResize]);

  const renderHistoryEntries = (entries: TimelineHistoryEntry[], options?: {
    collapsed: boolean;
    onExpand: () => void;
  }) => (
    <TimelineHistoryEntries
      entries={entries}
      expandedGroups={options?.collapsed ? {} : expandedGroups}
      onToggleGroupedItem={options ? (key, current) => {
        if (options.collapsed) options.onExpand();
        toggleGroupedItem(key, options.collapsed ? false : current);
      } : toggleGroupedItem}
      threadId={threadId}
      scrollRootRef={scrollRootRef}
      onOpenExpandedText={onOpenExpandedText}
      onOpenCommandDetail={onOpenCommandDetail}
      onOpenToolCallDetail={onOpenToolCallDetail}
      onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
      {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      fallbackTimestamp={turn.startedAt}
      fallbackTimeLabel={turnTimeLabel}
      fallbackTimeTitle={turnTimeTitle}
      turnStartedAt={turn.startedAt}
      autoOpenLatestToolDetails={autoOpenLatestToolDetails && entries.at(-1)?.key === groupedItems.at(-1)?.key}
      {...(openRunBefore !== undefined ? { openRunBefore } : {})}
      {...(onSelectArtifact ? { onSelectArtifact } : {})}
      {...(adapter ? { adapter } : {})}
    />
  );
  const historyNode = renderHistoryEntries(groupedItems);
  const liveHookPromptNode = visibleLiveHookPrompt ? (
    <HistoryItemRow
      threadId={threadId}
      item={visibleLiveHookPrompt}
      scrollRootRef={scrollRootRef}
      onOpenExpandedText={onOpenExpandedText}
      onOpenCommandDetail={onOpenCommandDetail}
      onOpenToolCallDetail={onOpenToolCallDetail}
      onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
      timeLabel={
        turn.startedAt
          ? formatPreciseMessageTimestamp(turn.startedAt)
          : turnTimeLabel
      }
      timeTitle={turnTimeTitle}
      timeMeta={null}
      {...(onSelectArtifact ? { onSelectArtifact } : {})}
      {...(adapter ? { adapter } : {})}
    />
  ) : null;
  const liveOutputNode =
    !visibleLiveHookPrompt && visibleLiveOutput ? (
      <CompactMessageItem
        item={{
          id: 'live-agent-message',
          kind: 'agentMessage',
          text: visibleLiveOutput,
        }}
        scrollRootRef={scrollRootRef}
        timeLabel={
          turn.startedAt
            ? formatPreciseMessageTimestamp(turn.startedAt)
            : turnTimeLabel
        }
        timeTitle={turnTimeTitle}
        streaming
        {...(adapter ? { adapter } : {})}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      />
    ) : null;
  const footerNode = activeForRendering ? (
    <TurnStatusBar
      turn={activeFooterTurn}
      variant="footer"
      lastActivityAt={lastActivityAt}
      backgroundAgentCount={backgroundAgentCount}
      waitingForWake={peerWaitingForWake ?? mergedItems.some(item => item.origin === 'nativeBackgroundWait' && item.status === 'waiting')}
    />
  ) : null;
  const collapsedSummary = useMemo(
    () => {
      const summary = collapsedSummaryMessages(groupedItems, activeForRendering);
      return summaryAgentOverride === undefined ? summary : {
        ...summary, summaryAgent: summaryAgentOverride ?? undefined,
        hiddenEntries: groupedItems.filter(entry => entry.kind !== 'item' || entry.item.kind !== 'userMessage'),
      };
    },
    [groupedItems, activeForRendering, summaryAgentOverride],
  );
  const workedLabel = useMemo(
    () => turn.status === 'recovering' ? translate("chat.confirmingStatus") : activeForRendering ? translate("chat.working") : formatWorkedDuration(turn.startedAt, turn.completedAt, mergedItems),
    [activeForRendering, mergedItems, turn.completedAt, turn.startedAt, turn.status, i18nLocale],
  );
  const interruptedLabel =
    turn.status === 'interrupted' ? (
      <span className="thread-graph-worked-interrupted shrink-0 text-[11px]">
        {translate("chat.interrupted")}</span>
    ) : null;
  const hasCollapsedHiddenItems =
    collapsedSummary.hiddenEntries.length > 0 || Boolean(turn.hasDeferredItems) || Boolean(peerWorkChildren);
  const effectiveCollapsed = isCollapsed && hasCollapsedHiddenItems;
  const visibleSummaryAgent = collapsedSummary.summaryAgent;
  const answerSections = useMemo(() =>
    groupedItems.some(entry => entry.kind === 'item' && isSubstantiveAnswer(entry.item) && (entry.item.id !== visibleSummaryAgent?.id || Array.from(entry.item.text.trim()).length >= 300))
      ? groupAnswerSections(groupedItems.filter(entry => entry.kind !== 'item' || entry.item.kind !== 'userMessage'), visibleSummaryAgent?.id) : null,
    [groupedItems, visibleSummaryAgent?.id]);

  const canToggleWorkedSummary =
    hasCollapsedHiddenItems;
  const activityCounts = useMemo(() => turnActivity(turn, mergedItems), [turn, mergedItems]);
  const summaryParts = hasActivity(activityCounts) ? activityParts(activityCounts) : [];
  const changedFiles = useMemo(() => turnChangedFiles(turn, mergedItems), [turn, mergedItems]);
  // Only a finished turn is told from its summary; a working one loads as it streams.
  const story = effectiveCollapsed || !isTerminalTurnStatus(turn.status) ? null : storySegments(turn);
  // Time and usage close the turn, under its answer, instead of crowding the work line.
  const receiptNode = isTerminalTurnStatus(turn.status) ? (
    <div className="thread-turn-receipt">
      <time dateTime={turn.startedAt ?? undefined} title={turnTimeTitle}>{turnTimeLabel}</time>
      <TurnUsageInline turn={turn} speedMode="average" />
    </div>
  ) : null;
  const terminalWorkedNode =
    isTerminalTurnStatus(turn.status) && !hasCollapsedHiddenItems ? (
      <div className="thread-graph-worked-summary flex w-full items-center gap-2 py-2 text-sm">
        <TranscriptAgentByline />
        <span className="thread-graph-worked-label shrink-0">
          {workedLabel}
        </span>
        {interruptedLabel}
        <ActivitySummary parts={summaryParts} />
        <span
          className="thread-graph-worked-rule h-px min-w-0 flex-1"
          aria-hidden="true"
        />
      </div>
    ) : null;
  const leadingUserCount = groupedItems.findIndex(
    (entry) => !(entry.kind === 'item' && entry.item.kind === 'userMessage'),
  );
  const renderSummaryAgent = (item: ThreadHistoryItemDto & { kind: 'agentMessage' }) => (
    <CompactMessageItem
      threadId={threadId}
      item={item}
      streaming={activeForRendering && isRunningHistoryStatus(item.status)}
      scrollRootRef={scrollRootRef}
      timeTitle={item.createdAt ? formatLongTimestamp(item.createdAt) : turnTimeTitle}
      {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      {...(adapter ? { adapter } : {})}
    />
  );
  // While a folded turn works, the operation after its latest narration says what it is doing now.
  const currentOperation = useMemo(() => {
    if (!activeForRendering) return null;
    const narration = visibleSummaryAgent ? mergedItems.findIndex(item => item.id === visibleSummaryAgent.id) : -1;
    const index = mergedItems.findLastIndex(item => isLogItem(item) && item.kind !== 'reasoning');
    return index > narration ? mergedItems[index]! : null;
  }, [activeForRendering, mergedItems, visibleSummaryAgent]);
  const collapsedSummaryNode =
    hasCollapsedHiddenItems ? (
      <div className="thread-graph-turn-collapsed-summary space-y-2">
        {(effectiveCollapsed ? collapsedSummary.users : collapsedSummary.users.slice(0, Math.max(0, leadingUserCount))).map((item) => (
          <CompactMessageItem
            key={item.id}
            threadId={threadId}
            item={item}
            scrollRootRef={scrollRootRef}
            timeTitle={
              item.createdAt
                ? formatLongTimestamp(item.createdAt)
                : turnTimeTitle
            }
            {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
            {...(adapter ? { adapter } : {})}
          />
        ))}
        <div className="thread-graph-worked-summary flex w-full items-center gap-2 py-2 text-sm">
          <TranscriptAgentByline />
          <button
            type="button"
            className="thread-worked-toggle group flex min-w-0 items-center gap-2 text-left transition"
            onClick={() => onToggleCollapse(turn, effectiveCollapsed)}
            disabled={deferredItemsLoading}
            aria-label={translate("chat.turn_6e6e38", { value1: workedLabel, value2: effectiveCollapsed ? translate("chat.expand") : translate("chat.collapse"), value3: absoluteIndex })}
            aria-expanded={!effectiveCollapsed}
            aria-busy={deferredItemsLoading}
          >
            <ChevronRight className={`thread-worked-chevron h-4 w-4 shrink-0 transition ${effectiveCollapsed ? '' : 'rotate-90'}`} />
            <span className="thread-graph-worked-label shrink-0">
              {deferredItemsLoading
                ? <ThreadLoadingIndicator inline label={translate("chat.loadingCompleteHistory")} />
                : deferredItemsError
                  ? translate("chat.historyUnavailableRetry")
                  : workedLabel}
            </span>
            {interruptedLabel}
            {summaryParts.length
              ? <ActivitySummary parts={summaryParts} />
              : <span className="thread-execution-step-count">{stepCount + peerWorkSteps} {translate("chat.steps")}</span>}
          </button>
          <span
            className="thread-graph-worked-rule h-px min-w-0 flex-1"
            aria-hidden="true"
          />
        </div>
        {effectiveCollapsed ? <>
          {isTerminalTurnStatus(turn.status) ? <ChangedFiles files={changedFiles} total={activityCounts?.changedFiles} /> : null}
          {answerSections ? <div className="thread-answer-sequence">
            {answerSections.map(entry => entry.kind === 'item' ? (
              <div className="thread-answer-section" key={entry.key}>
                {entry.item.kind !== 'agentMessage' ? renderHistoryEntries([entry]) : <CompactMessageItem threadId={threadId} item={entry.item as ThreadHistoryItemDto & { kind: 'agentMessage' }}
                  streaming={entry.item.id === visibleSummaryAgent?.id && activeForRendering && isRunningHistoryStatus(entry.item.status)}
                  scrollRootRef={scrollRootRef}
                  timeTitle={entry.item.createdAt ? formatLongTimestamp(entry.item.createdAt) : turnTimeTitle}
                  {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
                  {...(adapter ? { adapter } : {})} />}
              </div>
            ) : !turn.hasDeferredItems ? (
              <div className="thread-execution-timeline" key={entry.key}>
                {renderHistoryEntries([entry], { collapsed: true, onExpand: () => onToggleCollapse(turn, true) })}
              </div>
            ) : null)}
          </div> : null}
          {visibleSummaryAgent && !answerSections?.some(entry => entry.kind === 'item' && entry.item.id === visibleSummaryAgent.id)
            ? renderSummaryAgent(visibleSummaryAgent) : null}
          {currentOperation ? <div className="tlog-current"><LogRow key={currentOperation.id} item={currentOperation} /></div> : null}
        </> : story ? <>
          {isTerminalTurnStatus(turn.status) ? <ChangedFiles files={changedFiles} total={activityCounts?.changedFiles} /> : null}
          {/* Narration from the summary, with each stretch of work as a run that loads when opened. */}
          <div className="thread-execution-timeline is-story">
            {storyBlocks(leadingUserCount < 0 ? [] : groupedItems.slice(leadingUserCount), story).map((block) => block.kind === 'run'
              ? <RunPlaceholder key={`run:${block.segment.before ?? 'end'}`} segment={block.segment} loading={deferredItemsLoading}
                  onOpen={() => { setOpenRunBefore(block.segment.before); onToggleCollapse(turn, true, true); }} />
              : renderHistoryEntries([block.entry]))}
            {peerWorkChildren}
          </div>
        </> : <>
          {/* Opened, the turn reads in order: narration, runs of work, the answer. */}
          <div className="thread-execution-timeline">
            {renderHistoryEntries(leadingUserCount < 0 ? [] : groupedItems.slice(leadingUserCount))}
            {peerWorkChildren}
          </div>
          {visibleSummaryAgent && !mergedItems.some(item => item.id === visibleSummaryAgent.id)
            ? renderSummaryAgent(visibleSummaryAgent) : null}
        </>}
        {receiptNode}
        {activeForRendering ? <GraphChatTurnBody
          footer={footerNode}
          history={null}
          liveHookPrompt={liveHookPromptNode}
          liveOutput={liveOutputNode}
          livePlan={displayedLivePlan}
        /> : null}
      </div>
    ) : null;
  // Prompt, what the agent did, then its answer and the receipt.
  const terminalHistoryNode =
    terminalWorkedNode && leadingUserCount > 0 ? (
      <>
        {renderHistoryEntries(groupedItems.slice(0, leadingUserCount))}
        {terminalWorkedNode}
        {renderHistoryEntries(groupedItems.slice(leadingUserCount))}
        {receiptNode}
      </>
    ) : (
      <>{historyNode}{terminalWorkedNode}{receiptNode}</>
    );
  const turnBody = (
    <GraphChatTurnBody
      footer={footerNode}
      history={terminalHistoryNode}
      liveHookPrompt={liveHookPromptNode}
      liveOutput={liveOutputNode}
      livePlan={displayedLivePlan}
    />
  );

  if (nestedPeerWork) return <MessageExpansionScope key={`${threadId ?? ''}:${turn.id}`}>
    <div className="thread-peer-execution">{historyNode}{liveHookPromptNode}{liveOutputNode}
      {turn.error ? <p role="alert">{turn.error}</p> : null}
    </div>
  </MessageExpansionScope>;

  return (
    <MessageExpansionScope key={`${threadId ?? ''}:${turn.id}`}>
    <GraphChatTurnFrame
      absoluteIndex={absoluteIndex}
      body={canToggleWorkedSummary ? collapsedSummaryNode : turnBody}
      collapsed={effectiveCollapsed}
      collapsedBody={collapsedSummaryNode}
      error={turn.error}
      headerStatus={<TurnStatusBar turn={turn} />}
      isActive={activeForRendering}
      status={turn.status}
      refCallback={articleRef}
      startedAt={turn.startedAt}
      timeLabel={turnTimeLabel}
      timeTitle={turnTimeTitle}
      tokenSummary={<TurnTokenSummary turn={turn} />}
    />
    </MessageExpansionScope>
  );
});

interface TimelineHistoryEntriesProps {
  entries: TimelineHistoryEntry[];
  expandedGroups: Record<string, boolean>;
  onToggleGroupedItem: (groupKey: string, currentExpanded: boolean) => void;
  /** Open the run before this item (null: the last run), once the turn has loaded. */
  openRunBefore?: string | null;
  threadId: string | undefined;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  fallbackTimestamp?: string | null | undefined;
  fallbackTimeLabel?: string | null | undefined;
  fallbackTimeTitle?: string | null | undefined;
  turnStartedAt?: string | null | undefined;
  autoOpenLatestToolDetails?: boolean;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: () => void;
  adapter?: ThreadTimelineAdapter | undefined;
}

function TimelineHistoryEntries({
  entries,
  expandedGroups,
  onToggleGroupedItem,
  threadId,
  scrollRootRef,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  adapter,
  fallbackTimestamp,
  fallbackTimeLabel,
  fallbackTimeTitle,
  turnStartedAt,
  autoOpenLatestToolDetails = false,
  openRunBefore,
}: TimelineHistoryEntriesProps) {
  const { locale: i18nLocale } = useI18n();
  const latestEntryKey = entries.at(-1)?.key ?? null;
  const relativeTimeMeta = useCallback(
    (timestamp: string | null | undefined, endTimestamp?: string | null) =>
      timestamp ? (
        <TimelineTimeToggle
          absoluteLabel={formatShortTimestamp(timestamp)}
          timestamp={timestamp}
          endTimestamp={endTimestamp}
          displayMode={endTimestamp ? 'duration' : 'offset'}
          turnStartedAt={turnStartedAt ?? fallbackTimestamp}
        />
      ) : null,
    [fallbackTimestamp, turnStartedAt],
  );

  const renderItem = (item: ThreadHistoryItemDto, key: string) => {
    const timestamp = timestampForHistoryItem(item, fallbackTimestamp ?? null);
    const isUserMessage = item.kind === 'userMessage';
    const isAgentMessage = item.kind === 'agentMessage' || item.kind === 'reasoning';
    const timeLabel = isUserMessage
      ? formatMessageTimestamp(timestamp)
      : isAgentMessage
        ? formatPreciseMessageTimestamp(timestamp)
        : fallbackTimeLabel;
    return (
      <HistoryItemRow
        key={key}
        threadId={threadId}
        item={item}
        scrollRootRef={scrollRootRef}
        // Messages read as one log; their time shows on hover.
        timeLabel={isAgentMessage || isUserMessage ? null : timeLabel}
        timeTitle={item.createdAt ? formatLongTimestamp(timestamp) : fallbackTimeTitle}
        timeMeta={relativeTimeMeta(timestamp)}
        autoOpenToolDetails={autoOpenLatestToolDetails && key === latestEntryKey}
        onOpenExpandedText={onOpenExpandedText}
        onOpenCommandDetail={onOpenCommandDetail}
        onOpenToolCallDetail={onOpenToolCallDetail}
        onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
        {...(onSelectArtifact ? { onSelectArtifact } : {})}
        {...(adapter ? { adapter } : {})}
      />
    );
  };

  const blocks = logBlocks(entries);
  const lastKey = blocks.at(-1)?.key;
  const lastRunKey = blocks.findLast((block) => block.kind === 'run')?.key;
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'item') {
          // A lone operation between messages is already one line.
          return isLogItem(block.item)
            ? <div key={block.key} className="tlog-single"><LogRow item={block.item} defaultOpen={opensDiff(block.item)} /></div>
            : renderItem(block.item, block.key);
        }
        // The run that is still working stays open until the reader closes it.
        const live = autoOpenLatestToolDetails && block.key === lastKey && block.items.some(item => isRunningHistoryStatus(item.status));
        const next = blocks[index + 1];
        const opened = openRunBefore === null ? block.key === lastRunKey
          : openRunBefore !== undefined && next?.kind === 'item' && next.item.id === openRunBefore;
        const expanded = expandedGroups[block.key] ?? expandedGroups[block.parentKey] ?? (live || opened);
        return (
          <LogRun
            key={block.key}
            items={block.items}
            expanded={expanded}
            live={live}
            onToggle={() => onToggleGroupedItem(block.key, expanded)}
          />
        );
      })}
    </>
  );
}

type LogBlock =
  | { kind: 'item'; key: string; item: ThreadHistoryItemDto }
  | { kind: 'run'; key: string; parentKey: string; items: ThreadHistoryItemDto[] };

/** Messages and notices stay in the reading flow; operations between them form runs. */
function logBlocks(entries: TimelineHistoryEntry[]): LogBlock[] {
  const blocks: LogBlock[] = [];
  for (const entry of entries) {
    if (entry.kind === 'item') {
      blocks.push({ kind: 'item', key: entry.key, item: entry.item });
      continue;
    }
    let run: ThreadHistoryItemDto[] = [];
    let first = true;
    const flush = () => {
      if (run.length === 1) blocks.push({ kind: 'item', key: run[0]!.id, item: run[0]! });
      else if (run.length) blocks.push({ kind: 'run', key: first ? entry.key : `${entry.key}@${run[0]!.id}`, parentKey: entry.key, items: run });
      if (run.length) first = false;
      run = [];
    };
    for (const item of flattenHistoryEntries([entry])) {
      if (isLogItem(item)) run.push(item);
      else {
        flush();
        blocks.push({ kind: 'item', key: item.id, item });
      }
    }
    flush();
  }
  return blocks;
}

function flattenHistoryEntries(entries: TimelineHistoryEntry[]): ThreadHistoryItemDto[] {
  return entries.flatMap((entry) =>
    entry.kind === 'item' ? [entry.item]
      : entry.kind === 'agentActivityGroup' ? flattenHistoryEntries(entry.entries)
        : entry.items);
}

type StoryBlock =
  | { kind: 'entry'; entry: TimelineHistoryEntry }
  | { kind: 'run'; segment: ThreadTurnActivitySegmentDto };

/** A folded turn's summary items in order, each preceded by the work before it. */
function storyBlocks(entries: TimelineHistoryEntry[], segments: ThreadTurnActivitySegmentDto[]): StoryBlock[] {
  const before = new Map(segments.flatMap((segment) => segment.before ? [[segment.before, segment] as const] : []));
  const blocks: StoryBlock[] = [];
  for (const item of flattenHistoryEntries(entries)) {
    const segment = before.get(item.id);
    if (segment) blocks.push({ kind: 'run', segment });
    blocks.push({ kind: 'entry', entry: { kind: 'item', key: item.id, item } });
  }
  const end = segments.find((segment) => segment.before === null);
  if (end) blocks.push({ kind: 'run', segment: end });
  return blocks;
}
