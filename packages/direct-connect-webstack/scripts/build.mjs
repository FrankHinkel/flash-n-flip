import { createHash, createPrivateKey, sign } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const outputDirectory = resolve(packageRoot, "dist");
const connectDirectory = resolve(outputDirectory, "connect");
const ffmpegDirectory = resolve(outputDirectory, "ffmpeg");
const webPortable = resolve(workspaceRoot, "apps/web/portable");
const packageMetadata = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);
const buildVersion = packageMetadata.version;
const minimumBootstrapVersion =
  process.env.FNF_WEBSTACK_MINIMUM_BOOTSTRAP_VERSION || "0.5.119";
if (!/^\d+\.\d+\.\d+$/.test(minimumBootstrapVersion)) {
  throw new Error(
    "FNF_WEBSTACK_MINIMUM_BOOTSTRAP_VERSION must use numeric major.minor.patch",
  );
}

const browserOnlyNodeFallbacks = {
  name: "browser-only-node-fallbacks",
  setup(bundle) {
    bundle.onResolve({ filter: /^node:(?:crypto|fs)$/ }, (args) => ({
      path: args.path,
      namespace: "browser-only-node-fallback",
    }));
    bundle.onLoad(
      { filter: /.*/, namespace: "browser-only-node-fallback" },
      () => ({
        contents: [
          "export const readFileSync = () => { throw new Error('Node filesystem fallback is unavailable in the browser'); };",
          "export const randomFillSync = () => { throw new Error('Node crypto fallback is unavailable in the browser'); };",
        ].join("\n"),
        loader: "js",
      }),
    );
  },
};

const render = async (source, target, buildIdentity = buildVersion) => {
  const value = await readFile(source, "utf8");
  await writeFile(target, value.replaceAll("__FNF_BUILD_ID__", buildIdentity));
};

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(connectDirectory, { recursive: true });
await mkdir(ffmpegDirectory, { recursive: true });
await Promise.all([
  cp(
    resolve(
      workspaceRoot,
      "apps/web/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js",
    ),
    resolve(ffmpegDirectory, "ffmpeg-core.js"),
  ),
  cp(
    resolve(
      workspaceRoot,
      "apps/web/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm",
    ),
    resolve(ffmpegDirectory, "ffmpeg-core.wasm"),
  ),
  build({
    entryPoints: [
      resolve(
        workspaceRoot,
        "apps/web/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js",
      ),
    ],
    outfile: resolve(ffmpegDirectory, "worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["safari15"],
    minify: true,
    legalComments: "none",
  }),
  cp(
    resolve(packageRoot, "static/styles.css"),
    resolve(connectDirectory, "styles.css"),
  ),
  render(
    resolve(webPortable, "index.html"),
    resolve(outputDirectory, "index.html"),
  ),
  cp(
    resolve(packageRoot, "static/trusted-webstack-keys.json"),
    resolve(outputDirectory, "trusted-webstack-keys.json"),
  ),
  cp(
    resolve(workspaceRoot, "apps/web/public/curated"),
    resolve(outputDirectory, "curated"),
    { recursive: true },
  ),
  cp(
    resolve(workspaceRoot, "apps/web/public/brand"),
    resolve(outputDirectory, "brand"),
    { recursive: true },
  ),
  cp(
    resolve(workspaceRoot, "apps/web/public/icons"),
    resolve(outputDirectory, "icons"),
    { recursive: true },
  ),
  cp(
    resolve(workspaceRoot, "apps/web/public/soundfonts"),
    resolve(outputDirectory, "soundfonts"),
    { recursive: true },
  ),
  build({
    entryPoints: [resolve(packageRoot, "src/app.ts")],
    outfile: resolve(connectDirectory, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["safari15"],
    minify: true,
    sourcemap: false,
    legalComments: "none",
    define: {
      "process.env.NEXT_PUBLIC_FNF_APP_VERSION": JSON.stringify(buildVersion),
    },
  }),
  build({
    entryPoints: [resolve(webPortable, "entry.tsx")],
    outfile: resolve(outputDirectory, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["safari15"],
    minify: true,
    sourcemap: false,
    legalComments: "none",
    assetNames: "assets/[name]-[hash]",
    loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
    alias: {
      "next/link": resolve(webPortable, "link.tsx"),
      "next/navigation": resolve(webPortable, "navigation.ts"),
    },
    plugins: [browserOnlyNodeFallbacks],
    define: {
      "process.env.NEXT_PUBLIC_FNF_APP_VERSION": JSON.stringify(buildVersion),
      "process.env.NEXT_PUBLIC_FNF_WEB_BUILD_TIME": JSON.stringify(""),
      "process.env.NEXT_PUBLIC_FNF_PORTABLE_AUDIO_WORKER": JSON.stringify("1"),
    },
  }),
]);

const scriptPaths = [
  resolve(outputDirectory, "app.js"),
  resolve(connectDirectory, "app.js"),
];
for (const scriptPath of scriptPaths) {
  const script = await readFile(scriptPath, "utf8");
  await writeFile(scriptPath, script.replace(/[ \t]+$/gm, ""));
}

const connectAssetIdentity = createHash("sha256")
  .update(await readFile(resolve(connectDirectory, "app.js")))
  .update(await readFile(resolve(connectDirectory, "styles.css")))
  .digest("hex")
  .slice(0, 16);
await render(
  resolve(packageRoot, "static/index.html"),
  resolve(connectDirectory, "index.html"),
  `${buildVersion}-${connectAssetIdentity}`,
);

const walk = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

const mediaType = (path) => {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".woff")) return "font/woff";
  if (path.endsWith(".ttf")) return "font/ttf";
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".mp3")) return "audio/mpeg";
  return "application/octet-stream";
};

const localSigningKeyFile = resolve(
  workspaceRoot,
  ".secrets/webstack-ed25519.pem",
);
const hasLocalSigningKey = await stat(localSigningKeyFile)
  .then(() => true)
  .catch(() => false);
const signingKeyFile =
  process.env.FNF_WEBSTACK_SIGNING_KEY_FILE ||
  (hasLocalSigningKey ? localSigningKeyFile : undefined);
const signingKeyId =
  process.env.FNF_WEBSTACK_SIGNING_KEY_ID ||
  (hasLocalSigningKey ? "release-2026-01" : undefined);
if ((signingKeyFile && !signingKeyId) || (!signingKeyFile && signingKeyId)) {
  throw new Error(
    "FNF_WEBSTACK_SIGNING_KEY_FILE and FNF_WEBSTACK_SIGNING_KEY_ID must be set together",
  );
}
if (signingKeyFile && signingKeyId) {
  const files = (await walk(outputDirectory))
    .filter((path) => !path.endsWith("webstack-release.json"))
    .sort();
  const assets = await Promise.all(
    files.map(async (path) => {
      const bytes = await readFile(path);
      return {
        path: relative(outputDirectory, path).split(sep).join("/"),
        mediaType: mediaType(path),
        byteSize: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const contentIdentity = createHash("sha256")
    .update(assets.map((asset) => `${asset.path}:${asset.sha256}`).join("\n"))
    .digest("hex")
    .slice(0, 16);
  const manifest = {
    format: "flash-n-flip-signed-webstack",
    version: 1,
    buildId: `${buildVersion}-${contentIdentity}`,
    appVersion: buildVersion,
    createdAt: new Date().toISOString(),
    entrypoint: "index.html",
    minimumBootstrapVersion,
    // Keep the signed package readable by the already installed generation-1
    // browser shell. The transferred app negotiates local-sync generation 2
    // only after the handoff has completed.
    protocolGenerations: { rendezvous: 1, localSync: 1, webstack: 1 },
    signingKeyId,
    totalBytes: assets.reduce((sum, asset) => sum + asset.byteSize, 0),
    assets,
  };
  const canonical = (value) => {
    if (value === null || typeof value !== "object")
      return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  };
  const signature = sign(
    null,
    Buffer.from(canonical(manifest)),
    createPrivateKey(await readFile(signingKeyFile)),
  );
  await writeFile(
    resolve(outputDirectory, "webstack-release.json"),
    `${JSON.stringify({ manifest, signatureBase64: signature.toString("base64") })}\n`,
  );
}
