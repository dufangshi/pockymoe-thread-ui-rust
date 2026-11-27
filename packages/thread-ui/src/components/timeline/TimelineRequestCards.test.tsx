// @vitest-environment jsdom

import type { ThreadActionRequestDto } from "@pockymoe/shared";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingRequestCard } from "./TimelineRequestCards";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    flushSync(() => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function renderPermission(onRespond = vi.fn()) {
  const request: ThreadActionRequestDto = {
    id: "perm-7",
    kind: "permissionRequest",
    title: "Run cargo test",
    description: "execute: cargo test",
    turnId: "turn-1",
    itemId: "call-1",
    createdAt: "2026-09-04T00:00:00Z",
    questions: [
      {
        id: "permission",
        header: "Permission",
        question: "Run cargo test",
        isOther: false,
        isSecret: false,
        options: [
          { label: "Allow once", description: "allow once" },
          { label: "Allow always", description: "allow always" },
          { label: "Reject", description: "reject once" },
        ],
      },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(
      <PendingRequestCard request={request} onRespond={onRespond} />,
    );
  });
  return { view: container, onRespond };
}

function renderOtherAnswer(onRespond = vi.fn(), multiSelect = false) {
  const request: ThreadActionRequestDto = {
    id: "input-7",
    kind: "requestUserInput",
    title: "Answer Required",
    description: null,
    turnId: "turn-1",
    itemId: "call-1",
    createdAt: "2026-09-04T00:00:00Z",
    questions: [
      {
        id: "limit",
        header: "行数上限",
        question: "行数上限",
        isOther: true,
        isSecret: false,
        multiSelect,
        options: [
          { label: "上限提到 55k", description: "raise limit" },
          { label: "保持 50k", description: "keep limit" },
        ],
      },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(
      <PendingRequestCard request={request} onRespond={onRespond} />,
    );
  });
  return { view: container, onRespond };
}

describe("PendingRequestCard permissions", () => {
  it("renders ACP choices as immediate permission actions", () => {
    const { view, onRespond } = renderPermission();

    expect(view.textContent).toContain("Permission required");
    expect(view.textContent).toContain("execute: cargo test");
    expect(view.textContent).not.toContain("Submit");

    const allowAlways = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Allow always",
    );
    flushSync(() => allowAlways?.click());

    expect(onRespond).toHaveBeenCalledWith("perm-7", {
      answers: {
        permission: { answers: ["Allow always"] },
      },
    });
  });
});

describe("PendingRequestCard custom answers", () => {
  it.each([false, true])("submits an option with an empty optional field (multiSelect=%s)", (multiSelect) => {
    const { view, onRespond } = renderOtherAnswer(vi.fn(), multiSelect);
    const option = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "上限提到 55k",
    );
    const submit = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Submit",
    );
    expect(submit?.disabled).toBe(true);
    flushSync(() => option?.click());
    expect(view.querySelector("input")?.value).toBe("");
    expect(submit?.disabled).toBe(false);
    flushSync(() => submit?.click());
    expect(onRespond).toHaveBeenCalledWith("input-7", {
      answers: { limit: { answers: ["上限提到 55k"] } },
    });
  });

  it("allows submitting a custom Other answer without selecting an option", () => {
    const { view, onRespond } = renderOtherAnswer();
    const input = view.querySelector<HTMLInputElement>(
      'input[aria-label="行数上限 custom answer"]',
    );
    expect(input).not.toBeNull();
    const submit = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "Submit",
    );
    expect(submit?.disabled).toBe(true);

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    flushSync(() => {
      valueSetter?.call(input, "不限制仓库行数");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(submit?.disabled).toBe(false);
    flushSync(() => submit?.click());
    expect(onRespond).toHaveBeenCalledWith("input-7", {
      answers: { limit: { answers: ["不限制仓库行数"] } },
    });
  });
});

/** Each source's request as the Supervisor sends it (crates/runtime/src). */
const permissionQuestion = (header: string, question: string, labels: string[]) => ({
  id: "permission", header, question, isOther: false, isSecret: false,
  options: labels.map((label) => ({ label, description: "" })),
});
const request = (
  kind: ThreadActionRequestDto["kind"],
  questions: ThreadActionRequestDto["questions"],
  title = "Run the focused regression checks?",
): ThreadActionRequestDto => ({
  id: "req-1", kind, title, description: title, turnId: "turn-1", itemId: null,
  createdAt: "2026-11-26T00:00:00Z", questions,
});

function renderRequest(value: ThreadActionRequestDto, { viewer = false } = {}) {
  const onRespond = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(<PendingRequestCard request={value} onRespond={viewer ? undefined : onRespond} />);
  });
  const buttons = () => Array.from(container!.querySelectorAll("button"));
  const button = (label: string) => buttons().find((entry) => entry.textContent === label);
  return { view: container, onRespond, buttons, button };
}

describe("PendingRequestCard answers every request shape", () => {
  it.each([
    ["the fake fixture (no questions)", request("permissionRequest", [])],
    ["ACP without options", request("permissionRequest", [permissionQuestion("Permission", "Run cargo test", [])])],
    ["native Codex with an empty availableDecisions", request("permissionRequest", [permissionQuestion("Permission", "rm -rf build", [])])],
    ["a plan decision without options", request("planDecision", [])],
  ])("offers Approve and Deny for %s", (_name, value) => {
    const { view, onRespond, button } = renderRequest(value);
    expect(view.querySelector("input")).toBeNull();
    expect(button("Submit")).toBeUndefined();
    flushSync(() => button("Approve")?.click());
    expect(onRespond).toHaveBeenLastCalledWith("req-1", { allow: true });
    flushSync(() => button("Deny")?.click());
    expect(onRespond).toHaveBeenLastCalledWith("req-1", { allow: false });
  });

  it.each([
    ["native Codex command", ["Yes, proceed", "Yes, and don't ask again for this command", "No, continue without running it", "No, and tell Codex what to do differently"]],
    ["native Codex plan review", ["Implement", "Revise"]],
    ["native Claude tool", ["Yes", "Yes, and don't ask again for Bash(cargo test:*)", "No"]],
    ["native Claude plan exit", ["Yes, manually approve edits", "Yes, and auto-accept edits", "No, keep planning"]],
    ["ACP Claude", ["Allow", "Always Allow", "Reject"]],
  ])("sends the chosen %s option, with no extra Approve/Deny", (_name, labels) => {
    const { onRespond, button, buttons } = renderRequest(
      request("permissionRequest", [permissionQuestion("Permission", "Run cargo test", labels)]),
    );
    expect(buttons().map((entry) => entry.textContent)).toEqual(labels);
    flushSync(() => button(labels.at(-1)!)?.click());
    expect(onRespond).toHaveBeenCalledWith("req-1", {
      answers: { permission: { answers: [labels.at(-1)] } },
    });
  });

  it("submits or declines a question without fields", () => {
    const { onRespond, button } = renderRequest(request("requestUserInput", [], "Continue?"));
    expect(button("Submit")?.disabled).toBe(false);
    flushSync(() => button("Submit")?.click());
    expect(onRespond).toHaveBeenLastCalledWith("req-1", { answers: {} });
    flushSync(() => button("Decline")?.click());
    expect(onRespond).toHaveBeenLastCalledWith("req-1", { allow: false });
  });

  it("can decline a question before choosing an answer", () => {
    const { onRespond, button } = renderRequest(request("requestUserInput", [{
      id: "environment", header: "Environment", question: "Which rollout environment?",
      isOther: false, isSecret: false,
      options: [{ label: "Staging", description: "" }, { label: "Preview", description: "" }],
    }]));
    expect(button("Submit")?.disabled).toBe(true);
    flushSync(() => button("Decline")?.click());
    expect(onRespond).toHaveBeenCalledWith("req-1", { allow: false });
  });

  it("greys every action out for a viewer who cannot answer", () => {
    const { buttons } = renderRequest(request("permissionRequest", []), { viewer: true });
    expect(buttons().length).toBe(2);
    expect(buttons().every((entry) => entry.disabled)).toBe(true);
  });
});
