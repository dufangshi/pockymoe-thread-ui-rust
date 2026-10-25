import { resolve } from "node:path";

export interface LaunchOptions {
  agent: string;
  cwd: string;
  port: number;
  open: boolean;
  resume?: string | true;
}

export function parseLaunchOptions(
  args: string[],
  cwd = process.cwd(),
): LaunchOptions {
  const [agent, ...rest] = args;
  if (!agent || agent.startsWith("-"))
    throw new Error("Expected an agent name; run agent-launch --help");
  const options: LaunchOptions = {
    agent,
    cwd: resolve(cwd),
    port: 0,
    open: true,
  };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--no-open") options.open = false;
    else if (arg === "--resume") {
      options.resume =
        rest[i + 1] && !rest[i + 1].startsWith("-") ? rest[++i] : true;
    } else if (arg === "--cwd" || arg === "--port") {
      const value = rest[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} requires a value`);
      if (arg === "--cwd") options.cwd = resolve(cwd, value);
      else {
        const port = Number(value);
        if (
          !/^\d+$/.test(value) ||
          !Number.isInteger(port) ||
          port < 0 ||
          port > 65535
        ) {
          throw new Error("--port must be an integer between 0 and 65535");
        }
        options.port = port;
      }
    } else
      throw new Error(
        `Unknown argument: ${arg}. agent-launch accepts its own options, not native agent flags.`,
      );
  }
  return options;
}
