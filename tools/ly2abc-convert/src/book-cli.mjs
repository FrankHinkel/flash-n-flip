#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cli = path.join(toolRoot, "src", "cli.mjs");

const usage = "Usage: ./ly2abc.sh <ly-file>\n";

function collectionIdentity(file) {
  const extension = path.extname(file);
  const rawStem = path.basename(file, extension);
  const paper = rawStem.match(/-(a4|let)$/iu)?.[0] ?? "";
  const musicalStem = paper ? rawStem.slice(0, -paper.length) : rawStem;
  const movement = musicalStem.match(/^(.*?)(\d+)$/u);
  return movement
    ? {
        prefix: movement[1],
        paper,
        movement: Number(movement[2]),
        rawStem,
      }
    : { prefix: null, paper, movement: null, rawStem };
}

async function sourceFiles(input) {
  const identity = collectionIdentity(input);
  if (!identity.prefix) return [input];
  const entries = await readdir(path.dirname(input), { withFileTypes: true });
  const candidates = entries.slice(0, 128).flatMap((entry) => {
    if (!entry.isFile() || !/\.ly$/iu.test(entry.name)) return [];
    const candidate = collectionIdentity(entry.name);
    return candidate.prefix === identity.prefix &&
      candidate.paper === identity.paper
      ? [
          {
            path: path.join(path.dirname(input), entry.name),
            movement: candidate.movement,
          },
        ]
      : [];
  });
  if (candidates.length < 2) return [input];
  if (candidates.length > 8)
    throw new Error("A LilyPond tune book may contain at most eight movements");
  return candidates
    .sort((left, right) => left.movement - right.movement)
    .map((candidate) => candidate.path);
}

const renumberTunes = (abc, start) => {
  let next = start;
  const value = abc.replace(/^X:\s*\d+\s*$/gmu, () => `X:${next++}`);
  return { value, next };
};

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 1)
    throw new Error(`Expected one <ly-file>\n${usage}`);
  const input = path.resolve(arguments_[0]);
  if (!/\.ly$/iu.test(input))
    throw new Error("Input must have the .ly extension");
  const files = await sourceFiles(input);
  const identity = collectionIdentity(input);
  const baseName =
    files.length > 1
      ? identity.prefix.replace(/[-_.]+$/u, "")
      : identity.rawStem;
  const output = path.join(path.dirname(input), `${baseName}.abc`);
  const reportPath = path.join(
    path.dirname(input),
    `${baseName}.ly2abc-report.json`,
  );
  const temporary = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-book-"));
  try {
    const tunes = [];
    const reports = [];
    let reference = 1;
    for (let index = 0; index < files.length; index += 1) {
      const abcPath = path.join(temporary, `${index}.abc`);
      const jsonPath = path.join(temporary, `${index}.json`);
      const result = spawnSync(
        process.execPath,
        [cli, files[index], "--output", abcPath, "--report", jsonPath],
        {
          encoding: "utf8",
          shell: false,
          timeout: 20_000,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
        },
      );
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.error || result.status !== 0)
        throw new Error(
          `Conversion failed for ${path.basename(files[index])}${result.error ? `: ${result.error.message}` : ""}`,
        );
      const numbered = renumberTunes(
        await readFile(abcPath, "utf8"),
        reference,
      );
      tunes.push(numbered.value.trim());
      reference = numbered.next;
      reports.push(JSON.parse(await readFile(jsonPath, "utf8")));
    }
    const tuneBook = `${tunes.join("\n\n")}\n`;
    if (tuneBook.length > 150_000)
      throw new Error("Combined ABC tune book exceeds 150,000 characters");
    await writeFile(output, tuneBook, "utf8");
    const report =
      reports.length === 1
        ? reports[0]
        : {
            format: "fnf-ly2abc-book-report",
            version: 1,
            sourceFiles: files.map((file) => path.basename(file)),
            tuneCount: reference - 1,
            safeToUse: reports.every((item) => item.safeToUse),
            reports,
          };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`ABC: ${output}\nBericht: ${reportPath}\n`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(
    `ly2abc-convert: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
