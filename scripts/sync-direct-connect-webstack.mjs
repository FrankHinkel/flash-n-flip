import { cp, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const source = resolve(workspace, "packages/direct-connect-webstack/dist");
const target = resolve(workspace, "apps/web/public/connect");

await mkdir(target, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  await cp(resolve(source, entry.name), resolve(target, entry.name));
}
