#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { convertLilypondSource, inspectLilypondSource } from "./converter.mjs";
import {
  normalizeMidi2abc,
  prepareReferenceMidi,
  runMidi2abc,
} from "./midi-reference.mjs";

const usage = `Usage:
  node tools/ly2abc-convert/src/cli.mjs input.ly [options]

Options:
  -o, --output FILE   write ABC to FILE (stdout when omitted)
      --report FILE   write the JSON conversion report
      --reference-midi FILE
                      use this Standard MIDI file as musical authority
      --title TEXT    override the imported title
      --inspect       inspect only; print JSON and do not convert
      --strict        warnings produce exit code 2 and no ABC output
  -h, --help          show this help
`;

function parseArguments(argv) {
  const result = { strict: false, inspect: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "-h" || argument === "--help") result.help = true;
    else if (argument === "--strict") result.strict = true;
    else if (argument === "--inspect") result.inspect = true;
    else if (argument === "-o" || argument === "--output")
      result.output = argv[++index];
    else if (argument === "--report") result.report = argv[++index];
    else if (argument === "--reference-midi")
      result.referenceMidi = argv[++index];
    else if (argument === "--title") result.title = argv[++index];
    else if (argument?.startsWith("-"))
      throw new Error(`Unknown option: ${argument}`);
    else if (!result.input) result.input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  return result;
}

async function hasNumberedSiblingMovements(inputFile) {
  const rawStem = path.basename(inputFile, path.extname(inputFile));
  const paper = rawStem.match(/-(?:a4|let)$/iu)?.[0] ?? "";
  const stem = paper ? rawStem.slice(0, -paper.length) : rawStem;
  const match = stem.match(/^(.*?)(\d+)$/u);
  if (!match) return false;
  const entries = await readdir(path.dirname(path.resolve(inputFile)), {
    withFileTypes: true,
  });
  const pattern = new RegExp(
    `^${match[1].replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\d+${paper.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.ly$`,
    "iu",
  );
  return (
    entries.filter((entry) => entry.isFile() && pattern.test(entry.name))
      .length > 1
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.input) throw new Error(`Missing input file\n\n${usage}`);
  if (path.extname(options.input).toLowerCase() !== ".ly")
    throw new Error("Input must have the .ly extension");
  if (
    options.output &&
    path.resolve(options.output) === path.resolve(options.input)
  )
    throw new Error("Output must not overwrite the LilyPond input");

  const source = await readFile(options.input, "utf8");
  if (options.inspect) {
    process.stdout.write(
      `${JSON.stringify(inspectLilypondSource(source), null, 2)}\n`,
    );
    return;
  }
  const converted = convertLilypondSource(source, { title: options.title });
  const referenceMidi = await prepareReferenceMidi(
    options.input,
    options.referenceMidi,
  );
  if (referenceMidi) {
    try {
      if (
        converted.report.source.scoreCount !== 1 &&
        !(await hasNumberedSiblingMovements(options.input))
      )
        throw new Error(
          "MIDI-authoritative conversion currently requires exactly one LilyPond score block",
        );
      converted.abc = normalizeMidi2abc(
        runMidi2abc(referenceMidi.path),
        converted.abc,
      );
      converted.report.referenceMidi = {
        status: "authoritative",
        file: referenceMidi.label,
        converter: "midi2abc",
      };
      converted.report.safeToUse = true;
    } finally {
      await referenceMidi.cleanup();
    }
  } else {
    converted.report.referenceMidi = {
      status: "missing",
      file: null,
      converter: null,
    };
    converted.report.diagnostics.push({
      severity: "warning",
      code: "reference-midi-missing",
      message:
        "No uniquely matching sibling MIDI was found; musical equivalence is unverified",
      offset: 0,
    });
  }
  converted.report.complete = converted.report.diagnostics.length === 0;
  if (options.report)
    await writeFile(
      options.report,
      `${JSON.stringify(converted.report, null, 2)}\n`,
      "utf8",
    );
  if (converted.report.diagnostics.length > 0) {
    const displayedDiagnostics =
      referenceMidi && !options.strict ? [] : converted.report.diagnostics;
    for (const item of displayedDiagnostics)
      process.stderr.write(`${item.severity}: ${item.code}: ${item.message}\n`);
    if (options.strict || !converted.report.safeToUse) {
      process.exitCode = 2;
      return;
    }
  }
  if (referenceMidi)
    process.stderr.write(
      `info: reference-midi-authoritative: ${referenceMidi.label}\n`,
    );
  if (options.output)
    await writeFile(options.output, `${converted.abc}\n`, "utf8");
  else process.stdout.write(`${converted.abc}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `ly2abc-convert: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
