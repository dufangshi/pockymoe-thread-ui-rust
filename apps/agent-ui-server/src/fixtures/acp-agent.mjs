import { createInterface } from "node:readline";

const mode = process.argv[2] || "load";
const send = (value) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...value })}\n`);
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  const { method, params, id } = request;
  let result = {};
  if (method === "initialize") {
    result = {
      protocolVersion: 1,
      agentCapabilities:
        mode === "load"
          ? { loadSession: true }
          : mode === "resume"
            ? { sessionCapabilities: { resume: {} } }
            : {},
      authMethods: [],
    };
  } else if (method === "session/new") {
    result = { sessionId: "fresh-session" };
  } else if (method === "session/load" || method === "session/resume") {
    if (params.sessionId === "missing") {
      send({ id, error: { code: -32602, message: "Session not found" } });
      continue;
    }
    if (method === "session/load") {
      for (const [sessionUpdate, text] of [
        ["user_message_chunk", "old question"],
        ["agent_message_chunk", "old answer"],
      ]) {
        send({
          method: "session/update",
          params: {
            sessionId: params.sessionId,
            update: { sessionUpdate, content: { type: "text", text } },
          },
        });
      }
    }
  } else if (method === "session/prompt") {
    send({
      method: "session/update",
      params: {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "new answer" },
        },
      },
    });
    result = { stopReason: "end_turn" };
  }
  send({ id, result });
}
