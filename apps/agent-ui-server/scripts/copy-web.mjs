import { cp, rm } from "node:fs/promises";
const target = new URL("../web-dist/", import.meta.url);
await rm(target, { recursive: true, force: true });
await cp(new URL("../../agent-ui-web/dist/", import.meta.url), target, {
  recursive: true,
});
