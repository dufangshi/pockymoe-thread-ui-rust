import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AcpRuntime } from "./acp-runtime.js";
import { startAgentUiServer } from "./index.js";

const fixture = fileURLToPath(
  new URL("./fixtures/acp-agent.mjs", import.meta.url),
);
const command = (mode: string) => `"${process.execPath}" "${fixture}" ${mode}`;

for (const mode of ["load", "resume", "unsupported"]) {
  test(`ACP restoration: ${mode}`, async () => {
    const runtime = new AcpRuntime(
      command(mode),
      process.cwd(),
      undefined,
      "Fixture",
      "fixture",
      "saved-session",
    );
    try {
      await runtime.start();
      if (mode === "unsupported") {
        await assert.rejects(runtime.bindAgent("local"), /does not advertise/);
        assert.equal(runtime.current, null);
      } else {
        const thread = await runtime.bindAgent("local");
        assert.equal(thread.providerSessionId, "saved-session");
        assert.deepEqual(
          thread.turns.flatMap((turn) => turn.items.map((item) => item.text)),
          mode === "load" ? ["old question", "old answer"] : [],
        );
        await runtime.prompt("new question", "local");
        await new Promise<void>((resolve) => {
          const check = () => {
            if (thread.status !== "running") {
              runtime.off("state", check);
              resolve();
            }
          };
          runtime.on("state", check);
          check();
        });
        assert.equal(thread.turns.at(-1)?.items.at(-1)?.text, "new answer");
      }
    } finally {
      await runtime.stop();
    }
  });
}

test("failed restoration never silently creates a new session", async () => {
  const runtime = new AcpRuntime(
    command("load"),
    process.cwd(),
    undefined,
    "Fixture",
    "fixture",
    "missing",
  );
  try {
    await runtime.start();
    await assert.rejects(
      runtime.bindAgent("local"),
      /Could not restore session missing/,
    );
    assert.equal(runtime.current, null);
    assert.equal(runtime.snapshot().auth.status, "authenticated");
  } finally {
    await runtime.stop();
  }
});

test("standalone server uses an ephemeral port and exposes the restored session without Treer", async () => {
  const previous = process.env.ACP_COMMAND;
  process.env.ACP_COMMAND = command("load");
  try {
    const app = await startAgentUiServer({
      port: 0,
      agent: "codex",
      resumeSessionId: "saved-session",
    });
    try {
      const response = await fetch(`${app.url}/api/state`);
      const state = (await response.json()) as {
        detail: { thread: { providerSessionId: string }; turns: unknown[] };
      };
      assert.equal(state.detail.thread.providerSessionId, "saved-session");
      assert.equal(state.detail.turns.length, 1);
      const web = await fetch(app.url);
      assert.equal(web.status, 200);
      assert.match(await web.text(), /<!doctype html>/i);
    } finally {
      await app.close();
    }
  } finally {
    if (previous === undefined) delete process.env.ACP_COMMAND;
    else process.env.ACP_COMMAND = previous;
  }
});
