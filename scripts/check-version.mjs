import { checkVersions } from "./version.mjs";
import { formatAppVersion } from "../packages/domain/src/app-version.js";

try {
  const state = checkVersions();
  console.log(
    `FNF ${formatAppVersion(state.version)} (${state.version}), Apple build ${state.appleBuildNumber}: synchronized`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
