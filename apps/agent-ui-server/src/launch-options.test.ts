import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLaunchOptions } from "./launch-options.js";
import { SessionStore } from "./session-store.js";

test("launch options distinguish latest and explicit resume without forwarding native flags", () => {
  assert.equal(parseLaunchOptions(["codex", "--resume"], "/tmp").resume, true);
  assert.equal(
    parseLaunchOptions(["claude", "--resume", "session-123", "--no-open"])
      .resume,
    "session-123",
  );
  assert.equal(
    parseLaunchOptions(["codex", "--cwd", "project"], "/tmp").cwd,
    "/tmp/project",
  );
  assert.throws(
    () => parseLaunchOptions(["codex", "--model", "x"]),
    /Unknown argument/,
  );
  for (const value of ["-1", "65536", "NaN", "1.5", ""]) {
    assert.throws(() => parseLaunchOptions(["codex", "--port", value]));
  }
});

test("latest session is persisted and isolated by harness and cwd", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-launch-store-"));
  try {
    const store = new SessionStore(directory);
    assert.equal(await store.latest("codex", "/project"), undefined);
    await store.save({ agent: "codex", cwd: "/project", sessionId: "one" });
    await store.save({ agent: "claude", cwd: "/project", sessionId: "two" });
    assert.equal(
      await new SessionStore(directory).latest("codex", "/project"),
      "one",
    );
    assert.equal(await store.latest("claude", "/project"), "two");
    assert.equal(await store.latest("codex", "/other"), undefined);
    await store.save({ agent: "codex", cwd: "/project", sessionId: "three" });
    assert.equal(await store.latest("codex", "/project"), "three");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
