#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { builtinAcpAgents, resolveAcpAgent } from "./acp-catalog.js";
import { resolveExecutable, parseCommandLine } from "./process.js";
import { startAgentUiServer } from "./index.js";
import { parseLaunchOptions } from "./launch-options.js";
import { SessionStore } from "./session-store.js";
import { registerTreerInterface } from "./treer-interface.js";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    console.log(`Usage: agent-launch <agent> [--resume [session-id]] [--cwd <directory>] [--port <port>] [--no-open]

Agents: ${builtinAcpAgents.map((agent) => agent.id).join(", ")}

agent-launch codex                  Start a new structured chat
agent-launch claude --resume        Restore the latest session in this directory
agent-launch codex --resume <id>    Restore a specific provider session

Uses existing agent login and configuration. Ctrl-C stops the launcher.
Automatically registers the UI when running inside a managed Treer Agent.
Set AIS_AUTO_REGISTER=0 to disable registration. Ports are assigned automatically.
Resume requires the backend to advertise ACP session/load or session/resume.
Native agent CLI flags are not forwarded.`);
    return;
  }
  const options = parseLaunchOptions(args);
  const agent = resolveAcpAgent(options.agent);
  const command = process.env.ACP_COMMAND || agent.serverCommand;
  if (!(await resolveExecutable(parseCommandLine(command).command))) {
    throw new Error(
      `Missing ACP executable for ${agent.displayName}: ${command}.${agent.installCommand ? ` Install it with: ${agent.installCommand}` : " Install the agent CLI first."}`,
    );
  }
  const store = new SessionStore(process.env.AGENT_LAUNCH_STATE_DIR);
  const resumeSessionId =
    options.resume === true
      ? await store.latest(options.agent, options.cwd)
      : options.resume;
  if (options.resume === true && !resumeSessionId) {
    throw new Error(
      `No previous ${options.agent} session in ${options.cwd}; start one without --resume or supply a session ID.`,
    );
  }
  const packagedWeb = fileURLToPath(new URL("../web-dist/", import.meta.url));
  const sourceWeb = fileURLToPath(
    new URL("../../agent-ui-web/dist/", import.meta.url),
  );
  const webDist =
    process.env.CODEX_AGENT_UI_WEB_DIST ||
    (existsSync(resolve(packagedWeb, "index.html")) ? packagedWeb : sourceWeb);
  if (!existsSync(resolve(webDist, "index.html")))
    throw new Error(
      "Web bundle missing; run pnpm build before packaging agent-launch.",
    );

  const app = await startAgentUiServer({
    ...options,
    agent: options.agent,
    webDist,
    resumeSessionId,
    instanceId: `agent-launch-${options.agent}-${randomUUID()}`,
  });
  let lastSavedId: string | undefined;
  let saves = Promise.resolve();
  const remember = () => {
    const thread = app.runtime.current;
    if (!thread || thread.providerSessionId === lastSavedId) return;
    lastSavedId = thread.providerSessionId;
    console.log(`Session: ${thread.providerSessionId}`);
    console.log(
      `Resume: agent-launch ${options.agent} --resume ${thread.providerSessionId}`,
    );
    saves = saves
      .then(() =>
        store.save({
          agent: options.agent,
          cwd: thread.cwd,
          sessionId: thread.providerSessionId,
        }),
      )
      .catch((error) =>
        console.error(`Cannot save resume metadata: ${String(error)}`),
      );
  };
  app.runtime.on("state", remember);
  remember();
  console.log(`${agent.displayName}: ${app.url}`);
  console.log(
    "Ctrl-C to stop. Closing the browser leaves the session running.",
  );
  let stopping = false;
  const registrationAbort = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      registrationAbort.abort();
      void Promise.all([saves, app.close()]).then(() => process.exit(0));
    });
  }
  const registered = await registerTreerInterface(app, {
    signal: registrationAbort.signal,
  });
  if (stopping) return;
  if (registered)
    console.log(`Treer UI registered on port ${app.port} (${app.instanceId}).`);
  if (options.open && !registered) {
    const program =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const openArgs =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", app.url]
        : [app.url];
    const browser = spawn(program, openArgs, {
      stdio: "ignore",
      detached: true,
    });
    browser.on("error", () =>
      console.error(`Open ${app.url} in your browser.`),
    );
    browser.unref();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
