import {
  assertSynchronized,
  readWorkingVersions,
  writeWorkingVersion,
} from "./version-manifests.mjs";

try {
  const current = assertSynchronized(readWorkingVersions());
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`Version must use numeric major.minor.patch: ${current}`);
  }
  const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  writeWorkingVersion(next);
  console.log(`Version bumped from ${current} to ${next}.`);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
}
