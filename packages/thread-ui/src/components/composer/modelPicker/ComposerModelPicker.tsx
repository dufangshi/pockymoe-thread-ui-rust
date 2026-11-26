import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, Check, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ModelOptionDto, ReasoningEffortDto, UpdateThreadSettingsInput } from '@pockymoe/shared';
import { translate, useI18n } from '../../../i18n';
import { AgentChip, useAgentArt } from '../../AgentChip';
import { CopyButton } from '../../copy/CopyButton';
import { ErrorMark } from '../../copy/ErrorMark';
import { useModalFocus } from '../../menu/useModalFocus';
import { themeAgentKey, themeAgentName } from '../../themeAgent';
import { formatCompactTokenCount } from '../../timeline/tokenFormatting';
import { ComposerMenuSurface } from '../ComposerMenuSurface';
import { ComposerReasoningSlider } from '../ComposerReasoningSlider';
import { ComposerSheet, useIsPhone } from '../ComposerSheet';
import {
  adjacentPickerAgent,
  defaultPickerModel,
  formatContextWindow,
  formatModelPrice,
  formatUsdPerMillion,
  orderPickerAgents,
  searchPickerGroups,
  visiblePickerModels,
  type ComposerModelPickerSource,
  type HandoffSummary,
  type ModelFacts,
  type ModelPickerAgent,
  type PickerGroup,
} from './modelPickerLogic';

type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: string };
type Pick = { agentId: string; model: string };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/* Rows, the search, the effort thumb and the foot's buttons, in reading order.
   The agent rail is not in the arrow order: ←/→ move between agents. */
const ITEMS = '.model-picker-search, .model-picker-row:not([disabled]), .composer-reasoning-thumb:not([data-disabled]), .model-picker-action:not([disabled])';

export interface ComposerModelPickerProps {
  model: string | null | undefined;
  modelOptions: ModelOptionDto[];
  reasoningEffort: ReasoningEffortDto | null | undefined;
  supportedEfforts: ModelOptionDto['supportedReasoningEfforts'];
  /** A turn is running: a same-agent change applies later, another agent needs it stopped. */
  running: boolean;
  liveModelSwitch: boolean;
  modelDisabled: boolean;
  effortDisabled: boolean;
  source?: ComposerModelPickerSource | undefined;
  onUpdateSettings: (input: UpdateThreadSettingsInput) => void;
  onOpenHarness?: (() => void) | undefined;
  onClose: () => void;
}

/**
 * The composer's one model picker (docs/model-settings.md): the agents this
 * thread may move to as a rail, the agent in view's models with their facts,
 * the current model's effort, and a search across every agent. Picking a model
 * of another agent switches the thread at once (a running thread first offers
 * Stop and switch); a short note says what is handed over, with a preview.
 */
export function ComposerModelPicker(props: ComposerModelPickerProps) {
  useI18n();
  const phone = useIsPhone();
  const switching = props.source?.switching;
  const currentAgentId = switching?.currentAgentId ?? '';
  const agents = useMemo(() => (switching ? orderPickerAgents(switching.agents, currentAgentId) : []), [switching, currentAgentId]);
  const showRail = agents.length > 1;
  const [view, setView] = useState(currentAgentId);
  const [query, setQuery] = useState('');
  const [loads, setLoads] = useState<Record<string, Load<ModelOptionDto[]>>>({});
  const [previews, setPreviews] = useState<Record<string, Load<HandoffSummary>>>({});
  const [pending, setPending] = useState<Pick | null>(null);
  const [busy, setBusy] = useState<Pick | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const searching = query.trim().length > 0;
  const currentModels = useMemo(() => visiblePickerModels(props.modelOptions, props.model), [props.modelOptions, props.model]);
  const modelsOf = useCallback((agentId: string): Load<ModelOptionDto[]> | undefined => {
    if (!switching || agentId === currentAgentId) return { status: 'ready', data: currentModels };
    const load = loads[agentId];
    return load?.status === 'ready' ? { status: 'ready', data: visiblePickerModels(load.data) } : load;
  }, [switching, currentAgentId, currentModels, loads]);

  // What was asked for, so a re-render (or StrictMode's second call) never asks twice.
  const asked = useRef(new Set<string>());
  const load = useCallback((agentId: string, force = false) => {
    if (!switching || agentId === currentAgentId) return;
    const key = `models\u0000${agentId}`;
    if (asked.current.has(key) && !force) return;
    asked.current.add(key);
    setLoads((current) => ({ ...current, [agentId]: { status: 'loading' } }));
    void switching.loadModels(agentId).then(
      (data) => { if (live.current) setLoads((next) => ({ ...next, [agentId]: { status: 'ready', data } })); },
      (error) => {
        asked.current.delete(key);
        if (live.current) setLoads((next) => ({ ...next, [agentId]: { status: 'error', error: message(error) } }));
      },
    );
  }, [switching, currentAgentId]);

  // The agent in view, and every agent while searching.
  useEffect(() => { if (view) load(view); }, [view, load]);
  useEffect(() => { if (searching) for (const agent of agents) load(agent.id); }, [searching, agents, load]);

  const viewModels = modelsOf(view);
  const previewTarget = view !== currentAgentId && viewModels?.status === 'ready' ? (pending?.agentId === view ? pending.model : defaultPickerModel(viewModels.data)?.model ?? null) : null;
  const countHistory = useCallback((agentId: string, model: string | null, force = false) => {
    if (!switching) return;
    const key = `history\u0000${agentId}\u0000${model ?? ''}`;
    if (asked.current.has(key) && !force) return;
    asked.current.add(key);
    setPreviews((current) => ({ ...current, [agentId]: { status: 'loading' } }));
    void switching.preview({ agentId, model }).then(
      (data) => { if (live.current) setPreviews((next) => ({ ...next, [agentId]: { status: 'ready', data } })); },
      (error) => {
        asked.current.delete(key);
        if (live.current) setPreviews((next) => ({ ...next, [agentId]: { status: 'error', error: message(error) } }));
      },
    );
  }, [switching]);
  useEffect(() => {
    if (view !== currentAgentId && viewModels?.status === 'ready') countHistory(view, previewTarget);
  }, [view, currentAgentId, viewModels?.status, previewTarget, countHistory]);

  const agentName = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? themeAgentName(agentId);
  const changeView = (agentId: string) => {
    setView(agentId);
    setShowPreview(false);
    setSwitchError(null);
  };

  const switchTo = async (agentId: string, option: ModelOptionDto, stop: boolean) => {
    if (!switching || busy) return;
    setBusy({ agentId, model: option.model });
    setSwitchError(null);
    try {
      await switching.switchTo({ agentId, model: option.model, reasoningEffort: option.defaultReasoningEffort ?? null, stop });
      if (live.current) props.onClose();
    } catch (error) {
      if (live.current) setSwitchError(message(error));
    } finally {
      if (live.current) setBusy(null);
    }
  };

  const pick = (agentId: string, option: ModelOptionDto) => {
    if (!switching || agentId === currentAgentId) {
      setPending(null);
      if (option.model !== props.model) {
        props.onUpdateSettings({ model: option.model, reasoningEffort: option.defaultReasoningEffort ?? null });
      }
      return;
    }
    if (agentId !== view) changeView(agentId);
    if (props.running) {
      setPending({ agentId, model: option.model });
      return;
    }
    void switchTo(agentId, option, false);
  };

  const root = useRef<HTMLDivElement>(null);
  useAgentArt(root, [agents, view, searching, phone]);
  // The chosen model in view, not under the fold: scroll the list (never the page) to it.
  const viewReady = viewModels?.status === 'ready';
  useLayoutEffect(() => {
    const list = root.current?.querySelector<HTMLElement>('.model-picker-list');
    const row = list?.querySelector<HTMLElement>('.model-picker-row[aria-checked="true"]');
    if (!list || !row) return;
    const head = list.querySelector<HTMLElement>('.model-picker-head')?.offsetHeight ?? 0;
    const top = row.offsetTop;
    if (top < list.scrollTop + head || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - head - (list.clientHeight - head - row.offsetHeight) / 2);
    }
  }, [view, viewReady, showPreview]);
  const focusRow = () => requestAnimationFrame(() => {
    const rows = root.current?.querySelectorAll<HTMLElement>('.model-picker-row:not([disabled])');
    const checked = root.current?.querySelector<HTMLElement>('.model-picker-row[aria-checked="true"]:not([disabled])');
    (checked ?? rows?.[0])?.focus({ preventScroll: false });
  });
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!showRail || searching || showPreview || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target as HTMLElement;
    // The effort slider keeps ←/→; the search box keeps them once it has text.
    if (target.getAttribute('role') === 'slider') return;
    event.preventDefault();
    changeView(adjacentPickerAgent(agents, view, event.key === 'ArrowRight' ? 1 : -1));
    if (target.classList.contains('model-picker-row')) focusRow();
  };

  const groups: PickerGroup[] = searching
    ? searchPickerGroups(
      (showRail ? agents : [{ id: currentAgentId, name: '' }]).flatMap((agent) => {
        const loaded = modelsOf(agent.id);
        return loaded?.status === 'ready' ? [{ agent, models: loaded.data }] : [];
      }),
      query,
    )
    : [];
  const factsOf = (option: ModelOptionDto) => props.source?.facts?.(option) ?? null;
  const shownModels = searching ? groups.flatMap((group) => group.models) : viewModels?.status === 'ready' ? viewModels.data : [];
  const showFacts = Boolean(props.source?.facts) && shownModels.some((option) => factsOf(option));
  const searchLoading = searching && agents.some((agent) => modelsOf(agent.id)?.status === 'loading');

  const row = (agentId: string, option: ModelOptionDto) => {
    const facts = factsOf(option);
    const current = agentId === currentAgentId || !switching ? option.model === props.model : false;
    const isPending = pending?.agentId === agentId && pending.model === option.model;
    const isBusy = busy?.agentId === agentId && busy.model === option.model;
    const crossAgent = Boolean(switching) && agentId !== currentAgentId;
    const label = crossAgent ? translate('chat.modelPickerSwitchTo', { agent: agentName(agentId), model: option.displayName || option.model }) : option.displayName || option.model;
    return (
      <button
        key={`${agentId}\u0000${option.id}`}
        type="button"
        role="menuitemradio"
        aria-checked={current || isPending}
        aria-label={[label, describeFacts(facts)].filter(Boolean).join(', ')}
        title={option.description || undefined}
        data-pending={isPending || undefined}
        disabled={crossAgent ? Boolean(busy) : props.modelDisabled}
        className="model-picker-row"
        onClick={() => pick(agentId, option)}
      >
        <span className="model-picker-row-name">{option.displayName || option.model}</span>
        {showFacts ? (
          <>
            <span className="model-picker-fact">{formatContextWindow(facts?.contextWindow) ?? ''}</span>
            <span className="model-picker-fact is-price">{formatModelPrice(facts) ?? ''}</span>
          </>
        ) : null}
        <span className="model-picker-row-mark" aria-hidden="true">
          {isBusy ? <Loader2 className="request-spin" /> : current || isPending ? <Check /> : null}
        </span>
      </button>
    );
  };

  const listHead = (agent: ModelPickerAgent | null, isCurrent: boolean) => (
    <div className="model-picker-head" aria-live={agent && !searching ? 'polite' : undefined}>
      <span className="model-picker-head-agent">
        {agent ? <AgentChip agent={themeAgentKey(agent.id)} /> : null}
        <span className="model-picker-head-name">{agent?.name ?? translate('chat.model')}</span>
        {agent && isCurrent && showRail ? <span className="model-picker-head-tag">{translate('chat.modelPickerCurrent')}</span> : null}
      </span>
      {showFacts ? (
        <>
          <span className="model-picker-fact">{translate('chat.modelPickerContext')}</span>
          <span className="model-picker-fact is-price">{translate('chat.modelPickerPrice')}</span>
        </>
      ) : null}
      <span className="model-picker-row-mark" />
    </div>
  );

  const viewAgent = agents.find((agent) => agent.id === view) ?? null;
  const crossView = Boolean(switching) && view !== currentAgentId && !searching;
  const preview = previews[view];

  let list: ReactNode;
  if (searching) {
    list = groups.length ? groups.map((group) => (
      <div key={group.agent.id} role="group" aria-label={group.agent.name || translate('chat.model')} className="model-picker-group">
        {listHead(showRail ? group.agent : null, group.agent.id === currentAgentId)}
        {group.models.map((option) => row(group.agent.id, option))}
      </div>
    )) : <p className="model-picker-status">{searchLoading ? translate('chat.modelPickerLoading') : translate('chat.modelPickerEmpty')}</p>;
  } else if (viewModels?.status === 'error') {
    list = (
      <p className="model-picker-status">
        {translate('chat.modelPickerLoadFailed')}
        <ErrorMark message={viewModels.error} onRetry={() => load(view, true)} />
      </p>
    );
  } else if (viewModels?.status === 'ready') {
    list = viewModels.data.length ? viewModels.data.map((option) => row(view, option)) : <p className="model-picker-status">{translate('chat.modelPickerEmpty')}</p>;
  } else {
    list = <p className="model-picker-status request-pulse">{translate('chat.modelPickerLoading')}</p>;
  }

  const pendingModels = pending ? modelsOf(pending.agentId) : undefined;
  const pendingOption = pending && pendingModels?.status === 'ready' ? pendingModels.data.find((option) => option.model === pending.model) : undefined;
  const handoffNote = crossView ? (
    <div className="model-picker-note">
      <p className="model-picker-note-line">
        {preview?.status === 'ready' ? (
          <span>
            {preview.data.resumesSession
              ? translate('chat.modelPickerResume', { count: preview.data.turns })
              : translate('chat.modelPickerHandoff', { count: preview.data.turns })}
            {preview.data.estimatedTokens > 0 ? ` · ≈${formatCompactTokenCount(preview.data.estimatedTokens)} tokens` : ''}
          </span>
        ) : preview?.status === 'error' ? (
          <span className="model-picker-note-muted">
            {translate('chat.modelPickerHandoffFailed')}
            <ErrorMark message={preview.error} onRetry={() => countHistory(view, previewTarget, true)} />
          </span>
        ) : (
          <span className="model-picker-note-muted">{translate('chat.modelPickerHandoffChecking')}</span>
        )}
        {preview?.status === 'ready' && preview.data.text ? (
          <button type="button" className="model-picker-link model-picker-action" onClick={() => setShowPreview(true)}>
            {translate('chat.modelPickerPreview')}
          </button>
        ) : null}
      </p>
      <p className="model-picker-note-muted">
        {props.running ? `${translate('chat.modelPickerStopsTurn')} · ` : ''}{translate('chat.modelPickerResets')}
      </p>
      {switchError ? (
        <p className="model-picker-note-error">
          {translate('chat.modelPickerSwitchFailed')}
          <ErrorMark message={switchError} />
        </p>
      ) : null}
      {pending && pendingOption && props.running ? (
        <button
          type="button"
          className="model-picker-stop model-picker-action"
          disabled={Boolean(busy)}
          onClick={() => void switchTo(pending.agentId, pendingOption, true)}
        >
          {busy ? <Loader2 aria-hidden="true" className="request-spin" /> : null}
          {translate('chat.modelPickerStopAndSwitch')}
          <span className="model-picker-stop-target">{agentName(pending.agentId)} · {pendingOption.displayName || pendingOption.model}</span>
        </button>
      ) : null}
    </div>
  ) : null;

  const effort = !crossView && !searching && props.supportedEfforts.length > 0 ? (
    <ComposerReasoningSlider
      key={props.model ?? ''}
      efforts={props.supportedEfforts}
      effort={props.reasoningEffort}
      defaultEffort={props.modelOptions.find((option) => option.model === props.model)?.defaultReasoningEffort}
      disabled={props.effortDisabled}
      onCommit={(next) => props.onUpdateSettings({ reasoningEffort: next })}
    />
  ) : null;
  const applies = props.running && !crossView ? (
    <p className="model-picker-note-muted model-picker-applies">
      {translate(props.liveModelSwitch ? 'chat.modelSwitchNextCall' : 'chat.modelSwitchNextTurn')}
    </p>
  ) : null;

  const column = showPreview && preview?.status === 'ready' ? (
    <div className="model-picker-column">
      <div className="model-picker-preview-head">
        <button type="button" className="model-picker-back model-picker-action" aria-label={translate('chat.modelPickerBack')} onClick={() => setShowPreview(false)}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <span className="model-picker-head-name">{translate('chat.modelPickerPreviewTitle', { agent: agentName(view) })}</span>
        <CopyButton value={preview.data.text} label={translate('chat.copyAll')} className="model-picker-copy" />
      </div>
      <pre className="model-picker-preview" tabIndex={0}>{preview.data.text}</pre>
    </div>
  ) : (
    <div className="model-picker-column">
      <label className="model-picker-search-box">
        <Search aria-hidden="true" />
        <input
          type="search"
          className="model-picker-search"
          value={query}
          placeholder={translate('chat.modelPickerSearch')}
          aria-label={translate('chat.modelPickerSearch')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Home and End move the caret, not the menu; ←/→ change agents only while empty.
            if (event.key === 'Home' || event.key === 'End') event.stopPropagation();
            if (query && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) event.stopPropagation();
            if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); setQuery(''); }
          }}
        />
      </label>
      <div className="model-picker-list" data-facts={showFacts || undefined}>
        {!searching ? listHead(viewAgent, view === currentAgentId) : null}
        {list}
      </div>
    </div>
  );

  const rail = showRail ? (
    <div className="model-picker-rail" role="group" aria-label={translate('chat.modelPickerAgents')}>
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          tabIndex={-1}
          className="model-picker-agent-tab"
          aria-pressed={view === agent.id && !searching}
          aria-label={agent.id === currentAgentId ? `${agent.name} · ${translate('chat.modelPickerCurrent')}` : agent.name}
          title={agent.name}
          data-current={agent.id === currentAgentId || undefined}
          onClick={() => { setQuery(''); changeView(agent.id); }}
        >
          <AgentChip agent={themeAgentKey(agent.id)} />
        </button>
      ))}
    </div>
  ) : null;

  const body = (
    <div ref={root} className="model-picker" data-phone={phone || undefined} onKeyDown={onKeyDown}>
      {phone ? (
        <header className="model-picker-sheet-head">
          <h3 className="model-picker-sheet-title">{translate('chat.model')}</h3>
          <button type="button" className="model-picker-close" aria-label={translate('chat.modelPickerClose')} onClick={props.onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
      ) : null}
      <div className="model-picker-main">
        {rail}
        {column}
      </div>
      {!showPreview && (handoffNote || effort || applies || props.onOpenHarness) ? (
        <div className="model-picker-foot">
          {handoffNote}
          {effort}
          {applies}
          {props.onOpenHarness ? (
            <button type="button" role="menuitem" className="model-picker-harness model-picker-action" onClick={() => { props.onClose(); props.onOpenHarness?.(); }}>
              <SlidersHorizontal aria-hidden="true" />
              {translate('settings.harnessSettings')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (phone) return <PhonePicker onClose={props.onClose} root={root}>{body}</PhonePicker>;
  return (
    <ComposerMenuSurface
      align="end"
      aria-label={translate('chat.model')}
      menu={{ onClose: props.onClose, itemSelector: ITEMS }}
      className="composer-model-menu model-picker-surface"
      data-rail={showRail || undefined}
    >
      {body}
    </ComposerMenuSurface>
  );
}

/** Phones get the picker as a bottom sheet that keeps focus inside. */
function PhonePicker({ onClose, root, children }: { onClose: () => void; root: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const trigger = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null));
  // The keyboard stays down until the search is tapped: focus starts on the current model.
  useModalFocus(root, true, onClose, '.model-picker-row[aria-checked="true"], .model-picker-row');
  return (
    <ComposerSheet label={translate('chat.model')} closeLabel={translate('chat.modelPickerClose')} trigger={trigger.current} onClose={onClose} className="model-picker-sheet">
      {children}
    </ComposerSheet>
  );
}

function describeFacts(facts: ModelFacts | null) {
  if (!facts) return '';
  const context = formatContextWindow(facts.contextWindow);
  const input = formatUsdPerMillion(facts.inputUsdPerMillion);
  const output = formatUsdPerMillion(facts.outputUsdPerMillion);
  return [
    context ? translate('chat.modelPickerContextValue', { value: context }) : '',
    input || output ? translate('chat.modelPickerPriceValue', { input: input ?? '–', output: output ?? '–' }) : '',
  ].filter(Boolean).join(', ');
}
