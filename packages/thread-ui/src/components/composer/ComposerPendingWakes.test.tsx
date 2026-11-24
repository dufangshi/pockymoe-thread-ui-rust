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

  it("counts a mail wake once, names who the mail is from and lists unknown kinds by their members", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };
    const producer = { threadId: "14b40fee-0794-4fc4-ac30-9f98cc75adfa", name: "producer", status: "running" };
    await act(async () => {
      root.render(
        <ComposerPendingWakes
          wakes={[
            // `members` repeats the local sender for older clients; it is not counted again.
            { id: "m1", createdAt: "2026-11-24T00:00:00Z", kind: "mail", members: [producer], mail: { from: [producer, { threadId: "dc65117b-8c4e-47db-abf1-26dc5888a8b4", name: null, status: null }], kinds: ["result"] } },
            { id: "m2", createdAt: "2026-11-24T00:00:01Z", kind: "mail", members: [], mail: { from: [], kinds: [], inReplyTo: "q1" } },
            { id: "x1", createdAt: "2026-11-24T00:00:02Z", kind: "future", members: [{ threadId: "aa65117b-8c4e-47db-abf1-26dc5888a8b4", name: "later", status: "idle" }] },
          ]}
        />,
      );
    });
    const bell = container.querySelector<HTMLButtonElement>(".thread-composer-wakes-bell")!;
    expect(bell.textContent).toBe("3");
    expect(bell.getAttribute("aria-label")).toBe("Waiting for wake: 1 agent thread, 2 mail wakes");
    await act(async () => bell.click());
    const panel = container.querySelector('[role="dialog"]')!;
    expect([...panel.querySelectorAll('[data-kind="mail"] .thread-composer-wakes-name')].map((line) => line.textContent)).toEqual([
      "Waiting for mail from producer, dc65117b",
      "Waiting for a reply",
    ]);
    expect([...panel.querySelectorAll(".thread-composer-wakes-name")].map((name) => name.textContent)).toContain("later");
    expect(panel.textContent).toContain("when that mail arrives");
  });
});
