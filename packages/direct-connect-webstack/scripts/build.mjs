import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(packageRoot, "dist");
const packageMetadata = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);
const buildId = packageMetadata.version;

const renderStatic = async (name) => {
  const source = await readFile(resolve(packageRoot, "static", name), "utf8");
  await writeFile(
    resolve(outputDirectory, name),
    source.replaceAll("__FNF_BUILD_ID__", buildId),
  );
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  renderStatic("index.html"),
  cp(
    resolve(packageRoot, "static/styles.css"),
    resolve(outputDirectory, "styles.css"),
  ),
  renderStatic("sw.js"),
  build({
    entryPoints: [resolve(packageRoot, "src/app.ts")],
    outfile: resolve(outputDirectory, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["safari15"],
    minify: true,
    sourcemap: false,
    legalComments: "none",
  }),
]);

const scriptPath = resolve(outputDirectory, "app.js");
const script = await readFile(scriptPath, "utf8");
await writeFile(scriptPath, script.replace(/[ \t]+$/gm, ""));
