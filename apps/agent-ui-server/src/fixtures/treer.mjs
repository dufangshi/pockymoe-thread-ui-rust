#!/usr/bin/env node
import { appendFile } from "node:fs/promises";

const args = process.argv.slice(2);
if (args[0] !== "interface" || args[1] !== "register")
  throw new Error("Unexpected Treer mutation");
const value = (flag) => args[args.indexOf(flag) + 1];
const port = Number(value("--port"));
const instanceId = value("--instance-id");
const response = await fetch(`http://127.0.0.1:${port}/v1/manifest`, {
  headers: {
    "x-treer-interface-instance": instanceId,
    "x-treer-agent-id": process.env.TREER_AGENT_ID,
  },
});
const manifest = await response.json();
if (manifest.instance_id !== instanceId || manifest.ui_path !== "/")
  throw new Error("Manifest mismatch");
const capabilities = args.flatMap((arg, index) =>
  arg === "--capability" ? [args[index + 1]] : [],
);
if (
  JSON.stringify([...manifest.capabilities].sort()) !==
  JSON.stringify(capabilities.sort())
)
  throw new Error("Capability mismatch");
await appendFile(
  process.env.TREER_TEST_LOG,
  `${JSON.stringify({ agent: process.env.TREER_AGENT_ID, port, instanceId, args })}\n`,
);
console.log(JSON.stringify({ ...manifest, port }));
