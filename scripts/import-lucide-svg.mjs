import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("lucide-static/package.json");
const packageRoot = dirname(packageJsonPath);
const defaultSourceDir = join(packageRoot, "icons");
const defaultOutputDir = resolve("packages/design/assets/lucide");
const allowedTags = new Set([
  "svg",
  "path",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
  "rect",
]);
const iconNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateLucideSvg(svg, iconName) {
  if (!iconNamePattern.test(iconName)) {
    throw new Error(`Invalid Lucide icon name: ${iconName}`);
  }
  if (Buffer.byteLength(svg, "utf8") > 64 * 1024) {
    throw new Error(`Lucide SVG is unexpectedly large: ${iconName}`);
  }
  if (!/<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error(`Lucide asset is not a complete SVG: ${iconName}`);
  }
  if (
    /<(?:script|style|foreignObject|iframe|object|embed|image|use|a)\b/i.test(
      svg,
    ) ||
    /\bon[a-z]+\s*=/i.test(svg) ||
    /\b(?:href|xlink:href)\s*=/i.test(svg) ||
    /(?:javascript:|data:|url\s*\()/i.test(svg)
  ) {
    throw new Error(`Unsafe Lucide SVG content: ${iconName}`);
  }

  for (const match of svg.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)) {
    if (!allowedTags.has(match[1])) {
      throw new Error(`Unsupported SVG element <${match[1]}>: ${iconName}`);
    }
  }
  return svg;
}

export async function importLucideSvgs({
  names,
  outputDir = defaultOutputDir,
  sourceDir = defaultSourceDir,
  version,
}) {
  const uniqueNames = [...new Set(names)].sort();
  const missing = [];
  const assets = [];

  for (const name of uniqueNames) {
    if (!iconNamePattern.test(name)) {
      throw new Error(`Invalid Lucide icon name: ${name}`);
    }
    try {
      const svg = await readFile(join(sourceDir, `${name}.svg`), "utf8");
      assets.push({ name, svg: validateLucideSvg(svg, name) });
    } catch (error) {
      if (error?.code === "ENOENT") missing.push(name);
      else throw error;
    }
  }
  if (missing.length) {
    throw new Error(`Missing Lucide SVG icons: ${missing.join(", ")}`);
  }

  await mkdir(outputDir, { recursive: true });
  for (const asset of assets) {
    await writeFile(join(outputDir, `${asset.name}.svg`), asset.svg);
  }

  const manifestPath = join(outputDir, "manifest.json");
  let previousIcons = [];
  try {
    const previous = JSON.parse(await readFile(manifestPath, "utf8"));
    previousIcons = Array.isArray(previous.icons) ? previous.icons : [];
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const icons = [...new Set([...previousIcons, ...uniqueNames])].sort();
  await writeFile(
    manifestPath,
    await format(JSON.stringify({ source: "lucide-static", version, icons }), {
      parser: "json",
    }),
  );
  return icons;
}

export async function checkLucideSvgs({
  outputDir = defaultOutputDir,
  sourceDir = defaultSourceDir,
  version,
}) {
  const manifest = JSON.parse(
    await readFile(join(outputDir, "manifest.json"), "utf8"),
  );
  if (
    manifest.source !== "lucide-static" ||
    manifest.version !== version ||
    !Array.isArray(manifest.icons)
  ) {
    throw new Error("Lucide SVG manifest is stale or invalid.");
  }

  const problems = [];
  for (const name of manifest.icons) {
    try {
      const source = validateLucideSvg(
        await readFile(join(sourceDir, `${name}.svg`), "utf8"),
        name,
      );
      const generated = await readFile(join(outputDir, `${name}.svg`), "utf8");
      if (generated !== source) problems.push(`${name} differs from source`);
    } catch (error) {
      problems.push(`${name}: ${error.message}`);
    }
  }

  const generatedNames = (await readdir(outputDir))
    .filter((name) => name.endsWith(".svg"))
    .map((name) => name.slice(0, -4))
    .sort();
  if (generatedNames.join("\n") !== [...manifest.icons].sort().join("\n")) {
    problems.push("generated SVG files do not match the manifest");
  }
  if (problems.length) {
    throw new Error(`Lucide SVG check failed:\n- ${problems.join("\n- ")}`);
  }
  return manifest.icons;
}

async function main() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const names = args.filter((arg) => arg !== "--check");
  if (check) {
    const icons = await checkLucideSvgs({ version: packageJson.version });
    console.log(`Verified ${icons.length} Lucide SVG asset(s).`);
    return;
  }
  if (!names.length) {
    throw new Error(
      "Provide Lucide names, for example: pnpm assets:lucide sun-moon book-open",
    );
  }
  const icons = await importLucideSvgs({
    names,
    version: packageJson.version,
  });
  console.log(
    `Imported ${names.length} Lucide SVG asset(s); ${icons.length} tracked.`,
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
