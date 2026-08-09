import { cp, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const source = resolve(workspace, "packages/direct-connect-webstack/dist");
const connectSource = resolve(source, "connect");
const target = resolve(workspace, "apps/web/public/connect");

await mkdir(target, { recursive: true });
for (const entry of await readdir(connectSource, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  await cp(resolve(connectSource, entry.name), resolve(target, entry.name));
}
await cp(
  resolve(source, "trusted-webstack-keys.json"),
  resolve(workspace, "apps/web/public/trusted-webstack-keys.json"),
);
