import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import ts from "typescript";

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
for (const file of files) {
  const source = readFileSync(`${root}${file}`, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "text"
    ) {
      const [first, second] = node.arguments;
      const legalDocumentTuple =
        file === "apps/web/components/legal-document.tsx" &&
        first &&
        ts.isSpreadElement(first);
      const catalogCall =
        node.arguments.length === 1 ||
        (node.arguments.length === 2 &&
          second &&
          ts.isArrayLiteralExpression(second));
      if (!catalogCall && !legalDocumentTuple) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        failures.push(
          `${file}:${line + 1}:${character + 1} uses a component-local translation instead of a catalog key`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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
  console.log("UI translations use the complete EN/DE/ES/FR catalog.");
}
