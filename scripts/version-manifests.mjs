import fs from "node:fs";
import path from "node:path";
import {
  appStoreVersion,
  formatAppVersion,
  parseAppVersion,
} from "../packages/domain/src/app-version.js";

export const versionManifests = [
  "package.json",
  "apps/admin/package.json",
  "apps/api/package.json",
  "apps/apple/package.json",
  "apps/web/package.json",
  "packages/api-client/package.json",
  "packages/design/package.json",
  "packages/direct-connect-webstack/package.json",
  "packages/domain/package.json",
  "packages/i18n/package.json",
  "packages/scheduler/package.json",
  "packages/sync/package.json",
].map((file) => ({ path: file, field: ["version"] }));
export const appleProjectPath =
  "apps/apple/ios/App/App.xcodeproj/project.pbxproj";
export const versionPaths = [
  ...versionManifests.map((entry) => entry.path),
  appleProjectPath,
];
export const versionPolicy = 1;
// Baseline 0.5.0 (2) has already been distributed through TestFlight before
// the first version-policy commit. Never reuse that Apple upload identifier.
export const initialAppleBuildNumber = 2;

export function versionFromText(manifest, text) {
  const value = JSON.parse(text).version;
  if (typeof value !== "string")
    throw new Error(`${manifest.path} has no string version`);
  parseAppVersion(value);
  return value;
}
export function readWorkingVersions(root = process.cwd()) {
  return versionManifests.map((manifest) => ({
    ...manifest,
    version: versionFromText(
      manifest,
      fs.readFileSync(path.join(root, manifest.path), "utf8"),
    ),
  }));
}
export function assertSynchronized(entries) {
  const expected = entries[0]?.version;
  if (!expected || entries.some((entry) => entry.version !== expected)) {
    throw new Error(
      `Version manifests are not synchronized:\n${entries.map((entry) => `${entry.path}: ${entry.version}`).join("\n")}`,
    );
  }
  return expected;
}
export function readVersionMetadata(text) {
  const metadata = JSON.parse(text);
  parseAppVersion(metadata.version);
  if (metadata.fnfVersionPolicy !== versionPolicy)
    throw new Error("The central FNF version policy is missing");
  if (
    !Number.isSafeInteger(metadata.appleBuildNumber) ||
    metadata.appleBuildNumber < 1
  )
    throw new Error("Invalid Apple upload build number");
  return {
    version: metadata.version,
    appleBuildNumber: metadata.appleBuildNumber,
  };
}
export function replaceManifest(text, state, central = false) {
  const value = JSON.parse(text);
  value.version = state.version;
  if (central) {
    value.fnfVersionPolicy = versionPolicy;
    value.appleBuildNumber = state.appleBuildNumber;
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}
export function appleValues(state) {
  return {
    MARKETING_VERSION: appStoreVersion(state.version),
    CURRENT_PROJECT_VERSION: String(state.appleBuildNumber),
    FNF_PRODUCT_VERSION: state.version,
    FNF_DISPLAY_VERSION: formatAppVersion(state.version),
  };
}
export function replaceAppleVersions(text, state) {
  let next = text;
  for (const [key, value] of Object.entries(appleValues(state))) {
    const pattern = new RegExp(`(${key} = )[^;]+;`, "g");
    if (!pattern.test(next)) {
      if (!key.startsWith("FNF_"))
        throw new Error(`Xcode setting missing: ${key}`);
      next = next.replace(
        /(\s*)MARKETING_VERSION = [^;]+;/g,
        (match) => `${match}\n\t\t\t\t${key} = ${value};`,
      );
    } else
      next = next.replace(pattern, (_match, prefix) => `${prefix}${value};`);
  }
  return next;
}
export function assertAppleVersions(text, state) {
  const configurationList = text.match(
    /\/\* Build configuration list for PBXNativeTarget "App" \*\/ = \{[\s\S]*?buildConfigurations = \(([\s\S]*?)\);/,
  );
  const count = configurationList?.[1].match(/\b[A-F0-9]{24}\b/g)?.length;
  if (!count || count < 2)
    throw new Error("Missing Xcode app build configurations");
  for (const [key, value] of Object.entries(appleValues(state))) {
    const found = [
      ...text.matchAll(new RegExp(`\\b${key} = ([^;]+);`, "g")),
    ].map((match) => match[1]);
    if (found.length !== count || found.some((entry) => entry !== value))
      throw new Error(
        `Xcode ${key} must be ${value} in every app configuration`,
      );
  }
}
export function writeWorkingVersion(
  version,
  appleBuildNumber,
  root = process.cwd(),
) {
  const state = { version, appleBuildNumber };
  parseAppVersion(version);
  for (const manifest of versionManifests) {
    const file = path.join(root, manifest.path);
    fs.writeFileSync(
      file,
      replaceManifest(
        fs.readFileSync(file, "utf8"),
        state,
        manifest.path === "package.json",
      ),
    );
  }
  const project = path.join(root, appleProjectPath);
  fs.writeFileSync(
    project,
    replaceAppleVersions(fs.readFileSync(project, "utf8"), state),
  );
}
