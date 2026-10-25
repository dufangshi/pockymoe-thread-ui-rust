import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTreerInterface } from "./treer-interface.js";

const descriptor = {
  port: 32123,
  instanceId: "instance-one",
  capabilities: ["prompt.submit", "transcript.read", "state.observe", "abort"],
  uiPath: "/",
};

test("ordinary shells and explicitly disabled integration never call treer", async () => {
  for (const env of [
    {},
    { TREER_AGENT_ID: " " },
    { TREER_AGENT_ID: "one", AIS_AUTO_REGISTER: "0" },
  ]) {
    assert.equal(
      await registerTreerInterface(descriptor, {
        env,
        resolve: async () => {
          throw new Error("must not search for treer");
        },
      }),
      false,
    );
  }
});

test("managed environments without treer keep the local UI available", async () => {
  const warnings: string[] = [];
  assert.equal(
    await registerTreerInterface(descriptor, {
      env: { TREER_AGENT_ID: "one" },
      resolve: async () => null,
      warn: (message) => warnings.push(message),
    }),
    false,
  );
  assert.match(warnings[0], /not on PATH/);
});

test("registers the actual bound port and instance once with all AIS capabilities", async () => {
  const calls: string[][] = [];
  assert.equal(
    await registerTreerInterface(descriptor, {
      env: { TREER_AGENT_ID: "one" },
      resolve: async () => "/bin/treer",
      run: async (binary, args) => {
        calls.push([binary, ...args]);
      },
    }),
    true,
  );
  assert.deepEqual(calls, [
    [
      "/bin/treer",
      "interface",
      "register",
      "--port",
      "32123",
      "--instance-id",
      "instance-one",
      "--ui-path",
      "/",
      "--capability",
      "prompt.submit",
      "--capability",
      "transcript.read",
      "--capability",
      "state.observe",
      "--capability",
      "abort",
    ],
  ]);
});

test("registration errors are nonfatal and aborted registration stays silent", async () => {
  const warnings: string[] = [];
  const controller = new AbortController();
  const options = {
    env: { TREER_AGENT_ID: "one" },
    resolve: async () => "/bin/treer",
    warn: (message: string) => warnings.push(message),
    signal: controller.signal,
  };
  assert.equal(
    await registerTreerInterface(descriptor, {
      ...options,
      run: async () => {
        throw new Error("Controller unavailable");
      },
    }),
    false,
  );
  assert.match(warnings[0], /Controller unavailable/);
  warnings.length = 0;
  assert.equal(
    await registerTreerInterface(descriptor, {
      ...options,
      run: async () => {
        controller.abort();
        throw new Error("aborted");
      },
    }),
    false,
  );
  assert.deepEqual(warnings, []);
});

test(
  "a stuck treer process is killed after the registration timeout",
  { timeout: 12000 },
  async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "agent-launch-treer-timeout-"),
    );
    try {
      const executable = join(directory, "treer");
      await writeFile(
        executable,
        "#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n",
        { mode: 0o755 },
      );
      const warnings: string[] = [];
      const started = Date.now();
      assert.equal(
        await registerTreerInterface(descriptor, {
          env: {
            ...process.env,
            TREER_AGENT_ID: "one",
            AIS_AUTO_REGISTER: "1",
          },
          resolve: async () => executable,
          warn: (message) => warnings.push(message),
        }),
        false,
      );
      assert.ok(Date.now() - started < 10000);
      assert.match(warnings[0], /auto-registration failed/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
