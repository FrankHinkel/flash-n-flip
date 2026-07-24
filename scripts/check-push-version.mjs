import { execFileSync } from "node:child_process";
import fs from "node:fs";

import {
  assertSynchronized,
  versionFromText,
  versionManifests,
} from "./version-manifests.mjs";

const zeroOid = /^0+$/;
const updates = fs
  .readFileSync(0, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split(/\s+/));

function versionAt(oid) {
  const entries = versionManifests.map((manifest) => ({
    ...manifest,
    version: versionFromText(
      manifest,
      execFileSync("git", ["show", `${oid}:${manifest.path}`], {
        encoding: "utf8",
      }),
    ),
  }));
  return assertSynchronized(entries);
}

try {
  for (const [localRef, localOid, , remoteOid] of updates) {
    const branch = /^refs\/heads\/codex\/v(\d+)\.(\d+)\.x$/.exec(localRef);
    if (!branch || zeroOid.test(localOid)) continue;

    const localVersion = versionAt(localOid);
    const localMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(localVersion);
    if (!localMatch) {
      throw new Error(`Invalid local version ${localVersion}.`);
    }
    if (localMatch[1] !== branch[1] || localMatch[2] !== branch[2]) {
      throw new Error(
        `${localRef} requires version ${branch[1]}.${branch[2]}.x, found ${localVersion}.`,
      );
    }

    if (zeroOid.test(remoteOid)) {
      const initial = `${branch[1]}.${branch[2]}.0`;
      if (localVersion !== initial) {
        throw new Error(
          `The first push of ${localRef} must use ${initial}, found ${localVersion}.`,
        );
      }
      continue;
    }

    const remoteText = execFileSync(
      "git",
      ["show", `${remoteOid}:package.json`],
      { encoding: "utf8" },
    );
    const remoteVersion = versionFromText(versionManifests[0], remoteText);
    const remoteMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(remoteVersion);
    if (!remoteMatch) {
      throw new Error(`Invalid remote version ${remoteVersion}.`);
    }
    const expected = `${remoteMatch[1]}.${remoteMatch[2]}.${
      Number(remoteMatch[3]) + 1
    }`;
    if (localVersion !== expected) {
      throw new Error(
        `Every push to ${localRef} must increment 0.0.1: expected ${expected}, found ${localVersion}.\nRun pnpm version:bump, commit the version change, and push again.`,
      );
    }
  }
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
}
