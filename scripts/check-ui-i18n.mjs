import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import ts from "typescript";
import {
  inspectUiSource,
  inspectStaticProductLanguages,
  usesFlashcardsCatalog,
} from "./ui-i18n-policy.mjs";

const root = new URL("../", import.meta.url).pathname;
const files = execFileSync(
  "rg",
  [
    "--files",
    "apps/web",
    "--glob",
    "*.ts",
    "--glob",
    "*.tsx",
    "--glob",
    "!*.test.ts",
    "--glob",
    "!*.test.tsx",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const failures = [];
const localeNames = ["en", "de", "es", "fr"];

const propertyName = (property) =>
  ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
    ? property.name.text
    : null;

const unwrapObject = (expression) => {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isObjectLiteralExpression(current) ? current : null;
};

const inspectCatalog = (relativePath, variableName) => {
  const source = readFileSync(`${root}${relativePath}`, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let catalog = null;
  const findCatalog = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      catalog = unwrapObject(node.initializer);
    }
    ts.forEachChild(node, findCatalog);
  };
  findCatalog(sourceFile);
  if (!catalog) {
    failures.push(`${relativePath} does not declare ${variableName}`);
    return;
  }
  for (const entry of catalog.properties) {
    if (!ts.isPropertyAssignment(entry)) continue;
    const key = propertyName(entry);
    const translations = unwrapObject(entry.initializer);
    if (!key || !translations) {
      failures.push(`${relativePath} contains a malformed message entry`);
      continue;
    }
    const values = new Map();
    for (const translation of translations.properties) {
      if (!ts.isPropertyAssignment(translation)) continue;
      const locale = propertyName(translation);
      if (!locale || !ts.isStringLiteralLike(translation.initializer)) continue;
      values.set(locale, translation.initializer.text);
    }
    for (const locale of localeNames) {
      if (!values.get(locale)?.trim()) {
        failures.push(`${relativePath} message ${key} is missing ${locale}`);
      }
    }
    const placeholders = (value) =>
      [...value.matchAll(/\{(\d+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(",");
    const expected = placeholders(values.get("en") ?? "");
    for (const locale of localeNames.slice(1)) {
      if (values.has(locale) && placeholders(values.get(locale)) !== expected) {
        failures.push(
          `${relativePath} message ${key} has incompatible ${locale} placeholders`,
        );
      }
    }
  }
};

inspectCatalog("packages/i18n/src/index.ts", "semanticUiMessages");
inspectCatalog(
  "packages/i18n/src/ui-messages.generated.ts",
  "generatedUiMessages",
);

for (const file of files) {
  const source = readFileSync(`${root}${file}`, "utf8");
  failures.push(
    ...(usesFlashcardsCatalog(file)
      ? inspectUiSource(file, source)
      : inspectStaticProductLanguages(file, source)),
  );
}

const helpPath = `${root}apps/web/components/help-content.ts`;
const helpSource = readFileSync(helpPath, "utf8");
const helpFile = ts.createSourceFile(
  helpPath,
  helpSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const inspectHelp = (node) => {
  if (ts.isObjectLiteralExpression(node)) {
    const names = new Set(
      node.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        if (
          ts.isIdentifier(property.name) ||
          ts.isStringLiteral(property.name)
        ) {
          return [property.name.text];
        }
        return [];
      }),
    );
    if (names.has("en") || names.has("de")) {
      for (const locale of ["en", "de", "es", "fr"]) {
        if (!names.has(locale)) {
          const { line, character } = helpFile.getLineAndCharacterOfPosition(
            node.getStart(helpFile),
          );
          failures.push(
            `apps/web/components/help-content.ts:${line + 1}:${character + 1} is missing ${locale}`,
          );
        }
      }
    }
  }
  ts.forEachChild(node, inspectHelp);
};
inspectHelp(helpFile);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Flash-n-Flip UI uses EN/DE/ES/FR; the separate Pianoforte site declares EN/DE sections.",
  );
}
