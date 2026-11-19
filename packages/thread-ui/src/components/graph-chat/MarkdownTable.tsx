import { Children, isValidElement, useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';

/** Text of a cell's children, enough to tell a number from words. */
function cellText(children: ReactNode): string {
  let text = '';
  Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') text += String(child);
    else if (isValidElement<{ children?: ReactNode }>(child)) text += cellText(child.props.children);
  });
  return text;
}

// "0.42 ms", "174.64 ms", "1,600", "−3.5%", "$0.85", "26.17M": a figure with at most a short unit.
const FIGURE = /^\s*[~≈±+\-−]?[$¥€£]?\s?\d[\d,.\s]*\s?(?:[a-zA-Zµ%/]{1,6}|[万亿千个项次秒分时天]{1,2})?\s*$/u;

/** A figure keeps its number and unit on one line ("0.42 ms", never "0.42 / ms"). */
export function MarkdownCell({ as: Tag, children, className, ...props }: ComponentPropsWithoutRef<'td'> & { as: 'td' | 'th' }) {
  const figure = FIGURE.test(cellText(children));
  return <Tag {...props} className={[className, figure ? 'is-figure' : ''].filter(Boolean).join(' ') || undefined}>{children}</Tag>;
}

/**
 * A Markdown table in its own scroll box: a wide one says how many columns lie
 * past the right edge and fades there; a tall one keeps its header row in view.
 */
export function MarkdownTable({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
  useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<{ left: boolean; right: boolean; hidden: number }>({ left: false, right: false, hidden: 0 });
  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 2;
    const left = box.scrollLeft > 2;
    let hidden = 0;
    if (right) {
      const edge = box.getBoundingClientRect().right;
      box.querySelectorAll('tr:first-child > :is(th, td)').forEach(cell => {
        if (cell.getBoundingClientRect().left + 12 > edge) hidden += 1;
      });
    }
    setEdges(current => current.left === left && current.right === right && current.hidden === hidden ? current : { left, right, hidden });
  }, []);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [measure]);
  return (
    <div className="thread-table-frame" data-more-left={edges.left || undefined} data-more-right={edges.right || undefined}>
      <div ref={boxRef} className="thread-table-scroll" onScroll={measure}>
        <table {...props}>{children}</table>
      </div>
      {edges.right && edges.hidden > 0 ? (
        <span className="thread-table-more" aria-hidden="true">→ {translate('chat.tableMoreColumns', { count: edges.hidden })}</span>
      ) : null}
    </div>
  );
}
