#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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
const packageGraph = JSON.parse(
  execFileSync(
    "pnpm",
    [
      "list",
      "--filter",
      "@flashcards/web...",
      "--filter",
      "@flashcards/apple...",
      "--prod",
      "--depth",
      "Infinity",
      "--json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  ),
);

const packages = new Map();
const visit = (entry) => {
  if (!entry || typeof entry !== "object") return;
  const name =
    typeof entry.name === "string"
      ? entry.name
      : typeof entry.from === "string"
        ? entry.from
        : "";
  if (
    name &&
    typeof entry.version === "string" &&
    typeof entry.path === "string" &&
    !entry.version.startsWith("link:") &&
    !entry.path.startsWith(root + "/packages/") &&
    !entry.path.startsWith(root + "/apps/")
  ) {
    packages.set(`${name}@${entry.version}`, entry.path);
  }
  for (const field of ["dependencies", "optionalDependencies"]) {
    for (const dependency of Object.values(entry[field] ?? {}))
      visit(dependency);
  }
};
for (const workspace of packageGraph) visit(workspace);

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
  let license =
    typeof manifest.license === "string" ? manifest.license.trim() : "";
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
            `Package: ${manifest.name}@${manifest.version}`,
            `Declared license: ${license}`,
            `Copyright / attribution: ${author}`,
            repository ? `Upstream: ${repository}` : "",
            choices.length === 1
              ? `Canonical license reference: https://spdx.org/licenses/${choices[0]}.html`
              : "Canonical license references: " +
                choices
                  .map((choice) => `https://spdx.org/licenses/${choice}.html`)
                  .join(" · "),
            "",
            "The published package did not contain a separate license or notice file. This record preserves its package metadata declaration and upstream provenance; the canonical full text is linked above.",
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
      ({ name, version, license, documents }) =>
        `${name}@${version}:${license}:${documents.map(({ text }) => sha256(text)).join(",")}`,
    )
    .join("\n"),
);
const declaredOnlyCount = records.filter(
  (record) => !record.licenseTextBundled,
).length;

const documentGroups = new Map();
for (const record of records) {
  for (const document of record.documents) {
    const digest = sha256(document.text);
    const group = documentGroups.get(digest) ?? {
      digest,
      text: document.text,
      components: [],
    };
    group.components.push(
      `${record.name}@${record.version} (${document.name})`,
    );
    documentGroups.set(digest, group);
  }
}

const escapeCell = (value) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
const metadataLines = [
  "# Third-Party Notices",
  "",
  "Generated deterministically from the production dependency graph, Apple Package.resolved, and bundled-asset provenance. Do not edit this file manually.",
  "",
  `- App version: ${JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version}`,
  `- Dependency graph SHA-256: \`${graphDigest}\``,
  `- Components: ${records.length}`,
  `- Unique license/notice documents: ${documentGroups.size}`,
  `- Package declarations without a bundled license file: ${declaredOnlyCount}`,
  "",
  "The installed Flash-n-Flip Help reference contains every license and notice document shipped by the installed production packages. If an upstream package ships only package-metadata licensing, the reference preserves that declaration, attribution, upstream location, and canonical SPDX link instead of inventing a copyright notice. Build provenance supplies the release commit through `FLASH_N_FLIP_RELEASE_COMMIT` or the platform commit environment.",
  "",
];
const componentTableLines = [
  "| Component | Version | License | Copyright / attribution |",
  "| --- | --- | --- | --- |",
  ...records.map(
    (record) =>
      `| ${escapeCell(record.name)} | ${escapeCell(record.version)} | ${escapeCell(record.license)} | ${escapeCell(record.attribution)} |`,
  ),
  "",
];
const markdown = await format(
  normalized([...metadataLines, ...componentTableLines].join("\n")),
  {
    parser: "markdown",
  },
);

const componentPages = await Promise.all(
  Array.from(
    { length: Math.ceil(records.length / 40) },
    async (_, pageIndex) => {
      const first = pageIndex * 40;
      const rows = records
        .slice(first, first + 40)
        .map(
          (record) =>
            `| ${escapeCell(record.name)} | ${escapeCell(record.version)} | ${escapeCell(record.license)} | ${escapeCell(record.attribution)} |`,
        );
      return {
        key: `third-party-components-${String(pageIndex + 1).padStart(2, "0")}`,
        title: `Third-Party Components ${first + 1}–${first + rows.length}`,
        source: await format(
          normalized(
            [
              `# Third-Party Components ${first + 1}–${first + rows.length}`,
              "",
              "| Component | Version | License | Copyright / attribution |",
              "| --- | --- | --- | --- |",
              ...rows,
            ].join("\n"),
          ),
          { parser: "markdown" },
        ),
      };
    },
  ),
);

const overview = await format(normalized(metadataLines.join("\n")), {
  parser: "markdown",
});

const pages = [
  {
    key: "third-party-overview",
    title: "Third-Party Notices",
    source: overview,
  },
  ...componentPages,
  ...[...documentGroups.values()]
    .sort((left, right) => left.digest.localeCompare(right.digest))
    .map((group, index) => ({
      key: `third-party-license-${group.digest.slice(0, 12)}`,
      title: `License & Notice ${String(index + 1).padStart(2, "0")}`,
      source: normalized(
        [
          `# License & Notice ${String(index + 1).padStart(2, "0")}`,
          "",
          `Document SHA-256: \`${group.digest}\``,
          "",
          "## Applies to",
          "",
          ...group.components.sort().map((component) => `- ${component}`),
          "",
          "## Full text",
          "",
          "```text",
          group.text.replace(/```/g, "` ` `").trimEnd(),
          "```",
          "",
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
