import { describe, expect, it } from "vitest";

import type { ThreadHistoryItemDto } from "@pockymoe/shared";
import {
  countTurnSteps,
  getLiveOutputTailForTurn,
  groupTimelineHistoryItems,
  isRunningHistoryStatus,
  mergeLiveTurnItems,
  parseHookPromptText,
  prepareTurnItemsForRendering,
  sortTurnItemsByRecordedSequence,
} from "./timelineItems";

function item(
  id: string,
  kind: ThreadHistoryItemDto["kind"],
  extra: Partial<ThreadHistoryItemDto> = {},
): ThreadHistoryItemDto {
  return {
    id,
    kind,
    text: id,
    ...extra,
  };
}

describe("timeline item utilities", () => {
  it('places a prompt added mid-turn by its time while live items arrive after it', () => {
    const at = (second: number) => `2026-10-17T16:45:${String(second).padStart(2, '0')}.000Z`;
    const persisted = [
      item('first', 'userMessage', { createdAt: at(0) }),
      item('reply', 'agentMessage', { sequence: 12, createdAt: at(14) }),
      item('search', 'commandExecution', { sequence: 14, createdAt: at(25) }),
    ];
    // Live: the steered prompt (no sequence) is appended after the work it preceded.
    const live = [
      item('read', 'commandExecution', { sequence: 15, createdAt: at(34) }),
      item('answer', 'agentMessage', { sequence: 17, createdAt: at(50) }),
      item('added', 'userMessage', { createdAt: at(26) }),
    ];
    const merged = mergeLiveTurnItems(persisted, live);
    expect(merged.map(entry => entry.id)).toEqual(['first', 'reply', 'search', 'added', 'read', 'answer']);
    // With work after it, the added prompt is not left awaiting a response.
    expect(prepareTurnItemsForRendering(merged, true).find(entry => entry.id === 'added')?.status).toBeUndefined();
  });

  it('counts loaded work plus deferred operations in a running summary', () => {
    const items = [item('prompt','userMessage'), item('progress','agentMessage'), item('checkpoint','agentMessage')];
    expect(countTurnSteps({hasDeferredItems:true,deferredItemCount:4},items)).toBe(5);
    expect(countTurnSteps({hasDeferredItems:false,deferredItemCount:0},[
      items[0]!, items[1]!, item('command-1','commandExecution'), item('command-2','commandExecution'),
      item('read','fileRead'), item('thought','reasoning'), items[2]!,
    ])).toBe(5);
  });

  it('ignores stale deferred counts and duplicate live item updates when counting work', () => {
    const items = [item('prompt','userMessage'), item('command','commandExecution'),
      item('command','commandExecution',{status:'completed'}), item('empty','reasoning',{text:' '}), item('answer','agentMessage')];
    expect(countTurnSteps({hasDeferredItems:false,deferredItemCount:9},items)).toBe(1);
  });

  it('does not add live operations already covered by a deferred summary', () => {
    const summary = [item('prompt', 'userMessage'), item('reply', 'agentMessage')];
    const live = [item('command', 'commandExecution')];
    expect(countTurnSteps({hasDeferredItems:true,deferredItemCount:1}, mergeLiveTurnItems(summary, live), summary)).toBe(1);
    live.push(item('another-command', 'commandExecution'));
    expect(countTurnSteps({hasDeferredItems:true,deferredItemCount:1}, mergeLiveTurnItems(summary, live), summary)).toBe(2);
    expect(countTurnSteps({hasDeferredItems:true,deferredItemCount:2}, mergeLiveTurnItems(summary, live), summary)).toBe(2);
    expect(countTurnSteps({hasDeferredItems:false,deferredItemCount:0}, mergeLiveTurnItems([...summary, ...live], live))).toBe(2);
  });

  it('counts a former reply as a checkpoint when the live overlay adds a new reply', () => {
    const summary = [item('prompt', 'userMessage'), item('checkpoint', 'agentMessage')];
    const live = [item('command', 'commandExecution'), item('reply', 'agentMessage')];
    expect(countTurnSteps({hasDeferredItems:true,deferredItemCount:4}, mergeLiveTurnItems(summary, live), summary)).toBe(5);
  });
  it("keeps leading unsequenced user messages before sequenced history", () => {
    const leadingUser = item("user-1", "userMessage");
    const later = item("later", "agentMessage", { sequence: 20 });
    const earlier = item("earlier", "commandExecution", { sequence: 10 });

    expect(
      sortTurnItemsByRecordedSequence([leadingUser, later, earlier]).map(
        (entry) => entry.id,
      ),
    ).toEqual(["user-1", "earlier", "later"]);
  });

  it("keeps unsequenced blocks after the previous sequenced item from their original position", () => {
    const first = item("first", "agentMessage", { sequence: 1 });
    const unsequencedA = item("unsequenced-a", "fileRead");
    const unsequencedB = item("unsequenced-b", "fileChange");
    const last = item("last", "agentMessage", { sequence: 10 });

    expect(
      sortTurnItemsByRecordedSequence([
        last,
        unsequencedA,
        unsequencedB,
        first,
      ]).map((entry) => entry.id),
    ).toEqual(["first", "last", "unsequenced-a", "unsequenced-b"]);
  });

  it("places an unsequenced block between neighboring sequenced items when it is already between them", () => {
    const first = item("first", "agentMessage", { sequence: 1 });
    const unsequencedA = item("unsequenced-a", "fileRead");
    const unsequencedB = item("unsequenced-b", "fileChange");
    const last = item("last", "agentMessage", { sequence: 10 });

    expect(
      sortTurnItemsByRecordedSequence([
        first,
        unsequencedA,
        unsequencedB,
        last,
      ]).map((entry) => entry.id),
    ).toEqual(["first", "unsequenced-a", "unsequenced-b", "last"]);
  });

  it("merges live items over persisted items while preserving useful fallback text", () => {
    const persisted = item("tool", "toolCall", {
      text: "persisted text",
      detailText: "persisted detail",
      previewText: "persisted preview",
      status: "Running",
      sequence: 1,
    });
    const live = item("tool", "toolCall", {
      text: "",
      status: "Completed",
    });
    const appended = item("new-live", "agentMessage", { sequence: 2 });

    const merged = mergeLiveTurnItems([persisted], [live, appended]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "tool",
      text: "persisted text",
      detailText: "persisted detail",
      previewText: "persisted preview",
      status: "Completed",
      sequence: 1,
    });
    expect(merged[1]?.id).toBe("new-live");
  });

  it("preserves steer messages between operations and marks awaiting steers", () => {
    const primary = item("primary-user", "userMessage");
    const steer = item("steer", "userMessage");
    const command = item("command", "commandExecution");
    const trailing = item("trailing-steer", "userMessage");

    const prepared = prepareTurnItemsForRendering(
      [primary, steer, command, trailing],
      true,
    );

    expect(prepared.map((entry) => entry.id)).toEqual([
      "primary-user",
      "steer",
      "command",
      "trailing-steer",
    ]);
    expect(prepared.at(-1)).toMatchObject({
      id: "trailing-steer",
      status: "Awaiting response",
    });
  });

  it('folds wakes with adjacent work but keeps pending waits separate', () => {
    const wait = item('wait', 'other', { origin: 'nativeBackgroundWait', status: 'waiting', text: '' });
    const wake = item('wake', 'other', { origin: 'nativeTaskNotification', taskStatus: 'completed' });
    const rows = groupTimelineHistoryItems([
      item('cmd-before', 'commandExecution'), wait, wake,
      item('cmd-after', 'commandExecution'), item('final', 'agentMessage'),
    ]);
    expect(rows.map(row => row.kind)).toEqual(['item', 'item', 'agentActivityGroup', 'item']);
    expect(rows[1]).toMatchObject({ item: { id: 'wait' } });
    expect(rows[2]).toMatchObject({ itemCount: 2, entries: [{ item: { id: 'wake' } }, { item: { id: 'cmd-after' } }] });
    expect(countTurnSteps({}, [wait, wake, item('cmd', 'commandExecution'), item('final', 'agentMessage')])).toBe(2);
  });

  it.each(['completed', 'failed', 'cancelled', 'running'])('folds a standalone %s wake into one step', taskStatus => {
    const entries = groupTimelineHistoryItems([item('wake', 'other', { origin: 'nativeTaskNotification', taskStatus })]);
    expect(entries).toMatchObject([{ kind: 'agentActivityGroup', itemCount: 1, entries: [{ item: { id: 'wake' } }] }]);
  });

  it("groups consecutive tool-like history items and folds reasoning into activity", () => {
    const entries = groupTimelineHistoryItems([
      item("reason-before", "reasoning"),
      item("agent", "agentMessage"),
      item("cmd-1", "commandExecution"),
      item("cmd-2", "commandExecution"),
      item("file-1", "fileRead"),
      item("file-2", "fileRead"),
      item("search", "webSearch"),
      item("plain", "other"),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "agentActivityGroup",
      "item",
      "agentActivityGroup",
      "item",
    ]);
    expect(entries[0]).toMatchObject({
      kind: "agentActivityGroup",
      itemCount: 1,
      entries: [{ kind: "item", item: { id: "reason-before" } }],
    });
    expect(entries[1]).toMatchObject({
      kind: "item",
      item: { id: "agent" },
    });
    const commandGroup = entries[2]?.kind === "agentActivityGroup" ? entries[2].entries[0] : undefined;
    expect(commandGroup?.kind).toBe("commandGroup");
    if (commandGroup?.kind === "commandGroup") {
      expect(commandGroup.items.map((entry) => entry.id)).toEqual([
        "cmd-1",
        "cmd-2",
      ]);
    }
  });

  it("groups mixed trailing operations before any next assistant reply exists", () => {
    const entries = groupTimelineHistoryItems([
      item("intro", "agentMessage", { text: "I will check the code." }),
      item("command", "commandExecution"),
      item("read", "fileRead"),
      item("search", "webSearch"),
    ]);
    expect(entries).toMatchObject([
      { kind: "item", item: { id: "intro" } },
      { kind: "agentActivityGroup", itemCount: 3 },
    ]);
  });

  it("batches Claude tool calls and folds a completed operation run before agent prose", () => {
    const entries = groupTimelineHistoryItems([
      item("tool-1", "toolCall"),
      item("agent-1", "agentToolCall"),
      item("agent-2", "agentToolCall"),
      item("read-1", "fileRead"),
      item("write-1", "fileChange"),
      item("tool-2", "toolCall"),
      item("narrative", "agentMessage", {
        text: "I found the issue and updated the file.",
        status: "Completed",
      }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "agentActivityGroup",
      "item",
    ]);
    const activity = entries[0];
    expect(activity?.kind).toBe("agentActivityGroup");
    if (activity?.kind === "agentActivityGroup") {
      expect(activity.itemCount).toBe(6);
      expect(activity.entries.map((entry) => entry.kind)).toEqual([
        "item",
        "agentToolCallGroup",
        "item",
        "item",
        "item",
      ]);
      expect(activity.entries[1]).toMatchObject({
        kind: "agentToolCallGroup",
        items: [{ id: "agent-1" }, { id: "agent-2" }],
      });
    }
  });

  it.each([
    "commandExecution", "fileChange", "webSearch", "fileRead", "toolCall",
    "agentToolCall", "skillToolCall",
  ] as const)("keeps %s group identity when more items arrive", (kind) => {
    const first = item("first", kind);
    const second = item("second", kind);
    const initial = groupTimelineHistoryItems([first, second]);
    const updated = groupTimelineHistoryItems([first, second, item("third", kind)]);

    expect(updated[0]?.key).toBe(initial[0]?.key);
  });

  it("keeps activity identity when its first tool becomes a group and more reasoning arrives", () => {
    const command = item("command-1", "commandExecution");
    const reasoning = item("reason-1", "reasoning");
    const initial = groupTimelineHistoryItems([command, reasoning]);
    const updated = groupTimelineHistoryItems([
      command,
      item("command-2", "commandExecution"),
      reasoning,
      item("reason-2", "reasoning"),
      item("narrative", "agentMessage", { status: "completed" }),
      item("reason-3", "reasoning"),
    ]);

    expect(initial[0]?.kind).toBe("agentActivityGroup");
    expect(updated[0]?.kind).toBe("agentActivityGroup");
    expect(updated[0]?.key).toBe(initial[0]?.key);
    expect(updated[2]?.kind).toBe("agentActivityGroup");
    expect(updated[2]?.key).not.toBe(updated[0]?.key);
  });

  it("uses a command batch directly without a redundant activity wrapper", () => {
    const entries = groupTimelineHistoryItems([
      item("cmd-1", "commandExecution"),
      item("cmd-2", "commandExecution"),
      item("cmd-3", "commandExecution"),
      item("narrative", "agentMessage", {
        text: "All commands completed.",
        status: "Completed",
      }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "commandGroup",
      "item",
    ]);
    expect(entries[0]).toMatchObject({
      kind: "commandGroup",
      items: [{ id: "cmd-1" }, { id: "cmd-2" }, { id: "cmd-3" }],
    });
  });

  it.each([
    ["commandExecution", "commandGroup"],
    ["fileRead", "fileReadGroup"],
    ["fileChange", "fileChangeGroup"],
    ["webSearch", "searchGroup"],
    ["toolCall", "toolCallGroup"],
    ["agentToolCall", "agentToolCallGroup"],
    ["skillToolCall", "skillToolCallGroup"],
  ] as const)("keeps homogeneous %s batches at one disclosure level", (kind, groupKind) => {
    const entries = groupTimelineHistoryItems(Array.from({ length: 14 }, (_, i) => item(`op-${i}`, kind)));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: groupKind, items: expect.any(Array) });
    if (entries[0]?.kind !== "item" && entries[0]?.kind !== "agentActivityGroup") {
      expect(entries[0]?.items).toHaveLength(14);
    }
  });

  it("groups operations while keeping a streaming narrative visible", () => {
    const entries = groupTimelineHistoryItems([
      item("tool-1", "toolCall"),
      item("tool-2", "toolCall"),
      item("streaming-narrative", "agentMessage", {
        text: "I am still checking.",
        status: "Running",
      }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "toolCallGroup",
      "item",
    ]);
  });

  it("groups trailing operations without waiting for a narrative", () => {
    const entries = groupTimelineHistoryItems([
      item("tool-1", "toolCall"),
      item("tool-2", "toolCall"),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual(["toolCallGroup"]);
  });

  it("folds imported reasoning summaries and operations into one activity batch", () => {
    const entries = groupTimelineHistoryItems([
      item("narrative-before", "agentMessage", {
        text: "I found the first issue.",
      }),
      item("reason-1", "reasoning", {
        text: "**Planning concurrent browser inspection**",
      }),
      item("cmd-1", "commandExecution"),
      item("reason-empty", "reasoning", { text: "  \n" }),
      item("reason-2", "reasoning", {
        text: "**Checking item timestamps, statuses, and duplicates**",
      }),
      item("file-1", "fileChange"),
      item("narrative-after", "agentMessage", {
        text: "The imported session now reads cleanly.",
      }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "item",
      "agentActivityGroup",
      "item",
    ]);
    expect(entries[1]).toMatchObject({
      kind: "agentActivityGroup",
      itemCount: 4,
      entries: [
        { kind: "item", item: { id: "reason-1" } },
        { kind: "item", item: { id: "cmd-1" } },
        { kind: "item", item: { id: "reason-2" } },
        { kind: "item", item: { id: "file-1" } },
      ],
    });
  });

  it("ignores incomplete history entries instead of crashing transcript grouping", () => {
    const invalidHistory = undefined as unknown as ThreadHistoryItemDto;
    const entries = groupTimelineHistoryItems([
      invalidHistory,
      item("tool", "toolCall"),
      item("narrative", "agentMessage", {
        text: "Completed safely.",
        status: "Completed",
      }),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.kind)).toEqual(["item", "item"]);
    expect(entries[0]).toMatchObject({ kind: "item", item: { id: "tool" } });
  });

  it("extracts live output tails after materialized agent text", () => {
    const persisted = [
      item("agent-1", "agentMessage", { text: "Hello" }),
      item("agent-2", "agentMessage", { text: " world" }),
    ];

    expect(getLiveOutputTailForTurn("Hello world again", persisted)).toBe(
      " again",
    );
    expect(getLiveOutputTailForTurn("Hello world", persisted)).toBe("");
    expect(getLiveOutputTailForTurn("Different stream", persisted)).toBe(
      "Different stream",
    );
  });

  it("parses hook prompt output with XML entities and source paths", () => {
    const parsed = parseHookPromptText(
      '<hook_prompt hook_run_id="stop:abc:/tmp/hooks.json">warn &amp; stop</hook_prompt>',
    );

    expect(parsed).toMatchObject({
      id: "live-hook-prompt:stop:abc:/tmp/hooks.json",
      kind: "hook",
      text: "Stop hook",
      detailText: "warn & stop",
      hookEventName: "stop",
      hookEventLabel: "Stop",
      hookSource: "project",
      hookSourcePath: "/tmp/hooks.json",
      hookOutputEntries: [{ kind: "warning", text: "warn & stop" }],
    });
    expect(parseHookPromptText("plain output")).toBeNull();
  });

  it("recognizes running history statuses", () => {
    expect(isRunningHistoryStatus("Running")).toBe(true);
    expect(isRunningHistoryStatus("in_progress")).toBe(true);
    expect(isRunningHistoryStatus("InProgress")).toBe(true);
    expect(isRunningHistoryStatus("Completed")).toBe(false);
    expect(isRunningHistoryStatus(null)).toBe(false);
  });
});


it('does not revive a persisted completed command from a stale live overlay', () => {
  const completed = item('cmd', 'commandExecution', {status: 'completed', text: 'grep source'});
  const stale = {...completed, status: 'running', detailText: 'older longer output'};
  expect(mergeLiveTurnItems([completed], [stale])[0]).toMatchObject({status:'completed',detailText:stale.detailText});
});
