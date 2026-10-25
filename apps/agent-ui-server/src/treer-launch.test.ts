import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdtemp, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { startAgentUiServer } from "./index.js";

const fixture = fileURLToPath(
  new URL("./fixtures/acp-agent.mjs", import.meta.url),
);
const command = `"${process.execPath}" "${fixture}" load`;

test("concurrent servers get distinct ports and identities; stale probes cannot impersonate a new instance", async () => {
  const previous = process.env.ACP_COMMAND;
  process.env.ACP_COMMAND = command;
  const first = await startAgentUiServer({ port: 0 });
  try {
    const second = await startAgentUiServer({ port: 0 });
    try {
      assert.notEqual(first.port, second.port);
      assert.notEqual(first.instanceId, second.instanceId);
      const probe = await fetch(`${second.url}/v1/manifest`, {
        headers: { "x-treer-interface-instance": first.instanceId },
      });
      assert.equal(probe.status, 409);
      const status = await fetch(`${second.url}/v1/status`, {
        headers: { "x-treer-interface-instance": first.instanceId },
      });
      assert.equal(status.status, 409);
      const misrouted = await fetch(`${second.url}/v1/prompts`, {
        method: "POST",
        headers: {
          "x-treer-interface-instance": first.instanceId,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operation_id: "stale",
          text: "must not execute",
        }),
      });
      assert.equal(misrouted.status, 409);
      assert.equal(second.runtime.current?.turns.length, 0);
      const ownManifest = await fetch(`${second.url}/v1/manifest`, {
        headers: { "x-treer-interface-instance": second.instanceId },
      });
      assert.equal(
        ((await ownManifest.json()) as { instance_id: string }).instance_id,
        second.instanceId,
      );
      await assert.rejects(startAgentUiServer({ port: first.port }), {
        code: "EADDRINUSE",
      });
    } finally {
      await second.close();
    }
    assert.equal((await fetch(`${first.url}/api/health`)).status, 200);
  } finally {
    await first.close();
    if (previous === undefined) delete process.env.ACP_COMMAND;
    else process.env.ACP_COMMAND = previous;
  }
});

test(
  "CLI registers multiple managed agents and an old process never clears its replacement",
  { timeout: 20000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-launch-treer-"));
    const processes: ChildProcess[] = [];
    try {
      const treer = join(directory, "treer");
      await copyFile(new URL("./fixtures/treer.mjs", import.meta.url), treer);
      await chmod(treer, 0o755);
      const log = join(directory, "calls.jsonl");
      async function launch(agentId: string) {
        const child = spawn(
          process.execPath,
          [
            "--import",
            import.meta.resolve("tsx"),
            fileURLToPath(new URL("./cli.ts", import.meta.url)),
            "codex",
            "--no-open",
          ],
          {
            env: {
              ...process.env,
              ACP_COMMAND: command,
              TREER_AGENT_ID: agentId,
              PATH: `${directory}${delimiter}${process.env.PATH}`,
              TREER_TEST_LOG: log,
              AGENT_LAUNCH_STATE_DIR: join(directory, "sessions"),
              AIS_AUTO_REGISTER: "1",
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        processes.push(child);
        await new Promise<void>((resolve, reject) => {
          let output = "";
          const exited = (code: number | null) =>
            reject(new Error(`Launcher exited ${code}: ${output}`));
          child.once("error", reject);
          child.once("exit", exited);
          child.stderr?.on("data", (chunk) => {
            output += chunk;
          });
          child.stdout?.on("data", (chunk) => {
            output += chunk;
            if (output.includes("Treer UI registered on port")) {
              child.off("exit", exited);
              resolve();
            }
          });
        });
        return child;
      }
      const first = await launch("agent-one");
      await launch("agent-two");
      await launch("agent-one"); // A newer process may replace the same Agent's interface.
      const calls = (await readFile(log, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(
        calls.map((call) => call.agent),
        ["agent-one", "agent-two", "agent-one"],
      );
      assert.equal(new Set(calls.map((call) => call.port)).size, 3);
      assert.equal(new Set(calls.map((call) => call.instanceId)).size, 3);
      const exited = once(first, "exit");
      first.kill("SIGTERM");
      await exited;
      assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 3);
      for (const call of calls.slice(1)) {
        assert.equal(
          (await fetch(`http://127.0.0.1:${call.port}/api/health`)).status,
          200,
        );
      }
    } finally {
      await Promise.all(
        processes.map(async (child) => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          const exited = once(child, "exit");
          child.kill("SIGTERM");
          await exited;
        }),
      );
      await rm(directory, { recursive: true, force: true });
    }
  },
);
