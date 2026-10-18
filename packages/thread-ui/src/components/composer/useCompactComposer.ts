import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { translate } from "../../i18n";
import { serializeEditorPrompt } from "./contentEditablePrompt";

/** Measure the rendered font and attachment chips against the *collapsed*
 * budget. The editor's current width/caret never decides the layout, avoiding
 * an expand/collapse feedback loop when the wide editor gains another row. */
export function promptExceedsCompactLine(
  editor: HTMLDivElement,
  group: HTMLElement,
  toolbar: HTMLElement,
) {
  const text = serializeEditorPrompt(editor);
  if (!text.trim() && !editor.querySelector('[data-segment-type="attachment"]'))
    return false;
  if (/[\r\n]/.test(text)) return true;
  const groupStyle = getComputedStyle(group);
  const scale = group.offsetWidth
    ? group.getBoundingClientRect().width / group.offsetWidth
    : 1;
  const gap = Number.parseFloat(groupStyle.columnGap) || 0;
  const padding =
    (Number.parseFloat(groupStyle.paddingLeft) || 0) +
    (Number.parseFloat(groupStyle.paddingRight) || 0);
  const available =
    group.getBoundingClientRect().width -
    toolbar.getBoundingClientRect().width -
    (gap + padding) * scale;
  // Hidden panes have no layout. Wait for ResizeObserver when they become visible.
  if (group.getBoundingClientRect().width <= 0) return false;
  const style = getComputedStyle(editor);
  const measurement = editor.cloneNode(true) as HTMLDivElement;
  measurement.removeAttribute("role");
  measurement.removeAttribute("contenteditable");
  measurement.removeAttribute("id");
  measurement.setAttribute("aria-hidden", "true");
  measurement.inert = true;
  Object.assign(measurement.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    width: "max-content",
    minWidth: "0",
    maxWidth: "none",
    height: "auto",
    minHeight: "0",
    maxHeight: "none",
    overflow: "visible",
    whiteSpace: "pre",
    padding: "0",
    margin: "0",
    border: "0",
    font: style.font,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    textTransform: style.textTransform,
    // The prompt is zoomed by the Text size setting; measure its line the same way.
    zoom: style.zoom || "1",
  });
  group.append(measurement);
  const width = measurement.getBoundingClientRect().width;
  measurement.remove();
  return width > Math.max(0, available) + 0.5 * scale;
}

/** The editor's own scale: rendered size over layout size (Text size zooms it). */
function editorScale(editor: HTMLElement) {
  return editor.offsetWidth ? editor.getBoundingClientRect().width / editor.offsetWidth : 1;
}

/** Lines the prompt takes once open, where it has the whole width of the group:
 *  a hidden copy of the editor laid out at that width. */
export function openPromptLines(editor: HTMLDivElement, group: HTMLElement) {
  const frame = editor.parentElement;
  const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 0;
  if (!frame || !lineHeight) return 0;
  const scale = editorScale(editor);
  const groupStyle = getComputedStyle(group);
  const groupScale = group.offsetWidth ? group.getBoundingClientRect().width / group.offsetWidth : 1;
  const padding = (Number.parseFloat(groupStyle.paddingLeft) || 0) + (Number.parseFloat(groupStyle.paddingRight) || 0);
  const width = (group.getBoundingClientRect().width - padding * groupScale) / scale;
  if (width <= 0) return 0;
  const copy = editor.cloneNode(true) as HTMLDivElement;
  copy.removeAttribute("contenteditable");
  copy.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  Object.assign(copy.style, {
    position: "absolute", visibility: "hidden", pointerEvents: "none", left: "0", top: "0",
    width: `${width}px`, height: "auto", maxHeight: "none", overflow: "visible",
  });
  frame.append(copy);
  const lines = Math.round(copy.offsetHeight / lineHeight);
  copy.remove();
  return lines;
}

export function useCompactComposer(
  formRef: RefObject<HTMLFormElement | null>,
  enabled: boolean,
) {
  const [expanded, setExpanded] = useState(false);
  const focusOwner = useId();
  // React capture also reaches portals rendered by composer descendants.
  const ownedEvents = useRef(new WeakSet<Event>());
  const captureOwnedEvent = (event: FocusEvent | ReactPointerEvent) => {
    ownedEvents.current.add(event.nativeEvent);
  };
  useLayoutEffect(() => {
    const form = formRef.current;
    const editor = form?.querySelector<HTMLDivElement>(
      '[role="textbox"][contenteditable]',
    );
    const group = form?.querySelector<HTMLElement>('[data-slot="input-group"]');
    const toolbar = form?.querySelector<HTMLElement>(
      '[data-slot="input-group-addon"]',
    );
    if (!enabled || !form || !editor || !group || !toolbar) {
      setExpanded(false);
      return;
    }
    let frame = 0;
    let alive = true;
    const ownsTarget = (target: EventTarget | null) =>
      target instanceof Node &&
      (form.contains(target) ||
        (target instanceof Element &&
          target
            .closest("[data-composer-focus-owner]")
            ?.getAttribute("data-composer-focus-owner") === focusOwner));
    const ownsEvent = (event: Event) =>
      ownedEvents.current.has(event) || ownsTarget(event.target);
    let focusWithin = ownsTarget(document.activeElement);
    // Editing opens the composer: the text takes the whole width and the tools a
    // row along its foot. Once open it stays open (other controls, the dock, a menu
    // or the keyboard closing do not fold it) until the reader taps the conversation
    // or leaves it empty. Scrolling the conversation is not a tap. Folded, it is one
    // line with only stop and send beside it.
    let opened = false;
    let pendingPointerEvent: PointerEvent | null = null;
    const measure = () => {
      if (!alive) return;
      if (pendingPointerEvent) {
        if (ownsEvent(pendingPointerEvent)) focusWithin = true;
        pendingPointerEvent = null;
      }
      const overflowing = promptExceedsCompactLine(editor, group, toolbar);
      // Apply the fade only when real content exceeds the compact budget.
      form.toggleAttribute("data-composer-overflow", overflowing);
      if (focusWithin) opened = true;
      else if (!serializeEditorPrompt(editor).trim()) opened = false;
      const next = opened;
      // A composition (dictation, an IME's underlined candidates) only ever opens
      // the composer: folding it mid-word could cancel the composition.
      const composing = editor.dataset.imeComposing === "true";
      setExpanded((current) => (current === next || (composing && current) ? current : next));
      // A folded draft says how many more lines it has when open: wrapped lines
      // of a long paragraph count as well as new lines.
      const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 0;
      const folded = form.dataset.composerLayout !== "expanded";
      const hiddenLines = overflowing && !next && folded && lineHeight > 0
        ? Math.max(0, openPromptLines(editor, group) - Math.max(1, Math.round(editor.clientHeight / lineHeight)))
        : 0;
      const inputFrame = editor.parentElement;
      if (inputFrame) {
        if (hiddenLines > 0) inputFrame.dataset.moreLines = translate("chat.moreLines", { value1: hiddenLines });
        else delete inputFrame.dataset.moreLines;
      }
      if (!next && !composing) {
        editor.scrollTop = 0;
        if (editor.parentElement) editor.parentElement.scrollTop = 0;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // A press inside the composer (its buttons, owned portals) counts as being in it.
    const onPointerDown = (event: PointerEvent) => {
      // Read after React capture has marked portal events, even if a menu
      // stops native propagation before it can reach document's bubble phase.
      pendingPointerEvent = event;
      schedule();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-thread-transcript]") || ownsEvent(event)) return;
      opened = false;
      focusWithin = ownsTarget(document.activeElement);
      schedule();
    };
    const onFocusIn = (event: globalThis.FocusEvent) => {
      focusWithin = ownsEvent(event);
      schedule();
    };
    const onFocusOut = (event: globalThis.FocusEvent) => {
      if (!ownsEvent(event)) return;
      focusWithin = ownsTarget(event.relatedTarget);
      schedule();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    editor.addEventListener("input", schedule);
    editor.addEventListener("compositionupdate", schedule);
    editor.addEventListener("compositionend", schedule);
    editor.addEventListener("load", schedule, true);
    const mutation = new MutationObserver(schedule);
    mutation.observe(editor, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-ime-composing"],
    });
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    resize?.observe(group);
    resize?.observe(toolbar);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    measure();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      form.removeAttribute("data-composer-overflow");
      if (editor.parentElement) delete editor.parentElement.dataset.moreLines;
      mutation.disconnect();
      resize?.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      editor.removeEventListener("input", schedule);
      editor.removeEventListener("compositionupdate", schedule);
      editor.removeEventListener("compositionend", schedule);
      editor.removeEventListener("load", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
    };
  }, [enabled, focusOwner, formRef]);
  return {
    expanded,
    focusOwner,
    onFocusCapture: captureOwnedEvent,
    onBlurCapture: captureOwnedEvent,
    onPointerDownCapture: captureOwnedEvent,
  };
}
