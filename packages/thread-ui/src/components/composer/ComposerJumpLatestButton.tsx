import { ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';

import { translate, useI18n } from '../../i18n';
import { WorkbenchPaneSwitchButton, useWorkbenchPaneSwitch } from '../workbench/paneSwitch';
import { usePhoneDock } from '../workbench/phoneDockContext';

type JumpLatestProps = {
  followTail: boolean;
  onToggleFollow?: (() => void) | undefined;
  canJumpToPreviousTurn?: boolean | undefined;
  onJumpToPreviousTurn?: (() => void) | undefined;
  canJumpToNextTurn?: boolean | undefined;
  onJumpToNextTurn?: (() => void) | undefined;
};

export function ComposerJumpLatestButton({
  activeView,
  ...props
}: JumpLatestProps & { activeView: 'chat' | 'shell' }) {
  // Only a rendered strip may claim the phone split switch for its pane.
  return activeView === 'chat' ? <JumpLatestStrip {...props} /> : null;
}

/** Turn navigation above the composer, at its right edge. Only what can act
    shows: at the tail just "previous turn"; away from it, previous and next
    turn and a labelled "Latest". A phone shows only "Latest", and only away
    from the tail, so nothing sits over the text while reading the newest reply.
    A phone split's conversation switches sit on the left, unless the phone
    dock holds them. */
function JumpLatestStrip({
  followTail,
  onToggleFollow,
  canJumpToPreviousTurn,
  onJumpToPreviousTurn,
  canJumpToNextTurn,
  onJumpToNextTurn,
}: JumpLatestProps) {
  useI18n();
  const split = useWorkbenchPaneSwitch();
  const paneSwitch = usePhoneDock() ? null : split;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[90] h-11 -translate-y-full bg-transparent touch-manipulation sm:h-10">
      <div className={`thread-jump-latest-cluster ${paneSwitch ? 'has-pane-switch' : ''}`}>
        {paneSwitch && <div className="thread-jump-panes">
          <WorkbenchPaneSwitchButton target="primary" value={paneSwitch} />
          <WorkbenchPaneSwitchButton target="reference" value={paneSwitch} />
        </div>}
        {/* thread-jump-latest-badge: the old name, kept for imported theme packs. */}
        <div role="group" aria-label={translate("chat.timelineNavigation")} className="thread-jump-nav thread-jump-latest-badge" data-following={followTail || undefined}>
          <button
            type="button"
            className="thread-jump-turn"
            data-turn="previous"
            hidden={!canJumpToPreviousTurn}
            aria-label={translate("chat.jumpToPreviousTurn")}
            title={canJumpToPreviousTurn ? translate("chat.jumpToTheStartOfThePrevious") : translate("chat.noEarlierTurn")}
            disabled={!canJumpToPreviousTurn}
            onClick={() => onJumpToPreviousTurn?.()}
          >
            <ChevronUp data-icon="previous-turn" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="thread-jump-turn"
            data-turn="next"
            hidden={!canJumpToNextTurn}
            aria-label={translate("chat.jumpToNextTurn")}
            title={canJumpToNextTurn ? translate("chat.jumpToTheStartOfTheNext") : translate("chat.noLaterTurn")}
            disabled={!canJumpToNextTurn}
            onClick={() => onJumpToNextTurn?.()}
          >
            <ChevronDown data-icon="next-turn" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="thread-jump-latest"
            data-action="jump-latest"
            aria-label={translate("chat.jumpToLatest")}
            title={followTail ? translate("chat.latestMessagesAreInView") : translate("chat.jumpToTheBottom")}
            hidden={followTail}
            onClick={() => onToggleFollow?.()}
          >
            <ArrowDown data-icon="latest" aria-hidden="true" />
            <span className="thread-jump-latest-label" aria-hidden="true">{translate('chat.latestShort')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
