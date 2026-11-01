import {
  Fragment,
  memo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Bot,
  Clock3,
  DollarSign,
  Folder,
  Layers,
  ListRestart,
} from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { StatusMark, navigationStatusLabel } from '../StatusMark';
import { formatCompactUsd } from '../timeline/tokenFormatting';
import { DeviceMenu, DeviceStateMark } from './MapChrome';
import { DenseLayout, type DenseBox } from './density';
import { heatLevel, isLive, isWaiting, type MapNode } from './model';
import { ReadableMap, type ReadableMapProps } from './ReadableMap';
import { AgentChip, formatShortDuration, threadDetails } from './ThreadTile';
import type { SpatialTarget } from './stableLayout';

function status(n: MapNode) {
  const t = n.thread!;
  return isWaiting(t)
    ? 'waiting'
    : isLive(t)
      ? 'running'
      : t.failed
        ? 'failed'
        : t.interrupted
          ? 'interrupted'
          : t.unread
            ? 'unread'
            : 'idle';
}
const DenseTile = memo(
  function DenseTile({
    box,
    node,
    current,
    dimmed,
    onOpen,
    onQuickLook,
    hover,
    hours,
    navigate,
  }: {
    box: DenseBox['rect'];
    node: MapNode;
    current: boolean;
    dimmed: boolean;
    onOpen: ReadableMapProps['onOpen'];
    onQuickLook: ReadableMapProps['onQuickLook'];
    hover: ReadableMapProps['hover'];
    hours: number;
    navigate: ReadableMapProps['navigate'];
  }) {
    useI18n();
    const t = node.thread!,
      mark = status(node),
      detailed = box.height >= 72;
    return (
      <div
        className="thread-map-tile thread-map-dense-tile"
        data-map-id={node.id}
        data-tier={
          box.height >= 72 ? 'stats' : box.height >= 52 ? 'two' : 'one'
        }
        data-heat={heatLevel(t.activeMs)}
        data-current={current || undefined}
        data-dimmed={dimmed || undefined}
        data-running={(isLive(t) && !isWaiting(t)) || undefined}
        data-waiting={isWaiting(t) || undefined}
        style={
          {
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          } as CSSProperties
        }
      >
        <a
          href={t.href}
          className="thread-map-tile-link"
          aria-current={current ? 'page' : undefined}
          aria-label={[t.title, navigationStatusLabel(mark)].join(' · ')}
          onClick={onOpen(t)}
          {...hover(() => threadDetails(node, hours))}
        />
        <span className="thread-map-dense-head">
          <StatusMark status={mark} />
          <AgentChip agent={t.agent} />
          <span className="thread-map-tile-title">{t.title}</span>
        </span>
        {t.unread && mark !== 'unread' && (
          <span className="thread-map-dense-unread">
            <StatusMark status="unread" />
          </span>
        )}
        {detailed && (
          <span className="thread-map-dense-stats">
            {t.turns != null && (
              <span
                title={translate('workbench.threadMapTurns', {
                  count: t.turns,
                })}
              >
                <ListRestart aria-hidden="true" />
                {t.turns}
              </span>
            )}
            {!!t.totalMs && (
              <span
                title={translate('workbench.threadMapTotalRan', {
                  duration: formatShortDuration(t.totalMs),
                })}
              >
                <Clock3 aria-hidden="true" />
                {formatShortDuration(t.totalMs)}
              </span>
            )}
            {t.priceEstimate && (
              <span
                title={translate('workbench.threadMapCost', {
                  usd: formatCompactUsd(t.priceEstimate.totalUsd),
                })}
              >
                <DollarSign aria-hidden="true" />
                {formatCompactUsd(t.priceEstimate.totalUsd).replace(/^\$/, '')}
              </span>
            )}
            {!!t.children?.length && (
              <button
                type="button"
                onClick={() => navigate(node)}
                aria-label={translate('workbench.threadMapShowChildren', {
                  count: t.children.length,
                  title: t.title,
                })}
              >
                <Bot aria-hidden="true" />
                {t.children.length}
              </button>
            )}
          </span>
        )}
        {detailed && box.width >= 160 && onQuickLook && (
          <button
            type="button"
            className="thread-map-quick-look"
            aria-label={translate('workbench.threadMapQuickLook', {
              title: t.title,
            })}
            onClick={() => onQuickLook(t.key)}
          >
            ⓘ
          </button>
        )}
      </div>
    );
  },
  (a, b) =>
    a.node.thread === b.node.thread &&
    a.box.x === b.box.x &&
    a.box.y === b.box.y &&
    a.box.width === b.box.width &&
    a.box.height === b.box.height &&
    a.current === b.current &&
    a.dimmed === b.dimmed &&
    a.onQuickLook === b.onQuickLook,
);

/** Flat rectangles share the same coordinate space: headers consume exactly one
 * line, without nested card borders, padding or a second layer of gutters. */
export function DenseMap(props: ReadableMapProps) {
  useI18n();
  const cache = useRef(new DenseLayout());
  const {
    current,
    bounds,
    frozen,
    version,
    navigate,
    hover,
    query,
    matches,
    extras,
  } = props;
  const boxes = cache.current.layout(current, bounds, frozen, version);
  if (
    (current.kind === 'workspace' || current.kind === 'thread') &&
    boxes.some((b) => b.overflow)
  )
    return <ReadableMap {...props} />;
  const targets: SpatialTarget[] = [];
  const render = (items: DenseBox[]): ReactNode =>
    items.map((box) => {
      const { node, rect, overflow } = box;
      if (overflow) {
        const id = `overflow:${node.parent?.id ?? current.id}`;
        targets.push({ id, rect });
        const label = translate('workbench.threadMapRemainingThreads', {
          count: overflow.length,
        });
        return (
          <button
            key={id}
            type="button"
            className="thread-map-overflow thread-map-dense-overflow"
            data-map-id={id}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
            aria-label={label}
            onClick={() => navigate(node.parent ?? current)}
            {...hover([label, ...overflow.slice(0, 5).map((n) => n.label)])}
          >
            <Layers aria-hidden="true" />
            <span>+{overflow.length}</span>
          </button>
        );
      }
      if (node.thread) {
        targets.push({ id: node.id, rect });
        return (
          <DenseTile
            key={node.id}
            box={rect}
            node={node}
            current={node.thread.key === props.currentKey}
            dimmed={Boolean(query.trim()) && !matches(node)}
            onOpen={props.onOpen}
            onQuickLook={props.onQuickLook}
            hover={hover}
            hours={props.hours}
            navigate={navigate}
          />
        );
      }
      const device = node.kind === 'device',
        extra = device ? extras?.[node.device!.id] : undefined;
      return (
        <Fragment key={node.id}>
          <section
            className="thread-map-dense-section"
            data-map-id={node.id}
            data-kind={node.kind}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            <div
              className="thread-map-dense-header"
              style={{
                left: 0,
                top: 0,
                width: rect.width,
                height: device ? 22 : 18,
              }}
            >
              <button
                type="button"
                className="thread-map-section-head"
                onClick={() => navigate(node)}
                {...hover([
                  node.label,
                  translate('workbench.threadMapThreads', {
                    count: node.threads,
                  }),
                  ...(extra?.metrics ? [extra.metrics] : []),
                ])}
              >
                {device ? <DeviceStateMark /> : <Folder aria-hidden="true" />}
                <span className="thread-map-section-label">{node.label}</span>
                {device && extra?.latencyMs != null && rect.width > 180 && (
                  <small>{Math.round(extra.latencyMs)} ms</small>
                )}
              </button>
              {device && extra?.menuItems?.length ? (
                <DeviceMenu device={node.device!} items={extra.menuItems} />
              ) : null}
            </div>
          </section>
          {render(box.children ?? [])}
        </Fragment>
      );
    });
  const content = render(boxes);
  props.register(targets);
  return <>{content}</>;
}
