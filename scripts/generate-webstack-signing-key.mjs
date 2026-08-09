import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const secretDirectory = resolve(workspace, ".secrets");
const privateKeyPath = resolve(secretDirectory, "webstack-ed25519.pem");
const trustedKeysPath = resolve(
  workspace,
  "packages/direct-connect-webstack/static/trusted-webstack-keys.json",
);
const keyId = process.argv[2] || "release-2026-01";

await mkdir(secretDirectory, { recursive: true, mode: 0o700 });
let privateKey;
try {
  privateKey = createPrivateKey(await readFile(privateKeyPath));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  const generated = generateKeyPairSync("ed25519");
  privateKey = generated.privateKey;
  await writeFile(
    privateKeyPath,
    privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600 },
  );
}
const publicKeyBase64 = createPublicKey(privateKey)
  .export({ type: "spki", format: "der" })
  .toString("base64");
const trusted = JSON.parse(await readFile(trustedKeysPath, "utf8"));
trusted[keyId] = publicKeyBase64;
await writeFile(trustedKeysPath, `${JSON.stringify(trusted, null, 2)}\n`);

process.stdout.write(`${privateKeyPath}\n${keyId}\n`);
