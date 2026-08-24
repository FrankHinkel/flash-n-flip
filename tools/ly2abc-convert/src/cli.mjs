#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { convertLilypondSource, inspectLilypondSource } from "./converter.mjs";

const usage = `Usage:
  node tools/ly2abc-convert/src/cli.mjs input.ly [options]

Options:
  -o, --output FILE   write ABC to FILE (stdout when omitted)
      --report FILE   write the JSON conversion report
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
    else if (argument === "--title") result.title = argv[++index];
    else if (argument?.startsWith("-"))
      throw new Error(`Unknown option: ${argument}`);
    else if (!result.input) result.input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  return result;
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
  if (options.report)
    await writeFile(
      options.report,
      `${JSON.stringify(converted.report, null, 2)}\n`,
      "utf8",
    );
  if (converted.report.diagnostics.length > 0) {
    for (const item of converted.report.diagnostics)
      process.stderr.write(`${item.severity}: ${item.code}: ${item.message}\n`);
    if (options.strict) {
      process.exitCode = 2;
      return;
    }
  }
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
