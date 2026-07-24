import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-readability.mjs",
);

function fixture(css) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "flashcards-readability-"),
  );
  const web = path.join(root, "apps", "web");
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(path.join(web, "styles.css"), css);
  return root;
}

test("passes a readable literal color pair", () => {
  const root = fixture(
    ".message { color: #111111; background: #ffffff; font-size: 16px; }",
  );
  const output = execFileSync(process.execPath, [script, root], {
    encoding: "utf8",
  });
  assert.match(output, /0 failure\(s\)/);
});

test("fails an unreadable literal color pair", () => {
  const root = fixture(
    ".message { color: #777777; background: #888888; font-size: 16px; }",
  );
  const result = spawnSync(process.execPath, [script, root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIL .*1\.26:1, requires 4\.5:1/);
});

test("routes theme-dependent pairs to rendered review", () => {
  const root = fixture(
    ":root { --ink: #111111; --paper: #ffffff; } .message { color: var(--ink); background: var(--paper); }",
  );
  const output = execFileSync(process.execPath, [script, root], {
    encoding: "utf8",
  });
  assert.match(output, /rendered contrast required/);
  assert.match(output, /0 failure\(s\), 1 review item\(s\)/);
});

test("does not report intentionally hidden zero-size labels as tiny text", () => {
  const root = fixture(
    ".icon-only { color: #111111; background: #ffffff; font-size: 0; }",
  );
  const output = execFileSync(process.execPath, [script, root], {
    encoding: "utf8",
  });
  assert.doesNotMatch(output, /tiny Web text/);
});
