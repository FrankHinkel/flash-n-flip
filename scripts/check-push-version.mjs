import fs from "node:fs";
import { checkVersions } from "./version.mjs";

// A push only validates committed metadata; it never changes the version.
try {
  const revisions = new Set();
  for (const line of fs.readFileSync(0, "utf8").trim().split("\n")) {
    if (!line) continue;
    const [ref, revision] = line.split(/\s+/);
    if (ref.startsWith("refs/heads/") && !/^0+$/.test(revision))
      revisions.add(revision);
  }
  for (const revision of revisions) checkVersions(process.cwd(), revision);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
