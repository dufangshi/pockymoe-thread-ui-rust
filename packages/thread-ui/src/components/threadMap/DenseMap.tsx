import { createPortal } from 'react-dom';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { MapScrollList } from './MapScrollList';
import {
  Fragment,
  memo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowUpCircle,
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
interface DenseTileProps {
  box: DenseBox['rect'];
  node: MapNode;
  current: boolean;
  dimmed: boolean;
  onOpen: ReadableMapProps['onOpen'];
  onQuickLook: ReadableMapProps['onQuickLook'];
  hover: ReadableMapProps['hover'];
  hours: number;
  navigate: ReadableMapProps['navigate'];
}
type TileContentProps = Omit<DenseTileProps, 'box' | 'dimmed'> & {
  contentTier: number;
};
/** Position changes never rebuild unchanged status SVGs, agent marks or titles. */
const DenseTileContent = memo(
  function DenseTileContent({
    node,
    current,
    onOpen,
    onQuickLook,
    hover,
    hours,
    navigate,
    contentTier,
  }: TileContentProps) {
    useI18n();
    const t = node.thread!,
      mark = status(node),
      detailed = contentTier > 0;
    return (
      <>
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
            {!!t.totalMs && contentTier >= 3 && (
              <span
                title={translate('workbench.threadMapTotalRan', {
                  duration: formatShortDuration(t.totalMs),
                })}
              >
                <Clock3 aria-hidden="true" />
                {formatShortDuration(t.totalMs)}
              </span>
            )}
            {t.priceEstimate && contentTier >= 5 && (
              <span
                title={translate('workbench.threadMapCost', {
                  usd: formatCompactUsd(t.priceEstimate.totalUsd),
                })}
              >
                <DollarSign aria-hidden="true" />
                {formatCompactUsd(t.priceEstimate.totalUsd).replace(/^\$/, '')}
              </span>
            )}
            {!!t.children?.length && contentTier >= 2 && (
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
        {detailed && contentTier >= 4 && onQuickLook && (
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
      </>
    );
  },
  (a, b) =>
    a.node.thread === b.node.thread &&
    a.node.parent?.label === b.node.parent?.label &&
    a.current === b.current &&
    a.hours === b.hours &&
    a.contentTier === b.contentTier &&
    a.onQuickLook === b.onQuickLook,
);

const DenseTile = memo(
  function DenseTile(props: DenseTileProps) {
    const { box, node, current, dimmed, ...content } = props,
      t = node.thread!,
      mark = status(node);
    // The content thresholds are independent of the rectangle's position and of
    // small width changes, so a priority promotion can move many tiles cheaply.
    const contentTier =
      box.height < 72
        ? 0
        : box.width < 110
          ? 1
          : box.width < 140
            ? 2
            : box.width < 160
              ? 3
              : box.width < 200
                ? 4
                : 5;
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
        data-running={mark === 'running' || undefined}
        data-waiting={mark === 'waiting' || undefined}
        style={
          {
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          } as CSSProperties
        }
      >
        <DenseTileContent
          {...content}
          node={node}
          current={current}
          contentTier={contentTier}
        />
      </div>
    );
  },
  (a, b) =>
    a.node.thread === b.node.thread &&
    a.node.parent?.label === b.node.parent?.label &&
    a.hours === b.hours &&
    a.box.x === b.box.x &&
    a.box.y === b.box.y &&
    a.box.width === b.box.width &&
    a.box.height === b.box.height &&
    a.current === b.current &&
    a.dimmed === b.dimmed &&
    a.onQuickLook === b.onQuickLook,
);

function OverflowCell({
  box,
  current,
  navigate,
  hover,
}: {
  box: DenseBox;
  current: MapNode;
  navigate: ReadableMapProps['navigate'];
  hover: ReadableMapProps['hover'];
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );
  const close = (restore = false) => {
    setAnchor(null);
    if (restore) trigger.current?.focus();
  };
  useMenuKeyboard(menu, Boolean(anchor), close);
  useEffect(() => {
    if (!anchor) return;
    const outside = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setAnchor(null);
    };
    const moved = (e: Event) => {
      if (!(e.target instanceof Node && menu.current?.contains(e.target)))
        setAnchor(null);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', moved);
    window.addEventListener('scroll', moved, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', moved);
      window.removeEventListener('scroll', moved, true);
    };
  }, [anchor]);
  const { rect, node, overflow: items = [] } = box,
    groups = !node.thread;
  const label = translate(
    groups
      ? node.kind === 'device'
        ? 'workbench.threadMapOtherDevices'
        : 'workbench.threadMapOtherWorkspaces'
      : 'workbench.threadMapRemainingThreads',
    { count: items.length },
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="thread-map-overflow thread-map-dense-overflow"
        data-map-id={`overflow:${node.parent?.id ?? current.id}`}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        }}
        aria-label={label}
        aria-haspopup={groups ? 'menu' : undefined}
        aria-expanded={groups ? Boolean(anchor) : undefined}
        onClick={() => {
          if (!groups) {
            navigate(node.parent ?? current);
            return;
          }
          if (anchor) {
            close();
            return;
          }
          const r = trigger.current!.getBoundingClientRect();
          setAnchor({
            left: Math.max(8, Math.min(r.left, innerWidth - 268)),
            top: Math.max(
              8,
              Math.min(
                r.bottom + 4,
                innerHeight - Math.min(360, items.length * 36 + 8) - 8,
              ),
            ),
          });
        }}
        {...hover([label, ...items.slice(0, 5).map((n) => n.label)])}
      >
        <Layers aria-hidden="true" />
        <span>+{items.length}</span>
      </button>
      {anchor &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            data-theme-effective={
              document.documentElement.dataset.themeEffective
            }
            className="thread-graph-dialog thread-map-device-menu thread-map-group-menu"
            style={{
              position: 'fixed',
              ...anchor,
              height: Math.min(360, items.length * 36 + 8),
            }}
          >
            <MapScrollList label={label}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    navigate(item);
                  }}
                >
                  <Folder aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </MapScrollList>
          </div>,
          document.body,
        )}
    </>
  );
}

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
        return (
          <OverflowCell
            key={id}
            box={box}
            current={current}
            navigate={navigate}
            hover={hover}
          />
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
                  ...(extra?.runtimeVersion
                    ? [`v${extra.runtimeVersion.replace(/^v/, '')}`]
                    : []),
                  ...(extra?.metrics ? [extra.metrics] : []),
                ])}
              >
                {device ? <DeviceStateMark /> : <Folder aria-hidden="true" />}
                <span className="thread-map-section-label">{node.label}</span>
                {device && extra?.latencyMs != null && rect.width > 180 && (
                  <small>{Math.round(extra.latencyMs)} ms</small>
                )}
              </button>
              {device && extra?.updateAvailable && (
                <span
                  className="thread-map-dense-update"
                  role="img"
                  aria-label={translate('workbench.threadMapUpdate')}
                  title={translate('workbench.threadMapUpdate')}
                >
                  <ArrowUpCircle aria-hidden="true" />
                </span>
              )}
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
