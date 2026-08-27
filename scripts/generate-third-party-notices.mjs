#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

const overview = await format(normalized(metadataLines.join("\n")), {
  parser: "markdown",
});

const noticeSections = [...documentGroups.values()]
  .sort((left, right) => left.digest.localeCompare(right.digest))
  .map((group, index) =>
    normalized(
      [
        `## Notice ${String(index + 1).padStart(2, "0")}`,
        "",
        "### Applies to",
        "",
        ...[
          ...new Map(
            group.components.map((component) => [
              `${component.name}\0${component.license}`,
              component,
            ]),
          ).values(),
        ]
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(({ name, license }) => `- ${name} — ${license}`),
        "",
        "### License text",
        "",
        "```text",
        group.text.replace(/```/g, "` ` `").trimEnd(),
        "```",
      ].join("\n"),
    ),
  );
const noticePageSources = [];
let currentSections = [];
let currentLength = 0;
for (const section of noticeSections) {
  if (currentSections.length && currentLength + section.length > 42_000) {
    noticePageSources.push(currentSections);
    currentSections = [];
    currentLength = 0;
  }
  currentSections.push(section);
  currentLength += section.length;
}
if (currentSections.length) noticePageSources.push(currentSections);

const pages = [
  {
    key: "third-party-overview",
    title: "Third-Party Notices",
    source: overview,
  },
  ...noticePageSources.map((sections, index) => ({
    key: `third-party-notices-${String(index + 1).padStart(2, "0")}`,
    title: `Licenses & Notices ${String(index + 1).padStart(2, "0")}`,
    source: normalized(
      [
        `# Licenses & Notices ${String(index + 1).padStart(2, "0")}`,
        "",
        ...sections,
      ].join("\n"),
    ),
  })),
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

const writeOrCheck = (path, value) => {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (check) {
    if (current !== value)
      throw new Error(
        `${relative(root, path)} is stale; run pnpm notices:generate`,
      );
    return;
  }
  writeFileSync(path, value);
};
writeOrCheck(outputPath, generated);
writeOrCheck(markdownPath, markdown);
console.log(
  `Third-party notices: ${records.length} components, ${documentGroups.size} unique documents, ${graphDigest}`,
);
