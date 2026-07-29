import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = ["package.json", "pnpm-lock.yaml", "apps/web/package.json"];
const forbidden = ["@tiptap/", "prosemirror-"];
const findings = [];

for (const file of files) {
  const content = await readFile(resolve(root, file), "utf8");
  for (const dependency of forbidden) {
    if (content.includes(dependency)) findings.push(`${file}: ${dependency}`);
  }
}

if (findings.length) {
  console.error(
    `Blacklisted editor dependencies found:\n${findings
      .map((finding) => `- ${finding}`)
      .join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log("Editor dependency blacklist passed.");
}
