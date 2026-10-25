// Compatibility alias. Preparation is idempotent relative to HEAD; the commit
// hook consumes the prepared version without incrementing it a second time.
import { execFileSync } from "node:child_process";
execFileSync(process.execPath, ["scripts/version.mjs", "next"], {
  stdio: "inherit",
});
