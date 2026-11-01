import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Clock3,
  DollarSign,
  Folder,
  Layers,
  ListRestart,
  Monitor,
} from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { StatusMark } from '../StatusMark';
import { AgentChip } from './ThreadTile';
import type { MapNode } from './model';
import type { MapDeviceExtras } from './types';
import { mapTipData, type MapTipData, type TipMetric } from './tooltipData';
import type { MapRect } from './squarify';

/** Prefer either side; every fallback remains outside the protected title. */
export function placeMapTooltip(
  anchor: MapRect,
  tip: { width: number; height: number },
  viewport: MapRect,
) {
  const gap = 8,
    left = viewport.x + gap,
    top = viewport.y + gap;
  const right = viewport.x + viewport.width - gap,
    bottom = viewport.y + viewport.height - gap;
  const x = Math.max(left, Math.min(right - tip.width, anchor.x));
  const y = Math.max(top, Math.min(bottom - tip.height, anchor.y));
  const candidates = [
    { x: anchor.x + anchor.width + gap, y },
    { x: anchor.x - tip.width - gap, y },
    { x, y: anchor.y + anchor.height + gap },
    { x, y: anchor.y - tip.height - gap },
  ];
  return (
    candidates.find(
      (p) =>
        p.x >= left &&
        p.y >= top &&
        p.x + tip.width <= right &&
        p.y + tip.height <= bottom &&
        (p.x >= anchor.x + anchor.width ||
          p.x + tip.width <= anchor.x ||
          p.y >= anchor.y + anchor.height ||
          p.y + tip.height <= anchor.y),
    ) ?? null
  );
}

const icons = {
  threads: Layers,
  turns: ListRestart,
  total: Clock3,
  recent: Activity,
  cost: DollarSign,
};
function Metric({ metric }: { metric: TipMetric }) {
  const Icon = icons[metric.kind];
  return (
    <span
      className="thread-map-tip-metric"
      data-metric={metric.kind}
      role="img"
      aria-label={metric.label}
      title={metric.label}
    >
      <Icon aria-hidden="true" />
      <span>
        {metric.kind === 'cost'
          ? metric.value.replace('$', '').trim()
          : metric.value}
      </span>
    </span>
  );
}
export function MapTipContent({ data }: { data: MapTipData }) {
  useI18n();
  const count = data.metrics.find((metric) => metric.kind === 'threads');
  const metrics = data.metrics.filter((metric) => metric.kind !== 'threads');
  const peak = Math.max(1, ...(data.hourly ?? []));
  return (
    <>
      <div className="thread-map-tip-header">
        {data.status && <StatusMark status={data.status} />}
        {data.agent ? (
          <span
            className="thread-map-tip-agent"
            role="img"
            aria-label={data.agentLabel}
            title={data.agentLabel}
          >
            <AgentChip agent={data.agent} />
          </span>
        ) : data.kind === 'device' ? (
          <Monitor aria-hidden="true" />
        ) : data.kind === 'workspace' ? (
          <Folder aria-hidden="true" />
        ) : null}
        <b title={data.title}>{data.title}</b>
        {count && <Metric metric={count} />}
      </div>
      {data.subtitle && (
        <p className="thread-map-tip-subtitle" title={data.subtitle}>
          {data.subtitle}
        </p>
      )}
      {metrics.length > 0 && (
        <div
          className="thread-map-tip-metrics"
          style={{ '--metrics': metrics.length } as CSSProperties}
        >
          {metrics.map((metric) => (
            <Metric key={metric.kind} metric={metric} />
          ))}
        </div>
      )}
      {data.hourly && (
        <div
          className="thread-map-tip-bars"
          data-empty-series={
            data.hourly.every((value) => value === 0) || undefined
          }
          role="img"
          aria-label={`${translate('workbench.threadMapStatRecent', { hours: 24 })} · ${translate('workbench.threadMapLegendHourly')}`}
        >
          {data.hourly.map((value, i) => (
            <i
              key={i}
              data-empty={value === 0 || undefined}
              aria-hidden="true"
              style={{ '--bar': value / peak } as CSSProperties}
            />
          ))}
        </div>
      )}
      {data.prompt && <p className="thread-map-tip-prompt">{data.prompt}</p>}
      {data.details && <p className="thread-map-tip-footer">{data.details}</p>}
      {data.footer && <p className="thread-map-tip-footer">{data.footer}</p>}
    </>
  );
}

export function MapTooltip({
  anchor,
  trigger = anchor,
  lines,
  node,
  hours = 24,
  extra,
  onClose,
  onHold,
  onLeave,
}: {
  anchor: HTMLElement;
  trigger?: HTMLElement;
  lines: string[];
  node?: MapNode;
  hours?: number;
  extra?: MapDeviceExtras;
  onClose: () => void;
  onHold?: () => void;
  onLeave?: () => void;
}) {
  useI18n();
  const element = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  const id = useId();
  const [effectiveTheme, setEffectiveTheme] = useState(
    () => document.documentElement.dataset.themeEffective,
  );
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [viewportWidth, setViewportWidth] = useState(
    () => window.visualViewport?.width ?? innerWidth,
  );
  const data = node ? mapTipData(node, hours, extra) : null;
  useLayoutEffect(() => {
    const described =
      trigger.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ??
      [];
    trigger.setAttribute(
      'aria-describedby',
      [...new Set([...described, id])].join(' '),
    );
    return () => {
      const remaining =
        trigger
          .getAttribute('aria-describedby')
          ?.split(/\s+/)
          .filter((value) => value && value !== id) ?? [];
      if (remaining.length)
        trigger.setAttribute('aria-describedby', remaining.join(' '));
      else trigger.removeAttribute('aria-describedby');
    };
  }, [trigger, id]);
  useLayoutEffect(() => {
    const update = () => {
      if (
        !anchor.isConnected ||
        !anchor.getClientRects().length ||
        !element.current
      ) {
        close.current();
        return;
      }
      const a = anchor.getBoundingClientRect(),
        t = element.current.getBoundingClientRect(),
        view = window.visualViewport;
      const viewport = {
        x: view?.offsetLeft ?? 0,
        y: view?.offsetTop ?? 0,
        width: view?.width ?? innerWidth,
        height: view?.height ?? innerHeight,
      };
      const clip = anchor
        .closest<HTMLElement>('.thread-map-list-scroll')
        ?.getBoundingClientRect();
      const visible = {
        left: Math.max(viewport.x, clip?.left ?? viewport.x),
        top: Math.max(viewport.y, clip?.top ?? viewport.y),
        right: Math.min(viewport.x + viewport.width, clip?.right ?? Infinity),
        bottom: Math.min(
          viewport.y + viewport.height,
          clip?.bottom ?? Infinity,
        ),
      };
      if (
        a.right <= visible.left ||
        a.left >= visible.right ||
        a.bottom <= visible.top ||
        a.top >= visible.bottom
      ) {
        close.current();
        return;
      }
      setViewportWidth(viewport.width);
      setEffectiveTheme(document.documentElement.dataset.themeEffective);
      let next = placeMapTooltip(a, t, viewport);
      // A single focused thread may fill the canvas. Its real title/status row
      // still stays protected when the popover must sit inside the large tile.
      if (!next) {
        const head = anchor.querySelector<HTMLElement>(
          '.thread-map-dense-head, .thread-map-tile-head, .thread-map-section-header',
        );
        if (head)
          next = placeMapTooltip(head.getBoundingClientRect(), t, viewport);
      }
      setPosition((previous) =>
        previous?.x === next?.x && previous?.y === next?.y ? previous : next,
      );
      const chip =
        element.current.querySelector<HTMLElement>('.thread-map-agent');
      if (chip)
        chip.toggleAttribute(
          'data-art',
          getComputedStyle(chip)
            .getPropertyValue('--theme-agent-avatar')
            .includes('url('),
        );
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(anchor);
    if (element.current) resize.observe(element.current);
    const theme = new MutationObserver(update);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme-preset', 'data-theme-effective'],
    });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      resize.disconnect();
      theme.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchor, trigger, node?.thread?.agent]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        close.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return createPortal(
    <div
      ref={element}
      id={id}
      role="tooltip"
      className="thread-graph-dialog thread-map-tip"
      data-structured={Boolean(data) || undefined}
      data-theme-effective={effectiveTheme}
      onPointerEnter={onHold}
      onPointerLeave={onLeave}
      style={{
        position: 'fixed',
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? 'visible' : 'hidden',
        width: Math.max(0, Math.min(300, viewportWidth - 16)),
      }}
    >
      {data ? (
        <MapTipContent data={data} />
      ) : (
        <>
          <div className="thread-map-tip-header">
            <b>{lines[0]}</b>
          </div>
          {lines.slice(1).map((line, i) => (
            <p className="thread-map-tip-subtitle" key={i}>
              {line}
            </p>
          ))}
        </>
      )}
    </div>,
    document.body,
  );
}
