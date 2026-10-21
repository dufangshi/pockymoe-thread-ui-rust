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
    const head = container.querySelector<HTMLButtonElement>(".thread-composer-pending-wake-head")!;
    expect(head.textContent).toBe("Waiting for wakexa-oildc65117b");
    expect([...head.querySelectorAll("[data-status]")].map((mark) => mark.getAttribute("data-status"))).toEqual(["running", "idle"]);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    await act(async () => head.click());
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".thread-composer-pending-wake-body")?.textContent).toContain("one of them is blocked");
  });
});
