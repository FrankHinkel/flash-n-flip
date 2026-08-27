#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const outputPath = join(
  root,
  "apps/api/src/services/third-party-notices.generated.ts",
);
const markdownPath = join(root, "docs/THIRD_PARTY_NOTICES.md");
const htmlPath = join(
  root,
  "apps/web/public/legal/documents/third-party-notices.html",
);
const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "CC0-1.0",
  "GPL-2.0-or-later",
  "GPL-3.0-or-later",
  "ISC",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "Unicode-3.0",
  "Unlicense",
  "Zlib",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalized = (value) => value.replace(/\r\n/g, "\n").trim() + "\n";
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const safeExternalUrl = (value) => {
  if (typeof value !== "string") return null;
  const candidate = value.trim().replace(/^git\+/, "");
  try {
    const url = new URL(candidate);
    if (url.pathname.endsWith(".git")) url.pathname = url.pathname.slice(0, -4);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};
const webstackRequire = createRequire(
  join(root, "packages/direct-connect-webstack/package.json"),
);
const { build } = webstackRequire("esbuild");
const webPortable = join(root, "apps/web/portable");
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
const portableBundle = await build({
  entryPoints: [join(webPortable, "entry.tsx")],
  bundle: true,
  write: false,
  metafile: true,
  outdir: join(root, ".third-party-notice-audit"),
  format: "iife",
  platform: "browser",
  target: ["safari15"],
  assetNames: "assets/[name]-[hash]",
  loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
  alias: {
    "next/link": join(webPortable, "link.tsx"),
    "next/navigation": join(webPortable, "navigation.ts"),
  },
  plugins: [browserOnlyNodeFallbacks],
  define: {
    "process.env.NEXT_PUBLIC_FNF_APP_VERSION": JSON.stringify("audit"),
    "process.env.NEXT_PUBLIC_FNF_WEB_BUILD_TIME": JSON.stringify(""),
  },
});

const packages = new Map();
const addPackagePath = (path) => {
  const manifestPath = join(path, "package.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name && manifest.version) {
    packages.set(`${manifest.name}@${manifest.version}`, path);
  }
};
for (const input of Object.keys(portableBundle.metafile.inputs)) {
  const absoluteInput = resolve(root, input);
  const marker = `${sep}node_modules${sep}`;
  const nodeModulesIndex = absoluteInput.lastIndexOf(marker);
  if (nodeModulesIndex < 0) continue;
  const packageParts = absoluteInput
    .slice(nodeModulesIndex + marker.length)
    .split(sep);
  const packageName = packageParts[0].startsWith("@")
    ? packageParts.slice(0, 2).join(sep)
    : packageParts[0];
  addPackagePath(
    join(absoluteInput.slice(0, nodeModulesIndex + marker.length), packageName),
  );
}
// Capacitor loads this package as native Swift code, so it is not visible in
// the JavaScript bundle graph even though it ships in the Apple application.
addPackagePath(
  join(root, "apps/apple/node_modules/@capacitor-community/sqlite"),
);

const licenseFiles = (directory) =>
  readdirSync(directory)
    .filter((name) => /^(?:licen[cs]e|copying|notice)(?:\..*)?$/i.test(name))
    .sort();

const records = [];
const errors = [];
for (const [key, path] of [...packages].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  const manifestPath = join(path, "package.json");
  // pnpm reports optional packages for every supported platform. Only files
  // installed for this reproducible build are part of its concrete graph.
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const declaredLicense =
    typeof manifest.license === "string" ? manifest.license.trim() : "";
  let license = declaredLicense;
  const files = licenseFiles(path);
  if (!license && files.length) {
    const candidate = readFileSync(join(path, files[0]), "utf8");
    if (/permission is hereby granted, free of charge/i.test(candidate))
      license = "MIT";
  }
  const choices = license
    .replace(/[()]/g, "")
    .split(/\s+(?:OR|AND)\s+/i)
    .map((value) => value.trim());
  if (!license || !choices.every((choice) => allowedLicenses.has(choice))) {
    errors.push(
      `${key}: unsupported or missing license ${JSON.stringify(license)}`,
    );
  }
  // An OR expression grants a choice. Record the first permitted branch as
  // the license Flash-n-Flip actually exercises instead of implying that all
  // alternative copyleft terms apply simultaneously.
  if (/\s+OR\s+/i.test(license)) license = choices[0];
  let documents = files.map((name) => ({
    name,
    text: normalized(readFileSync(join(path, name), "utf8")),
  }));
  const author =
    typeof manifest.author === "string"
      ? manifest.author
      : manifest.author?.name ||
        (Array.isArray(manifest.contributors)
          ? manifest.contributors
              .map((item) => (typeof item === "string" ? item : item?.name))
              .filter(Boolean)
              .join(", ")
          : "") ||
        "See bundled license text";
  const repository =
    typeof manifest.repository === "string"
      ? manifest.repository
      : manifest.repository?.url || manifest.homepage || "";
  const licenseTextBundled = documents.length > 0;
  if (!documents.length) {
    documents = [
      {
        name: "DECLARED-LICENSE",
        text: normalized(
          [
            `Package: ${manifest.name}`,
            `Declared license: ${license}`,
            `Copyright / attribution: ${author}`,
            choices.length === 1
              ? `Canonical license reference: https://spdx.org/licenses/${choices[0]}.html`
              : "Canonical license references: " +
                choices
                  .map((choice) => `https://spdx.org/licenses/${choice}.html`)
                  .join(" · "),
            "",
            "The published package did not contain a separate license or notice file. This record preserves its license declaration and attribution; the canonical full text is linked above.",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      },
    ];
  }
  records.push({
    name: manifest.name,
    version: manifest.version,
    declaredLicense,
    license,
    attribution: author,
    repository,
    licenseTextBundled,
    documents,
  });
}

const assetRecords = [
  {
    name: "FreePats Upright Piano KW (small)",
    version: "2019-07-03",
    license: "CC0-1.0",
    attribution:
      "Recorded by Gonzalo and Roberto; provenance retained voluntarily",
    repository: "https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html",
    licenseTextBundled: true,
    documents: [
      {
        name: "PROVENANCE",
        text: normalized(
          readFileSync(
            join(root, "docs/licenses/freepats-upright-piano-kw.md"),
            "utf8",
          ),
        ),
      },
      {
        name: "CC0-1.0.txt",
        text: normalized(
          readFileSync(join(root, "docs/licenses/CC0-1.0.txt"), "utf8"),
        ),
      },
    ],
  },
  (() => {
    const path = join(
      root,
      "node_modules/.pnpm/lucide-static@1.27.0/node_modules/lucide-static",
    );
    const manifest = JSON.parse(
      readFileSync(join(path, "package.json"), "utf8"),
    );
    return {
      name: "Lucide generated SVG assets",
      version: manifest.version,
      license: manifest.license,
      attribution:
        manifest.author?.name ?? manifest.author ?? "Lucide Contributors",
      repository: "https://lucide.dev",
      licenseTextBundled: true,
      documents: [
        {
          name: "LICENSE",
          text: normalized(readFileSync(join(path, "LICENSE"), "utf8")),
        },
      ],
    };
  })(),
];
records.push(...assetRecords);

const swiftPins = JSON.parse(
  readFileSync(
    join(
      root,
      "apps/apple/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
    ),
    "utf8",
  ),
).pins;
for (const pin of swiftPins) {
  const version = pin.state.version ?? pin.state.branch ?? pin.state.revision;
  const snapshot = join(root, "docs/licenses/swift", `${pin.identity}.txt`);
  if (!existsSync(snapshot)) {
    errors.push(
      `${pin.identity}@${version}: pinned Swift license snapshot missing`,
    );
    continue;
  }
  const text = normalized(readFileSync(snapshot, "utf8"));
  const firstLine = text
    .split("\n")
    .find((line) => line.startsWith("SPDX-License-Identifier:"));
  const license = firstLine?.split(":").slice(1).join(":").trim() ?? "";
  if (!allowedLicenses.has(license))
    errors.push(
      `${pin.identity}@${version}: unsupported Swift license ${license}`,
    );
  records.push({
    name: pin.identity,
    version,
    license,
    attribution: pin.location,
    repository: pin.location,
    licenseTextBundled: true,
    documents: [{ name: "LICENSE", text }],
  });
}

if (errors.length) {
  throw new Error(
    `Third-party notice generation failed:\n${errors.join("\n")}`,
  );
}

records.sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(
    `${right.name}@${right.version}`,
  ),
);
const graphDigest = sha256(
  records
    .map(
      ({ name, version, declaredLicense, license, documents }) =>
        `${name}@${version}:${declaredLicense || license}:${documents.map(({ text }) => sha256(text)).join(",")}`,
    )
    .join("\n"),
);
const documentGroups = new Map();
for (const record of records) {
  for (const document of record.documents) {
    const digest = sha256(document.text);
    const group = documentGroups.get(digest) ?? {
      digest,
      text: document.text,
      components: [],
    };
    group.components.push({ name: record.name, license: record.license });
    documentGroups.set(digest, group);
  }
}

const escapeCell = (value) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
const metadataLines = [
  "# Third-Party Notices",
  "",
  "Generated deterministically from the Apple application runtime bundle, native package pins, native SQLite plugin, and bundled-asset provenance. Do not edit this file manually.",
  "",
  `- Components: ${records.length}`,
  `- Unique license/notice documents: ${documentGroups.size}`,
  "",
  "The installed Flash-n-Flip Help reference contains the license and notice texts for components that are actually shipped in the Apple application. Exact versions and integrity hashes remain available in the internal build inventory and lockfiles instead of being exposed in the Help UI.",
  "",
];
const componentTableLines = [
  "| Component | License | Copyright / attribution |",
  "| --- | --- | --- |",
  ...records.map(
    (record) =>
      `| ${escapeCell(record.name)} | ${escapeCell(record.license)} | ${escapeCell(record.attribution)} |`,
  ),
  "",
];
const markdown = await format(
  normalized([...metadataLines, ...componentTableLines].join("\n")),
  {
    parser: "markdown",
  },
);

const helpSource = await format(
  normalized(
    [
      "# Third-Party Licenses",
      "",
      `Flash-n-Flip ships ${records.length} third-party components covered by ${documentGroups.size} distinct license or notice documents.`,
      "",
      "[Open complete offline notices](/legal/documents/third-party-notices.html)",
      "",
      "The complete document is installed with the application and remains available without an internet connection. External project and canonical license links are supplementary only.",
    ].join("\n"),
  ),
  { parser: "markdown" },
);

const pages = [
  {
    key: "third-party-overview",
    title: "Third-Party Notices",
    source: helpSource,
  },
];
for (const page of pages) {
  if (page.source.length > 50_000)
    throw new Error(
      `${page.key}: generated help page exceeds 50,000 characters`,
    );
}

const generatedSource =
  `// Generated by scripts/generate-third-party-notices.mjs. Do not edit.\n` +
  `export const thirdPartyNoticeGraphSha256 = ${JSON.stringify(graphDigest)};\n` +
  `export const thirdPartyNoticeComponentCount = ${records.length};\n` +
  `export const thirdPartyNoticePages = ${JSON.stringify(pages, null, 2)} as const;\n`;
const generated = await format(generatedSource, { parser: "typescript" });

const sortedDocumentGroups = [...documentGroups.values()].sort((left, right) =>
  left.digest.localeCompare(right.digest),
);
const publicRecords = [
  ...records
    .reduce((groups, record) => {
      const group = groups.get(record.name) ?? {
        name: record.name,
        licenses: new Set(),
        attributions: new Set(),
        repository: null,
      };
      group.licenses.add(record.license);
      if (record.attribution) group.attributions.add(record.attribution);
      group.repository ??= safeExternalUrl(record.repository);
      groups.set(record.name, group);
      return groups;
    }, new Map())
    .values(),
].sort((left, right) => left.name.localeCompare(right.name));
const componentItems = publicRecords
  .map((record) => {
    const projectUrl = record.repository;
    const name = projectUrl
      ? `<a href="${escapeHtml(projectUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(record.name)}</a>`
      : escapeHtml(record.name);
    const licenses = [...record.licenses]
      .sort()
      .map((license) => {
        const licenseUrl = `https://spdx.org/licenses/${encodeURIComponent(license)}.html`;
        return `<a href="${escapeHtml(licenseUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(license)}</a>`;
      })
      .join(" · ");
    const attributions = [...record.attributions].sort().join(" · ");
    return `<li><strong>${name}</strong><span>${licenses}</span>${attributions ? `<small>${escapeHtml(attributions)}</small>` : ""}</li>`;
  })
  .join("\n");
const noticeItems = sortedDocumentGroups
  .map((group, index) => {
    const components = [
      ...new Map(
        group.components.map((component) => [
          `${component.name}\0${component.license}`,
          component,
        ]),
      ).values(),
    ].sort((left, right) => left.name.localeCompare(right.name));
    const label = components
      .slice(0, 3)
      .map(({ name }) => name)
      .join(", ");
    const remainder = Math.max(0, components.length - 3);
    return [
      `<details id="notice-${String(index + 1).padStart(2, "0")}" open>`,
      `<summary>Notice ${String(index + 1).padStart(2, "0")} · ${escapeHtml(label)}${remainder ? ` and ${remainder} more` : ""}</summary>`,
      "<h3>Applies to</h3>",
      "<ul>",
      ...components.map(
        ({ name, license }) =>
          `<li>${escapeHtml(name)} — ${escapeHtml(license)}</li>`,
      ),
      "</ul>",
      "<h3>License or notice text</h3>",
      `<pre>${escapeHtml(group.text.trimEnd())}</pre>`,
      "</details>",
    ].join("\n");
  })
  .join("\n");
const html = normalized(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
  <title>Third-Party Licenses · Flash-n-Flip</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.55; background: #f7f8fc; color: #171a24; }
    body { max-width: 72rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); }
    a { color: #243cbb; text-underline-offset: .15em; }
    a:focus-visible, summary:focus-visible { outline: .2rem solid #b26400; outline-offset: .2rem; border-radius: .2rem; }
    .back { display: inline-flex; min-height: 2.75rem; align-items: center; padding: 0 1rem; border-radius: .75rem; background: #243cbb; color: #fff; font-weight: 700; text-decoration: none; }
    h1 { font-size: clamp(1.75rem, 5vw, 2.6rem); line-height: 1.15; }
    h2 { margin-top: 2.5rem; font-size: clamp(1.35rem, 3vw, 1.8rem); }
    .components { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: .75rem; padding: 0; list-style: none; }
    .components > li { display: grid; gap: .25rem; padding: .85rem 1rem; border: 1px solid #aeb4c4; border-radius: .75rem; overflow-wrap: anywhere; }
    .components span, .components small { display: block; }
    details { margin: 1rem 0; padding: .8rem 1rem; border: 1px solid #aeb4c4; border-radius: .75rem; }
    summary { min-height: 2.75rem; padding: .5rem 0; cursor: pointer; font-weight: 750; overflow-wrap: anywhere; }
    pre { max-width: 100%; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 1rem; border-radius: .6rem; background: #e8ebf3; color: #171a24; font: 500 .9rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    @media (prefers-color-scheme: dark) {
      :root { background: #1f2330; color: #f4f6ff; }
      a { color: #adc6ff; }
      .back { background: #adc6ff; color: #111522; }
      .components > li, details { border-color: #697185; }
      pre { background: #151923; color: #f4f6ff; }
      a:focus-visible, summary:focus-visible { outline-color: #ffd166; }
    }
    @media print { .back { display: none; } body { max-width: none; } details { break-inside: avoid; } }
  </style>
</head>
<body>
  <a class="back" href="/app">Back to Flash-n-Flip</a>
  <main>
    <h1>Third-Party Licenses</h1>
    <p>This offline document accompanies Flash-n-Flip. It contains the license and notice texts for ${records.length} shipped package and asset instances across ${publicRecords.length} component names. External links are supplementary and are not required to read the bundled notices.</p>
    <h2>Components</h2>
    <ul class="components">
${componentItems}
    </ul>
    <h2>Complete license and notice texts</h2>
${noticeItems}
  </main>
</body>
</html>`);

const writeOrCheck = (path, value) => {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (check) {
    if (current !== value)
      throw new Error(
        `${relative(root, path)} is stale; run pnpm notices:generate`,
      );
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
};
writeOrCheck(outputPath, generated);
writeOrCheck(markdownPath, markdown);
writeOrCheck(htmlPath, html);
console.log(
  `Third-party notices: ${records.length} components, ${documentGroups.size} unique documents, ${graphDigest}`,
);
