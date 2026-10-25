import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveExecutable } from "./process.js";

const execute = promisify(execFile);

export interface TreerInterface {
  port: number;
  instanceId: string;
  capabilities: string[];
  uiPath: string;
}

interface RegistrationOptions {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  warn?: (message: string) => void;
  // Dependency injection keeps tests away from the user's actual Treer runtime.
  resolve?: typeof resolveExecutable;
  run?: (
    executable: string,
    args: string[],
    signal?: AbortSignal,
  ) => Promise<unknown>;
}

/** Register once. Controller expiry handles cleanup without deleting a newer registration. */
export async function registerTreerInterface(
  descriptor: TreerInterface,
  options: RegistrationOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  if (
    !env.TREER_AGENT_ID?.trim() ||
    env.AIS_AUTO_REGISTER === "0" ||
    options.signal?.aborted
  )
    return false;
  const warn = options.warn ?? console.error;
  const executable = await (options.resolve ?? resolveExecutable)("treer");
  if (!executable) {
    warn(
      "Treer auto-registration skipped: treer is not on PATH. Local UI remains available.",
    );
    return false;
  }
  const args = [
    "interface",
    "register",
    "--port",
    String(descriptor.port),
    "--instance-id",
    descriptor.instanceId,
    "--ui-path",
    descriptor.uiPath,
    ...descriptor.capabilities.flatMap((capability) => [
      "--capability",
      capability,
    ]),
  ];
  const run =
    options.run ??
    ((command, argv, signal) =>
      execute(command, argv, {
        env,
        signal,
        timeout: 5000,
        killSignal: "SIGKILL",
        maxBuffer: 128 * 1024,
        windowsHide: true,
      }));
  try {
    await run(executable, args, options.signal);
    return !options.signal?.aborted;
  } catch (error) {
    if (!options.signal?.aborted) {
      warn(
        `Treer auto-registration failed; local UI remains available: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return false;
  }
}
