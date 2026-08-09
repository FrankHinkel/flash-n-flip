import fs from "node:fs";

export const versionManifests = [
  { path: "package.json", field: ["version"] },
  { path: "apps/admin/package.json", field: ["version"] },
  { path: "apps/api/package.json", field: ["version"] },
  { path: "apps/apple/package.json", field: ["version"] },
  { path: "apps/web/package.json", field: ["version"] },
  { path: "packages/api-client/package.json", field: ["version"] },
  { path: "packages/design/package.json", field: ["version"] },
  { path: "packages/direct-connect-webstack/package.json", field: ["version"] },
  { path: "packages/domain/package.json", field: ["version"] },
  { path: "packages/i18n/package.json", field: ["version"] },
  { path: "packages/scheduler/package.json", field: ["version"] },
  { path: "packages/sync/package.json", field: ["version"] },
];

export function versionFromText(manifest, text) {
  let value = JSON.parse(text);
  for (const field of manifest.field) value = value[field];
  if (typeof value !== "string") {
    throw new Error(`${manifest.path} has no string version`);
  }
  return value;
}

export function readWorkingVersions() {
  return versionManifests.map((manifest) => ({
    ...manifest,
    version: versionFromText(manifest, fs.readFileSync(manifest.path, "utf8")),
  }));
}

export function assertSynchronized(entries) {
  const expected = entries[0]?.version;
  const mismatches = entries.filter((entry) => entry.version !== expected);
  if (!expected || mismatches.length) {
    const details = entries
      .map((entry) => `${entry.path}: ${entry.version}`)
      .join("\n");
    throw new Error(`Version manifests are not synchronized:\n${details}`);
  }
  return expected;
}

export function writeWorkingVersion(version) {
  for (const manifest of versionManifests) {
    const value = JSON.parse(fs.readFileSync(manifest.path, "utf8"));
    let target = value;
    for (const field of manifest.field.slice(0, -1)) target = target[field];
    target[manifest.field.at(-1)] = version;
    fs.writeFileSync(manifest.path, `${JSON.stringify(value, null, 2)}\n`);
  }
}
