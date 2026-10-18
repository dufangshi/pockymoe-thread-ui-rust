// @vitest-environment jsdom
import { act, useRef } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompactComposer } from "./useCompactComposer";

let root: Root;
let host: HTMLDivElement;
let portal: HTMLDivElement;

function Fixture() {
  const ref = useRef<HTMLFormElement>(null);
  const { expanded, focusOwner, ...events } = useCompactComposer(ref, true);
  return (
    <>
      <form
        ref={ref}
        data-composer-focus-owner={focusOwner}
        data-expanded={expanded}
        {...events}
      >
        <div data-slot="input-group">
          <div contentEditable role="textbox" suppressContentEditableWarning>
            {"one\ntwo"}
          </div>
          <div data-slot="input-group-addon">
            <button type="button">Tool</button>
          </div>
        </div>
        {createPortal(<button type="button">Portal action</button>, portal)}
      </form>
      <button type="button">Outside</button>
      <div data-thread-transcript=""><p>Conversation</p></div>
    </>
  );
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await vi.runOnlyPendingTimersAsync();
  });
}

function button(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (node) => node.textContent === text,
  )!;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  host = document.createElement("div");
  portal = document.createElement("div");
  document.body.append(host, portal);
  root = createRoot(host);
  await settle(() => root.render(<Fixture />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  portal.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tap = (target: Element) => {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

describe("composer interaction scope", () => {
  it("opens with focus on overflowing text and stays open through other controls, outside focus and outside presses", async () => {
    const editor = host.querySelector<HTMLDivElement>('[role="textbox"]')!;
    const form = host.querySelector("form")!;
    await settle(() => editor.focus());
    expect(form.dataset.expanded).toBe("true");
    await settle(() => button("Tool").focus());
    await settle(() => button("Portal action").focus());
    expect(form.dataset.expanded).toBe("true");
    await settle(() => { tap(button("Outside")); button("Outside").focus(); });
    expect(form.dataset.expanded).toBe("true");
    await settle(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(form.dataset.expanded).toBe("true");
  });

  it("folds only when the conversation is tapped, and opens again from the composer", async () => {
    const editor = host.querySelector<HTMLDivElement>('[role="textbox"]')!;
    const form = host.querySelector("form")!;
    const conversation = host.querySelector("[data-thread-transcript] p")!;
    await settle(() => editor.focus());
    expect(form.dataset.expanded).toBe("true");
    // A drag that scrolls the conversation has no click.
    await settle(() => conversation.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(form.dataset.expanded).toBe("true");
    await settle(() => { tap(conversation); editor.blur(); });
    expect(form.dataset.expanded).toBe("false");
    await settle(() => tap(button("Tool")));
    expect(form.dataset.expanded).toBe("true");
  });

  it("opens as soon as the reader edits, and a composition keeps it open", async () => {
    const editor = host.querySelector<HTMLDivElement>('[role="textbox"]')!;
    const form = host.querySelector("form")!;
    await settle(() => {
      editor.textContent = "";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(form.dataset.expanded).toBe("false");
    await settle(() => editor.focus());
    expect(form.dataset.expanded).toBe("true");
    await settle(() => {
      editor.dataset.imeComposing = "true";
      editor.textContent = "a long dictated sentence\nthat runs past one line";
      editor.dispatchEvent(new Event("compositionupdate", { bubbles: true }));
    });
    expect(form.dataset.expanded).toBe("true");
  });

  it("returns to one line when left empty", async () => {
    const editor = host.querySelector<HTMLDivElement>('[role="textbox"]')!;
    const form = host.querySelector("form")!;
    await settle(() => editor.focus());
    expect(form.dataset.expanded).toBe("true");
    await settle(() => {
      editor.textContent = "";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Still editing: the tools stay.
    expect(form.dataset.expanded).toBe("true");
    await settle(() => editor.blur());
    expect(form.dataset.expanded).toBe("false");
  });
});
