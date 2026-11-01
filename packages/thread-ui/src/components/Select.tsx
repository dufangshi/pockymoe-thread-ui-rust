import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useMenuKeyboard } from './menu/useMenuKeyboard';
import '../styles/form-controls.css';

export interface SelectOption { value: string | number; label: ReactNode; disabled?: boolean; hidden?: boolean; group?: string; }
export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'defaultValue' | 'onChange' | 'children' | 'name' | 'type' | 'role'> {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  options?: readonly SelectOption[];
  /** Existing option/optgroup JSX is accepted as data, never rendered as native controls. */
  children?: ReactNode;
  name?: string;
  required?: boolean;
  placeholder?: ReactNode;
}
function plainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return Children.toArray(node).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? plainText(child.props.children) : '').join('');
}
function optionChildren(children: ReactNode, group?: string, groupDisabled = false): SelectOption[] {
  const rows: SelectOption[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean; hidden?: boolean }>(child)) return;
    if (child.type === Fragment) rows.push(...optionChildren(child.props.children, group, groupDisabled));
    else if (child.type === 'optgroup') rows.push(...optionChildren(child.props.children, child.props.label, groupDisabled || Boolean(child.props.disabled)));
    else if (child.type === 'option') rows.push({ value: child.props.value ?? plainText(child.props.children), label: child.props.label ?? child.props.children,
      disabled: groupDisabled || Boolean(child.props.disabled), hidden: Boolean(child.props.hidden), ...(group ? { group } : {}) });
  });
  return rows;
}

/** Single-value app select. It retains form/label semantics while all option
 * rendering, focus and keyboard behavior belong to the shared menu system. */
export function Select({ value, defaultValue, onValueChange, options, children, name, required, placeholder, className = '', disabled, form, onKeyDown, onClick, ...buttonProps }: SelectProps) {
  const rows = useMemo(() => options ? [...options] : optionChildren(children), [options, children]);
  const firstValue = String(defaultValue ?? rows.find(row => !row.disabled && !row.hidden)?.value ?? '');
  const [internal, setInternal] = useState(firstValue), [open, setOpen] = useState(false), [invalid, setInvalid] = useState(false);
  const selected = String(value ?? internal);
  const current = rows.find(row => String(row.value) === selected);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const popupId = useId(), typeahead = useRef({ text: '', at: 0 });
  const [position, setPosition] = useState({ left: 8, top: 8, minWidth: 120, maxWidth: 320, maxHeight: 320 });
  const [thumb, setThumb] = useState({ size: 0, top: 0 });
  const close = useCallback((restore: boolean) => { setOpen(false); typeahead.current.text = ''; if (restore) trigger.current?.focus({ preventScroll: true }); }, []);
  useMenuKeyboard(menu, open, close, '[role="option"]:not([disabled])');
  const measureScroll = useCallback(() => {
    const el = viewport.current; if (!el) return;
    const size = el.scrollHeight > el.clientHeight ? Math.max(24, el.clientHeight ** 2 / el.scrollHeight) : 0;
    const top = size ? el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) * (el.clientHeight - size) : 0;
    setThumb(old => old.size === size && old.top === top ? old : { size, top });
  }, []);
  useEffect(() => {
    if (value === undefined && !rows.some(row => String(row.value) === internal && !row.hidden)) setInternal(firstValue);
  }, [rows, internal, value, firstValue]);
  useEffect(() => {
    const reset = () => { if (value === undefined) setInternal(firstValue); setInvalid(false); close(false); };
    const owner = field.current?.form; owner?.addEventListener('reset', reset);
    return () => owner?.removeEventListener('reset', reset);
  }, [value, firstValue, form, close]);
  useEffect(() => { if (disabled) close(false); }, [disabled, close]);
  useEffect(() => {
    if (!open) return;
    const typed = typeahead.current.text;
    const selectedOption = typed ? [...(menu.current?.querySelectorAll<HTMLElement>('[role="option"]:not([disabled])') ?? [])].find(option => option.textContent?.trim().toLocaleLowerCase().startsWith(typed)) : menu.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]:not([disabled])');
    selectedOption?.focus({ preventScroll: true }); selectedOption?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
      const visual = window.visualViewport, left = visual?.offsetLeft ?? 0, top = visual?.offsetTop ?? 0;
      const width = visual?.width ?? innerWidth, height = visual?.height ?? innerHeight;
      if (rect.bottom <= top || rect.top >= top + height || rect.right <= left || rect.left >= left + width) { close(false); return; }
      const below = top + height - rect.bottom - 12, above = rect.top - top - 12;
      const upwards = below < Math.min(menu.current?.scrollHeight || 240, 240) && above > below;
      const maxHeight = Math.max(32, Math.min(320, upwards ? above : below));
      const popupHeight = Math.min(menu.current?.offsetHeight || maxHeight, maxHeight);
      const maxWidth = Math.max(0, width - 16), minWidth = Math.min(rect.width, maxWidth);
      const popupWidth = Math.min(menu.current?.offsetWidth || minWidth, maxWidth);
      const next = { left: Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8)),
        top: upwards ? Math.max(top + 8, rect.top - popupHeight - 4) : rect.bottom + 4, minWidth, maxWidth, maxHeight };
      setPosition(old => Object.keys(next).every(key => old[key as keyof typeof old] === next[key as keyof typeof next]) ? old : next);
      measureScroll();
    };
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(false); };
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) place(); };
    place(); const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current); if (menu.current) observer.observe(menu.current);
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', place); window.addEventListener('scroll', scroll, true);
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => { observer.disconnect(); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); };
  }, [open, close, measureScroll]);
  const choose = (row: SelectOption) => {
    if (row.disabled) return; const next = String(row.value);
    if (value === undefined) setInternal(next); setInvalid(false); close(true);
    if (next !== selected) onValueChange?.(next);
  };
  const search = (key: string) => {
    const now = Date.now(), previous = now - typeahead.current.at < 700 ? typeahead.current.text : '';
    const text = (previous + key).toLocaleLowerCase(); typeahead.current = { text, at: now };
    const query = [...text].every(char => char === text[0]) ? text[0]! : text;
    const candidates = [...(menu.current?.querySelectorAll<HTMLElement>('[role="option"]:not([disabled])') ?? [])];
    const currentIndex = candidates.indexOf(document.activeElement as HTMLElement);
    for (let step = query.length > 1 ? 0 : 1; step <= candidates.length; step++) {
      const option = candidates[(Math.max(0, currentIndex) + step) % candidates.length];
      if (option?.textContent?.trim().toLocaleLowerCase().startsWith(query)) { option.focus(); option.scrollIntoView?.({ block: 'nearest' }); break; }
    }
  };
  const tabAway = (backwards: boolean) => {
    const candidates = [...document.querySelectorAll<HTMLElement>('button, a[href], input, textarea, [tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !menu.current?.contains(el) && !el.closest('[hidden], [inert], [aria-hidden="true"]') && el.getClientRects().length);
    const index = candidates.indexOf(trigger.current!); close(false);
    candidates[index + (backwards ? -1 : 1)]?.focus();
  };
  return <>
    <button {...buttonProps} ref={trigger} type="button" role="combobox" form={form} disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? popupId : undefined}
      aria-required={required || undefined} aria-invalid={invalid || buttonProps['aria-invalid']} className={`pm-select ${className}`} onClick={event => { onClick?.(event); if (!event.defaultPrevented) setOpen(!open); }}
      onKeyDown={event => { onKeyDown?.(event); if (event.defaultPrevented) return;
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpen(true); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { setOpen(true); typeahead.current = { text: event.key.toLocaleLowerCase(), at: Date.now() }; }
      }}>
      <span className="pm-select-value-label" title={plainText(current?.label ?? placeholder)}>{current?.label ?? placeholder ?? (selected || '—')}</span><ChevronDown size={14} data-icon="chevron-down" aria-hidden="true" />
    </button>
    <input ref={field} className="pm-select-form-value" type="text" name={name} form={form} required={required} disabled={disabled} value={selected} tabIndex={-1} aria-hidden="true" onChange={() => undefined}
      onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }} />
    {open && createPortal(<div ref={menu} id={popupId} role="listbox" aria-label={buttonProps['aria-label']} aria-labelledby={buttonProps['aria-labelledby']} className="thread-ui-shell pm-select-menu"
      data-theme-effective={document.documentElement.dataset.themeEffective} style={position}
      onKeyDownCapture={event => { if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); tabAway(event.shiftKey); } }}
      onKeyDown={event => {
        event.stopPropagation();
        if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) { event.preventDefault(); event.target.click(); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); search(event.key); }
      }}>
      <div ref={viewport} className="pm-select-options" onScroll={measureScroll} onFocusCapture={event => { (event.target as HTMLElement).scrollIntoView?.({ block: 'nearest' }); measureScroll(); }}>
        {rows.map((row, index) => row.hidden ? null : <Fragment key={`${row.value}:${index}`}>
          {row.group && row.group !== rows[index - 1]?.group ? <div className="pm-select-group" role="presentation">{row.group}</div> : null}
          <button id={`${popupId}-${index}`} type="button" role="option" tabIndex={-1} disabled={row.disabled} aria-selected={String(row.value) === selected} onClick={() => choose(row)}>
            <span>{row.label}</span><Check size={14} aria-hidden="true" data-selected={String(row.value) === selected || undefined} />
          </button>
        </Fragment>)}
      </div>
      {thumb.size > 0 && <div className="pm-select-scroll-track" aria-hidden="true"><div className="pm-select-scroll-thumb" style={{ height: thumb.size, transform: `translateY(${thumb.top}px)` }} onPointerDown={event => {
        event.preventDefault(); const el = viewport.current!; const start = event.clientY, at = el.scrollTop;
        const target = event.currentTarget; target.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => { el.scrollTop = at + (next.clientY - start) * (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - thumb.size); };
        const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
        target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
      }} /></div>}
    </div>, document.body)}
  </>;
}
