import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SavedSession {
  agent: string;
  cwd: string;
  sessionId: string;
}

function sessionFile(directory: string, agent: string, cwd: string) {
  const key = createHash("sha256")
    .update(JSON.stringify([agent, cwd]))
    .digest("hex");
  return join(directory, `${key}.json`);
}

export class SessionStore {
  constructor(
    private readonly directory = join(homedir(), ".agent-launch", "sessions"),
  ) {}

  async latest(agent: string, cwd: string): Promise<string | undefined> {
    try {
      const record = JSON.parse(
        await readFile(sessionFile(this.directory, agent, cwd), "utf8"),
      ) as SavedSession;
      if (
        record.agent !== agent ||
        record.cwd !== cwd ||
        typeof record.sessionId !== "string" ||
        !record.sessionId
      ) {
        throw new Error("Invalid saved agent-launch session");
      }
      return record.sessionId;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(record: SavedSession) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = sessionFile(this.directory, record.agent, record.cwd);
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
    await rename(temporary, file);
  }
}
