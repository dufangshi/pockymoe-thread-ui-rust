# agent-launch

Structured browser chat for local ACP coding agents. Node.js 20 or later is required.

Install or update from the public repository with the same command:

```bash
curl -fsSL https://raw.githubusercontent.com/dufangshi/pockymoe-thread-ui-rust/main/scripts/install.sh | sh
```

Requires npm, curl, and tar. Uses your configured npm global prefix; no git or pnpm is
needed. Re-running the installer updates the CLI and preserves saved session metadata.
The CLI is downloaded
from GitHub; npm only builds and installs it locally and fetches dependencies.
No npm registry release of agent-launch is required.

```bash
agent-launch codex
agent-launch claude --resume
agent-launch codex --resume <session-id> --cwd /path/to/project
agent-launch grok --no-open
agent-launch cursor --port 8080
```

Uses your current directory, environment, and existing agent login. The agent CLI must
already be installed. Codex needs `@agentclientprotocol/codex-acp`; Claude needs
`@agentclientprotocol/claude-agent-acp`. Missing adapters are reported without automatic
installation. Grok and Cursor use their configured native ACP commands.

With no ID, `--resume` selects the most recent session for the harness and directory
recorded under `~/.agent-launch/sessions`. Supply an ID to restore another session known
to the backend. Requires advertised ACP `session/load` or `session/resume` support.
`session/load` replays history into a reconstructed history group; `session/resume`
restores context without replaying the transcript. Restoration errors never create a
new session. Actual session persistence belongs to the backend.

The launcher opens a browser on an available localhost port. Use `--no-open` to open
the printed URL yourself. Closing the browser does not stop the agent. Ctrl-C stops it.
Native agent CLI flags are not forwarded. Treer is not required.

Inside a managed Treer Agent (`TREER_AGENT_ID` present), the launcher automatically
registers its actual bound port and unique process instance using `treer interface
register`. Successful registration embeds the UI in Treer instead of opening a local
browser. Multiple launchers use system-assigned ports; restarts register the new port.
An explicit occupied `--port` fails instead of moving silently.

Outside Treer, registration is skipped. A missing `treer` executable, failed command,
or five-second registration timeout leaves the local UI available. Set
`AIS_AUTO_REGISTER=0` to opt out. Registration happens once, without a heartbeat.
On exit the server closes and Treer's instance-aware status monitor expires the old
interface. The launcher never unconditionally clears a newer process's registration.
Each Treer Agent identity has one active interface; the latest registration wins.

Current limitation: the inherited runtime automatically approves ACP permission
requests; interactive approval UI is not implemented.
