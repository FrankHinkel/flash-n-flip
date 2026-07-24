import {
  assertSynchronized,
  readWorkingVersions,
} from "./version-manifests.mjs";

try {
  const version = assertSynchronized(readWorkingVersions());
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Version must use numeric major.minor.patch: ${version}`);
  }
  console.log(`Version manifests are synchronized at ${version}.`);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
}
