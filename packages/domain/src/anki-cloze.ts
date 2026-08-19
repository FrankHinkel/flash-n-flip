export type AnkiClozeDeletion = {
  id: number;
  start: number;
  end: number;
  hint?: string;
};

export type AnkiMathRange = {
  start: number;
  end: number;
  display: boolean;
  latex: string;
};

export type ParsedAnkiMath = {
  text: string;
  mathRanges: AnkiMathRange[];
  warnings: string[];
};

export type ParsedAnkiCloze = {
  text: string;
  deletions: AnkiClozeDeletion[];
  emptyDeletionIds?: number[];
  mathRanges: AnkiMathRange[];
  warnings: string[];
};

export type AnkiClozePart = {
  kind: "text" | "blank" | "answer";
  text: string;
};

const clozeStart = /^\{\{c(\d+)::/i;

const unsafeLatexPattern =
  /\\(?:href|url|includegraphics|input|include|write|openout|read|catcode|csname|def|edef|gdef|xdef|newcommand|renewcommand|providecommand|usepackage|documentclass|special|htmlClass|htmlId|htmlStyle|htmlData)\b|\\begin\s*\{(?:document|filecontents|html)\}|(?:https?:|file:|data:)/i;

const latexIsSafe = (latex: string): boolean => {
  if (!latex.trim() || latex.length > 2_000 || unsafeLatexPattern.test(latex)) {
    return false;
  }
  let depth = 0;
  for (let index = 0; index < latex.length; index += 1) {
    if (latex[index] === "\\") {
      index += 1;
      continue;
    }
    if (latex[index] === "{") depth += 1;
    if (latex[index] === "}") depth -= 1;
    if (depth < 0 || depth > 32) return false;
  }
  return depth === 0;
};

type MathDelimiter = {
  open: string;
  close: string;
  display: boolean;
  caseInsensitive?: boolean;
};

const mathDelimiters: readonly MathDelimiter[] = [
  { open: "[$$]", close: "[/$$]", display: true, caseInsensitive: true },
  { open: "[latex]", close: "[/latex]", display: true, caseInsensitive: true },
  { open: "[$]", close: "[/$]", display: false, caseInsensitive: true },
  { open: "\\[", close: "\\]", display: true },
  { open: "\\(", close: "\\)", display: false },
  { open: "$$", close: "$$", display: true },
  { open: "$", close: "$", display: false },
];

const isEscaped = (source: string, index: number): boolean => {
  let slashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor -= 1
  ) {
    slashes += 1;
  }
  return slashes % 2 === 1;
};

const delimiterAt = (source: string, index: number): MathDelimiter | null => {
  for (const delimiter of mathDelimiters) {
    if (
      (delimiter.open === "$" || delimiter.open === "$$") &&
      isEscaped(source, index)
    ) {
      continue;
    }
    const candidate = source.slice(index, index + delimiter.open.length);
    if (
      delimiter.caseInsensitive
        ? candidate.toLocaleLowerCase() === delimiter.open.toLocaleLowerCase()
        : candidate === delimiter.open
    ) {
      return delimiter;
    }
  }
  return null;
};

const closingDelimiterIndex = (
  source: string,
  delimiter: MathDelimiter,
  from: number,
): number => {
  const haystack = delimiter.caseInsensitive
    ? source.toLocaleLowerCase()
    : source;
  const needle = delimiter.caseInsensitive
    ? delimiter.close.toLocaleLowerCase()
    : delimiter.close;
  let index = haystack.indexOf(needle, from);
  while (
    index >= 0 &&
    (delimiter.close === "$" || delimiter.close === "$$") &&
    isEscaped(source, index)
  ) {
    index = haystack.indexOf(needle, index + needle.length);
  }
  if (
    !delimiter.display &&
    index >= 0 &&
    /[\r\n]/.test(source.slice(from, index))
  ) {
    return -1;
  }
  return index;
};

const parseAnkiMathWithBoundaries = (
  source: string,
): ParsedAnkiMath & { boundaries: number[] } => {
  const boundaries = new Array<number>(source.length + 1).fill(0);
  const mathRanges: AnkiMathRange[] = [];
  const warnings: string[] = [];
  let text = "";
  let cursor = 0;

  const appendLiteral = (start: number, end: number): void => {
    for (let index = start; index < end; index += 1) {
      boundaries[index] = text.length;
      text += source[index]!;
    }
    boundaries[end] = text.length;
  };

  while (cursor < source.length) {
    boundaries[cursor] = text.length;
    const delimiter = delimiterAt(source, cursor);
    if (delimiter && mathRanges.length >= 100) {
      warnings.push(
        "Weitere Anki-Formeln wurden wegen des sicheren Limits als Text beibehalten.",
      );
      appendLiteral(cursor, cursor + 1);
      cursor += 1;
      continue;
    }
    if (!delimiter) {
      appendLiteral(cursor, cursor + 1);
      cursor += 1;
      continue;
    }
    const contentStart = cursor + delimiter.open.length;
    const closeAt = closingDelimiterIndex(source, delimiter, contentStart);
    if (closeAt < 0) {
      warnings.push("Unvollständige Anki-Formel wurde als Text beibehalten.");
      appendLiteral(cursor, source.length);
      cursor = source.length;
      break;
    }
    for (let index = cursor; index <= contentStart; index += 1) {
      boundaries[index] = text.length;
    }
    const latex = source.slice(contentStart, closeAt).trim();
    const leadingWhitespace = source
      .slice(contentStart, closeAt)
      .search(/\S|$/);
    const normalizedStart = text.length;
    appendLiteral(contentStart + leadingWhitespace, closeAt);
    const normalizedEnd = text.length;
    if (latexIsSafe(latex)) {
      mathRanges.push({
        start: normalizedStart,
        end: normalizedEnd,
        display: delimiter.display,
        latex,
      });
    } else {
      warnings.push(
        "Nicht unterstützte oder unsichere Anki-Formel wurde als Text beibehalten.",
      );
    }
    const tokenEnd = closeAt + delimiter.close.length;
    for (let index = closeAt; index <= tokenEnd; index += 1) {
      boundaries[index] = text.length;
    }
    cursor = tokenEnd;
  }
  boundaries[source.length] = text.length;
  return { text, mathRanges, warnings: [...new Set(warnings)], boundaries };
};

export const parseAnkiMath = (source: string): ParsedAnkiMath => {
  const { boundaries: _boundaries, ...parsed } =
    parseAnkiMathWithBoundaries(source);
  return parsed;
};

export const ankiMathToMarkdown = (source: string): ParsedAnkiMath => {
  const parsed = parseAnkiMath(source);
  if (!parsed.mathRanges.length) return parsed;
  let markdown = "";
  let cursor = 0;
  const mathRanges: AnkiMathRange[] = [];
  for (const range of parsed.mathRanges) {
    markdown += parsed.text.slice(cursor, range.start);
    const delimiter = range.display ? "$$" : "$";
    markdown += delimiter;
    const start = markdown.length;
    markdown += range.latex;
    mathRanges.push({ ...range, start, end: markdown.length });
    markdown += delimiter;
    cursor = range.end;
  }
  markdown += parsed.text.slice(cursor);
  return { ...parsed, text: markdown, mathRanges };
};

export const normalizeAnkiClozeMath = <
  T extends {
    text: string;
    deletions: AnkiClozeDeletion[];
  },
>(
  parsed: T,
): T & ParsedAnkiMath => {
  const normalized = parseAnkiMathWithBoundaries(parsed.text);
  return {
    ...parsed,
    text: normalized.text,
    deletions: parsed.deletions.map((deletion) => ({
      ...deletion,
      start: normalized.boundaries[deletion.start] ?? deletion.start,
      end: normalized.boundaries[deletion.end] ?? deletion.end,
    })),
    mathRanges: normalized.mathRanges,
    warnings: normalized.warnings,
  };
};

export function parseAnkiCloze(source: string): ParsedAnkiCloze | null {
  let cursor = 0;
  let text = "";
  let failed = false;
  const deletions: AnkiClozeDeletion[] = [];
  const emptyDeletionIds = new Set<number>();

  const parseDeletion = (depth: number): boolean => {
    if (depth > 8 || deletions.length >= 500) return false;
    const opening = clozeStart.exec(source.slice(cursor));
    if (!opening) return false;
    const id = Number(opening[1]);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 500) return false;
    cursor += opening[0].length;
    const start = text.length;
    let braceDepth = 0;
    let hint: string | undefined;

    while (cursor < source.length) {
      if (braceDepth === 0 && clozeStart.test(source.slice(cursor))) {
        if (!parseDeletion(depth + 1)) return false;
        continue;
      }
      if (braceDepth === 0 && source.startsWith("::", cursor)) {
        cursor += 2;
        const hintStart = cursor;
        let hintBraceDepth = 0;
        while (cursor < source.length) {
          if (source[cursor] === "{") {
            hintBraceDepth += 1;
            cursor += 1;
            continue;
          }
          if (source[cursor] === "}" && hintBraceDepth > 0) {
            hintBraceDepth -= 1;
            cursor += 1;
            continue;
          }
          if (hintBraceDepth === 0 && source.startsWith("}}", cursor)) {
            hint = source.slice(hintStart, cursor).trim().slice(0, 300);
            cursor += 2;
            if (text.length === start) {
              emptyDeletionIds.add(id);
              return true;
            }
            deletions.push({
              id,
              start,
              end: text.length,
              ...(hint ? { hint } : {}),
            });
            return text.length > start;
          }
          cursor += 1;
        }
        return false;
      }
      if (braceDepth === 0 && source.startsWith("}}", cursor)) {
        cursor += 2;
        if (text.length === start) {
          emptyDeletionIds.add(id);
          return true;
        }
        deletions.push({ id, start, end: text.length });
        return true;
      }
      const character = source[cursor]!;
      if (character === "{") braceDepth += 1;
      else if (character === "}" && braceDepth > 0) braceDepth -= 1;
      text += character;
      cursor += 1;
    }
    return false;
  };

  while (cursor < source.length) {
    if (clozeStart.test(source.slice(cursor))) {
      if (!parseDeletion(1)) {
        failed = true;
        break;
      }
      continue;
    }
    text += source[cursor]!;
    cursor += 1;
  }

  if (failed || !deletions.length) return null;
  return normalizeAnkiClozeMath({
    text,
    deletions,
    ...(emptyDeletionIds.size
      ? { emptyDeletionIds: [...emptyDeletionIds].sort((a, b) => a - b) }
      : {}),
  });
}

const activeRanges = (
  parsed: Pick<ParsedAnkiCloze, "text" | "deletions">,
  activeId: number,
): AnkiClozeDeletion[] => {
  const candidates = parsed.deletions
    .filter(
      (deletion) =>
        deletion.id === activeId &&
        deletion.start >= 0 &&
        deletion.end > deletion.start &&
        deletion.end <= parsed.text.length,
    )
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const visible: AnkiClozeDeletion[] = [];
  for (const candidate of candidates) {
    const previous = visible.at(-1);
    if (previous && candidate.start < previous.end) {
      if (candidate.end > previous.end) previous.end = candidate.end;
      continue;
    }
    visible.push({ ...candidate });
  }
  return visible;
};

export function ankiClozeParts(
  parsed: Pick<ParsedAnkiCloze, "text" | "deletions">,
  activeId: number,
  answer: boolean,
): AnkiClozePart[] {
  const ranges = activeRanges(parsed, activeId);
  if (!ranges.length) return [{ kind: "text", text: parsed.text }];
  const parts: AnkiClozePart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({
        kind: "text",
        text: parsed.text.slice(cursor, range.start),
      });
    }
    parts.push(
      answer
        ? { kind: "answer", text: parsed.text.slice(range.start, range.end) }
        : { kind: "blank", text: range.hint || "…" },
    );
    cursor = range.end;
  }
  if (cursor < parsed.text.length) {
    parts.push({ kind: "text", text: parsed.text.slice(cursor) });
  }
  return parts;
}

export function ankiClozePlainText(
  parsed: Pick<ParsedAnkiCloze, "text" | "deletions">,
  activeId: number,
  answer: boolean,
): string {
  return ankiClozeParts(parsed, activeId, answer)
    .map((part) => (part.kind === "blank" ? `[${part.text}]` : part.text))
    .join("");
}
