import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cli = path.join(toolRoot, "src", "cli.mjs");

const source = String.raw`
\version "2.24.4"
melody = \relative c' { \key c \major \time 4/4 c4 d e f }
\score { \new Staff \melody }
`;

test("CLI writes ABC and a JSON report to explicit destinations", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-cli-"));
  const input = path.join(directory, "input.ly");
  const output = path.join(directory, "output.abc");
  const report = path.join(directory, "output.json");
  await writeFile(input, source, "utf8");

  const result = spawnSync(
    process.execPath,
    [cli, input, "--output", output, "--report", report],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(output, "utf8"), /^X:1$/mu);
  assert.equal(
    JSON.parse(await readFile(report, "utf8")).format,
    "fnf-ly2abc-report",
  );
});

test("CLI inspection does not create an ABC file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-inspect-"));
  const input = path.join(directory, "input.ly");
  await writeFile(input, source, "utf8");
  const result = spawnSync(process.execPath, [cli, input, "--inspect"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).scoreCount, 1);
});

test("CLI rejects misleading extensions and refuses to overwrite input", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-reject-"));
  const disguised = path.join(directory, "score.txt");
  const input = path.join(directory, "score.ly");
  await writeFile(disguised, source, "utf8");
  await writeFile(input, source, "utf8");

  const extensionResult = spawnSync(process.execPath, [cli, disguised], {
    encoding: "utf8",
  });
  assert.equal(extensionResult.status, 1);
  assert.match(extensionResult.stderr, /\.ly extension/u);

  const overwriteResult = spawnSync(
    process.execPath,
    [cli, input, "--output", input],
    { encoding: "utf8" },
  );
  assert.equal(overwriteResult.status, 1);
  assert.match(overwriteResult.stderr, /must not overwrite/u);
});

test("strict mode rejects a source containing inert Scheme", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-strict-"));
  const input = path.join(directory, "score.ly");
  await writeFile(input, `${source}\n#(display "never executed")\n`, "utf8");
  const result = spawnSync(process.execPath, [cli, input, "--strict"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /scheme-present/u);
});
