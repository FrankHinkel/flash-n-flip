#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { convertMusicXmlFile } from "./converter.mjs";

const usage = `Usage:
  node tools/mxml2abc-convert/src/cli.mjs INPUT [options]

Options:
  -o, --output FILE  write FnF-compatible ABC to FILE (stdout when omitted)
      --report FILE  write the JSON conversion report
      --strict       warnings produce exit code 2 and no ABC output
  -h, --help         show this help
`;

const parseArguments = (argv) => {
  const result = { strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "-h" || argument === "--help") result.help = true;
    else if (argument === "--strict") result.strict = true;
    else if (argument === "-o" || argument === "--output")
      result.output = argv[++index];
    else if (argument === "--report") result.report = argv[++index];
    else if (argument?.startsWith("-"))
      throw new Error(`Unknown option: ${argument}`);
    else if (!result.input) result.input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  return result;
};

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.input) throw new Error(`Missing input file\n\n${usage}`);
  if (
    options.output &&
    path.resolve(options.output) === path.resolve(options.input)
  )
    throw new Error("Output must not overwrite the MusicXML input");
  const converted = await convertMusicXmlFile(options.input);
  if (options.report)
    await writeFile(
      options.report,
      `${JSON.stringify(converted.report, null, 2)}\n`,
      "utf8",
    );
  const warnings = converted.report.diagnostics.filter(
    (item) => item.severity === "warning" || item.severity === "error",
  );
  for (const item of warnings)
    process.stderr.write(`${item.severity}: ${item.code}: ${item.message}\n`);
  if (options.strict && warnings.length) {
    process.exitCode = 2;
    return;
  }
  if (options.output)
    await writeFile(options.output, `${converted.abc}\n`, "utf8");
  else process.stdout.write(`${converted.abc}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `mxml2abc-convert: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
