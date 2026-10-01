import ts from "typescript";

const allowedTechnicalJsxText = new Set(["A", "B", "Q + EN", "A + EN"]);
const allowedTechnicalAttribute =
  /^(?:name@example\.com|X{4}(?:-X{4}){2}|[A-Z]{2})$/;
// Pianoforte is a separate static, English-first product site with bilingual
// support/privacy pages. Its route does not use the Flash-n-Flip locale catalog.
export const usesFlashcardsCatalog = (file) =>
  !file.startsWith("apps/web/app/pianoforte/");

export function inspectUiSource(file, source) {
  const failures = [];
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
        (node.arguments.length === 1 && first && !ts.isSpreadElement(first)) ||
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
    if (ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, " ").trim();
      if (
        value &&
        /\p{L}/u.test(value) &&
        !allowedTechnicalJsxText.has(value)
      ) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        failures.push(
          `${file}:${line + 1}:${character + 1} contains hard-coded visible text: ${value}`,
        );
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      ["alt", "aria-label", "placeholder", "title"].includes(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      /\p{L}/u.test(node.initializer.text) &&
      !allowedTechnicalAttribute.test(node.initializer.text)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      failures.push(
        `${file}:${line + 1}:${character + 1} contains a hard-coded ${node.name.text}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return failures;
}

export function inspectStaticProductLanguages(file, source) {
  if (
    file === "apps/web/app/pianoforte/layout.tsx" &&
    !/<div\b[^>]*\blang="en"/.test(source)
  )
    return [`${file} must declare the static site's default language`];
  if (
    [
      "apps/web/app/pianoforte/support/page.tsx",
      "apps/web/app/pianoforte/privacy/page.tsx",
    ].includes(file)
  ) {
    return ["en", "de"]
      .filter(
        (locale) =>
          !new RegExp(`<section\\b[^>]*\\blang="${locale}"`).test(source),
      )
      .map((locale) => `${file} is missing its ${locale} language section`);
  }
  return [];
}
