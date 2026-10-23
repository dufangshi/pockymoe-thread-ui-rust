/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ComposerPendingWakes } from "./ComposerPendingWakes";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe("ComposerPendingWakes", () => {
  it("lists the delegates a wake waits on with their status, and explains when it fires", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };
    await act(async () => {
      root.render(
        <ComposerPendingWakes
          wakes={[{
            id: "w1",
            createdAt: "2026-10-21T00:00:00Z",
            members: [
              { threadId: "14b40fee-0794-4fc4-ac30-9f98cc75adfa", name: "xa-oil", status: "running" },
              { threadId: "dc65117b-8c4e-47db-abf1-26dc5888a8b4", name: null, status: "idle" },
            ],
          }]}
        />,
      );
    });
    // A small bell counting the agent threads, not a row per wake.
    const bell = container.querySelector<HTMLButtonElement>(".thread-composer-wakes-bell")!;
    expect(bell.getAttribute("aria-label")).toBe("Waiting for wake: 2 agent threads");
    expect(bell.textContent).toBe("2");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => bell.click());
    const panel = container.querySelector('[role="dialog"]')!;
    expect([...panel.querySelectorAll("[data-status]")].map((mark) => mark.getAttribute("data-status"))).toEqual(["running", "idle"]);
    expect([...panel.querySelectorAll(".thread-composer-wakes-name")].map((name) => name.textContent)).toEqual(["xa-oil", "dc65117b"]);
    expect(panel.textContent).toContain("one of them is blocked");
    // Esc and a press elsewhere close it.
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(bell);
    await act(async () => bell.click());
    await act(async () => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
