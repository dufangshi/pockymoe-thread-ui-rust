/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerPendingQueue } from "./ComposerPendingQueue";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe("ComposerPendingQueue", () => {
  it("renders queued prompts and exposes explicit steer and remove actions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };
    const onSteer = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <ComposerPendingQueue
          prompts={[{ id: "queued-1", prompt: "Inspect the failing test" }]}
          onSteer={onSteer}
          onCancel={onCancel}
        />,
      );
    });

    expect(container.textContent).toContain("Inspect the failing test");
    const steer = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Steer"),
    );
    await act(async () => {
      steer?.click();
    });
    expect(onSteer).toHaveBeenCalledWith("queued-1");

    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove queued prompt"]',
    );
    await act(async () => {
      remove?.click();
    });
    expect(onCancel).toHaveBeenCalledWith("queued-1");
  });

  it("shows optimistic prompts as queueing without premature actions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(
        <ComposerPendingQueue
          prompts={[
            { id: "optimistic-1", prompt: "Queued locally", optimistic: true },
          ]}
          onSteer={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Queueing");
    expect(container.querySelectorAll("button:not(.thread-composer-pending-text)")).toHaveLength(0);
  });

  it("opens a queued prompt in full and takes it back for editing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };
    const onEdit = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <ComposerPendingQueue
          prompts={[{ id: "queued-1", prompt: "First line\nSecond line" }]}
          onCancel={vi.fn()}
          onEdit={onEdit}
        />,
      );
    });

    const text = container.querySelector<HTMLButtonElement>(".thread-composer-pending-text")!;
    expect(text.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".thread-composer-queue-edit")).toBeNull();
    await act(async () => text.click());
    expect(text.getAttribute("aria-expanded")).toBe("true");
    expect(text.className).toContain("whitespace-pre-wrap");
    await act(async () => container.querySelector<HTMLButtonElement>(".thread-composer-queue-edit")!.click());
    expect(onEdit).toHaveBeenCalledWith("queued-1");
  });

  it("keeps non-steer backends in the same queue UI without a steer action", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };
    const onCancel = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <ComposerPendingQueue
          prompts={[{ id: "claude-queued-1", prompt: "Wait for this turn" }]}
          onCancel={onCancel}
        />,
      );
    });

    expect(container.querySelector('[aria-label="Queued prompts"]')).not.toBeNull();
    expect(container.textContent).toContain("Queued");
    expect(container.textContent).toContain("Wait for this turn");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) =>
        button.textContent?.includes("Steer"),
      ),
    ).toBe(false);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Remove queued prompt"]')
        ?.click();
    });
    expect(onCancel).toHaveBeenCalledWith("claude-queued-1");
  });
});
