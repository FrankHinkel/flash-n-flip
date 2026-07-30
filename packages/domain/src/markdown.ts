import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type MarkdownMark =
  | { type: "bold" | "italic" | "strike" | "code" | "underline" }
  | {
      type: "link";
      attrs: {
        href: string;
        target?: "_blank" | "_self" | null;
        rel?: string | null;
        title?: string | null;
      };
    };

export type MarkdownRichNode = {
  type:
    | "paragraph"
    | "heading"
    | "blockquote"
    | "bulletList"
    | "codeBlock"
    | "horizontalRule"
    | "orderedList"
    | "listItem"
    | "table"
    | "tableRow"
    | "tableCell"
    | "mathInline"
    | "mathBlock"
    | "footnoteDefinition"
    | "footnoteReference"
    | "hardBreak"
    | "text"
    | "cloze";
  attrs?: Record<string, unknown>;
  content?: MarkdownRichNode[];
  marks?: MarkdownMark[];
  text?: string;
};

export type MarkdownRichDocument = {
  type: "doc";
  content: MarkdownRichNode[];
};

export type ParsedMarkdownCloze = {
  id: string;
  order: number;
  answer: string;
  choices: string[];
  mixCount: number;
  source: string;
};

type MarkdownTableAlign = "left" | "right" | "center" | null;

export type MarkdownClozeErrorCode =
  "EMPTY_ANSWER" | "INVALID_CHOICE" | "INVALID_POSITION" | "TOO_MANY_CLOZES";
export type MarkdownTableErrorCode = "INVALID_ROWSPAN" | "TOO_MANY_ROWS";

export class MarkdownClozeSyntaxError extends Error {
  constructor(
    readonly code: MarkdownClozeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MarkdownClozeSyntaxError";
  }
}

export class MarkdownTableSyntaxError extends Error {
  constructor(
    readonly code: MarkdownTableErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MarkdownTableSyntaxError";
  }
}

const safeLinkPattern = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;
const wikiUnderlineHref = "flashnflip:wiki-underline";
const clozeTokenPattern = /\{\{([^{}\n]+)\}\}/g;
const safeIdentifierPattern = /^[a-zA-Z0-9_-]{1,120}$/;

type MdastNode = {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  align?: MarkdownTableAlign[];
  url?: string;
  title?: string | null;
  alt?: string | null;
  lang?: string | null;
  identifier?: string;
  label?: string;
  children?: MdastNode[];
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath);

const normalizeChoice = (value: string): string => value.trim();

export function parseMarkdownClozes(source: string): ParsedMarkdownCloze[] {
  const raw: Array<{
    explicitOrder?: number;
    answer: string;
    choices: string[];
    mixCount: number;
    source: string;
  }> = [];
  mapEditableMarkdown(source, (segment) => {
    for (const match of segment.matchAll(clozeTokenPattern)) {
      const token = match[0];
      const parts = match[1]!.split("|").map(normalizeChoice);
      let explicitOrder: number | undefined;
      const explicit = /^(\d+):(.*)$/s.exec(parts[0] ?? "");
      if (explicit) {
        explicitOrder = Number(explicit[1]);
        parts[0] = normalizeChoice(explicit[2] ?? "");
      }
      const mix = /^\+(\d+)$/.exec(parts.at(-1) ?? "");
      const mixCount = mix ? Number(mix[1]) : 0;
      if (mix) parts.pop();
      const answer = parts[0] ?? "";
      if (!answer) {
        throw new MarkdownClozeSyntaxError(
          "EMPTY_ANSWER",
          "A cloze answer must not be empty",
        );
      }
      if (
        parts.some((choice) => !choice || choice.length > 500) ||
        mixCount > 12
      ) {
        throw new MarkdownClozeSyntaxError(
          "INVALID_CHOICE",
          "Invalid cloze choice or mix count",
        );
      }
      raw.push({
        explicitOrder,
        answer,
        choices: [...new Set(parts)],
        mixCount,
        source: token,
      });
    }
    return segment;
  });
  if (raw.length > 500) {
    throw new MarkdownClozeSyntaxError(
      "TOO_MANY_CLOZES",
      "A card supports at most 500 clozes",
    );
  }

  const explicitOrders = new Set<number>();
  raw.forEach(({ explicitOrder }) => {
    if (explicitOrder === undefined) return;
    if (
      !Number.isInteger(explicitOrder) ||
      explicitOrder < 1 ||
      explicitOrder > 500 ||
      explicitOrders.has(explicitOrder)
    ) {
      throw new MarkdownClozeSyntaxError(
        "INVALID_POSITION",
        "Explicit cloze positions must be unique from 1 to 500",
      );
    }
    explicitOrders.add(explicitOrder);
  });

  let implicitOrder = 1;
  const ordered = raw.map((item) => {
    while (explicitOrders.has(implicitOrder)) implicitOrder += 1;
    const order = item.explicitOrder ?? implicitOrder++;
    return { ...item, order };
  });
  const cardAnswers = ordered.map(({ answer }) => answer);

  return ordered.map((item, index) => {
    const mixed = cardAnswers.filter(
      (answer, answerIndex) =>
        answerIndex !== index &&
        answer !== item.answer &&
        !item.choices.includes(answer),
    );
    return {
      id: `cloze-${item.order}`,
      order: item.order,
      answer: item.answer,
      choices: [...item.choices, ...mixed.slice(0, item.mixCount)],
      mixCount: item.mixCount,
      source: item.source,
    };
  });
}

function mapEditableMarkdown(
  source: string,
  transform: (segment: string) => string,
  preserveInlineMath = true,
): string {
  let fenced = false;
  let displayMath = false;
  return source
    .split("\n")
    .map((line) => {
      if (!displayMath && /^\s*```/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      if (/^\s*\$\$\s*$/.test(line)) {
        displayMath = !displayMath;
        return line;
      }
      if (displayMath) return line;
      return line
        .split(/(`[^`\n]*`|\$\$[^$\n]+\$\$|\$(?:\\.|[^$\\\n])+\$)/g)
        .map((segment) =>
          segment.startsWith("`") ||
          (preserveInlineMath && segment.startsWith("$"))
            ? segment
            : transform(segment),
        )
        .join("");
    })
    .join("\n");
}

export function repairDuplicateMarkdownClozePositions(source: string): {
  source: string;
  changed: boolean;
} {
  const reserved = new Set<number>();
  mapEditableMarkdown(source, (segment) =>
    segment.replace(clozeTokenPattern, (token, body: string) => {
      const explicit = /^(\d+):(.*)$/s.exec(body.split("|")[0] ?? "");
      if (!explicit) return token;
      const position = Number(explicit[1]);
      if (position >= 1 && position <= 500 && !reserved.has(position)) {
        reserved.add(position);
      }
      return token;
    }),
  );

  const seen = new Set<number>();
  let nextAvailable = 1;
  const repaired = mapEditableMarkdown(source, (segment) =>
    segment.replace(clozeTokenPattern, (token, body: string) => {
      const parts = body.split("|");
      const explicit = /^(\d+):(.*)$/s.exec(parts[0] ?? "");
      if (!explicit) return token;
      const position = Number(explicit[1]);
      if (position >= 1 && position <= 500 && !seen.has(position)) {
        seen.add(position);
        return token;
      }
      while (reserved.has(nextAvailable) || seen.has(nextAvailable)) {
        nextAvailable += 1;
      }
      if (nextAvailable > 500) return token;
      seen.add(nextAvailable);
      parts[0] = `${nextAvailable}:${explicit[2] ?? ""}`;
      return `{{${parts.join("|")}}}`;
    }),
  );
  return { source: repaired, changed: repaired !== source };
}

const clozeNode = (cloze: ParsedMarkdownCloze): MarkdownRichNode => ({
  type: "cloze",
  attrs: {
    id: cloze.id,
    answer: cloze.answer,
    choices: cloze.choices,
    order: cloze.order,
    hint: null,
  },
});

type ProtectedMarkdownInline =
  | { type: "cloze"; cloze: ParsedMarkdownCloze }
  | { type: "mathInline"; latex: string };

type ProtectedMarkdownBlock = {
  type: "wikiTable";
  node: MarkdownRichNode;
};

function protectMarkdownInlines(
  source: string,
  clozes: readonly ParsedMarkdownCloze[],
): {
  source: string;
  placeholders: Map<string, ProtectedMarkdownInline>;
} {
  let prefix = "FLASHNFLIPINLINETOKEN";
  while (source.includes(prefix)) prefix += "X";
  let clozeIndex = 0;
  let placeholderIndex = 0;
  const placeholders = new Map<string, ProtectedMarkdownInline>();
  const placeholderFor = (value: ProtectedMarkdownInline) => {
    placeholderIndex += 1;
    const placeholder = `${prefix}${placeholderIndex}END`;
    placeholders.set(placeholder, value);
    return placeholder;
  };
  const protectedSource = mapEditableMarkdown(
    source,
    (segment) =>
      segment.startsWith("$")
        ? placeholderFor({
            type: "mathInline",
            latex: segment.replace(/^\${1,2}|\${1,2}$/g, ""),
          })
        : segment.replace(clozeTokenPattern, (token) => {
            const cloze = clozes[clozeIndex++];
            return cloze && cloze.source === token
              ? placeholderFor({ type: "cloze", cloze })
              : token;
          }),
    false,
  );
  return { source: protectedSource, placeholders };
}

const wikiTableRowPattern = /^[|^].*[|^]\s*$/;
const gfmDelimiterRowPattern = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/;

const markdownTableAlignment = (raw: string): MarkdownTableAlign => {
  const leading = /^\s/.test(raw);
  const trailing = /\s$/.test(raw);
  if (leading && trailing) return "center";
  if (leading) return "right";
  if (trailing) return "left";
  return null;
};

function markdownTableCellBoundaries(line: string): number[] {
  const boundaries: number[] = [];
  let inlineCode: "`" | "''" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "`" && inlineCode !== "''") {
      inlineCode = inlineCode === "`" ? null : "`";
      continue;
    }
    if (character === "'" && line[index + 1] === "'" && inlineCode !== "`") {
      inlineCode = inlineCode === "''" ? null : "''";
      index += 1;
      continue;
    }
    if (!inlineCode && (character === "|" || character === "^")) {
      boundaries.push(index);
    }
  }
  return boundaries;
}

const wikiCellMarkers = ["//", "__", "''"] as const;

const isEscapedAt = (source: string, index: number): boolean => {
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

function findWikiCellMarker(
  source: string,
  marker: (typeof wikiCellMarkers)[number],
  from: number,
  closing: boolean,
): number {
  let index = source.indexOf(marker, from);
  while (index >= 0) {
    const before = source[index - 1] ?? "";
    const after = source[index + marker.length] ?? "";
    const validSlashes = marker !== "//" || before !== ":";
    const validSpacing = closing
      ? before !== "" && !/\s/.test(before)
      : after !== "" && !/\s/.test(after);
    if (!isEscapedAt(source, index) && validSlashes && validSpacing)
      return index;
    index = source.indexOf(marker, index + marker.length);
  }
  return -1;
}

function wikiCellInlineToMarkdown(source: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const openings = wikiCellMarkers
      .map((marker) => ({
        marker,
        index: findWikiCellMarker(source, marker, cursor, false),
      }))
      .filter(({ index }) => index >= 0)
      .sort((left, right) => left.index - right.index);
    const opening = openings[0];
    if (!opening) {
      output += source.slice(cursor);
      break;
    }

    const end = findWikiCellMarker(
      source,
      opening.marker,
      opening.index + opening.marker.length,
      true,
    );
    if (end < 0) {
      output += source.slice(cursor, opening.index + opening.marker.length);
      cursor = opening.index + opening.marker.length;
      continue;
    }

    output += source.slice(cursor, opening.index);
    const inner = source.slice(opening.index + opening.marker.length, end);
    if (opening.marker === "//") {
      output += `*${wikiCellInlineToMarkdown(inner)}*`;
    } else if (opening.marker === "__") {
      output += `[${wikiCellInlineToMarkdown(inner)}](${wikiUnderlineHref})`;
    } else {
      output += `\`${inner.replaceAll("`", "\\`")}\``;
    }
    cursor = end + opening.marker.length;
  }

  return output;
}

function inlineWikiTableCell(
  source: string,
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
): MarkdownRichNode[] {
  if (!source) return [];
  const tree = markdownProcessor.parse(
    wikiCellInlineToMarkdown(source),
  ) as MdastNode;
  const children = tree.children ?? [];
  if (children.length === 1 && children[0]?.type === "paragraph") {
    return inlineMdastNodes(children[0].children ?? [], placeholders);
  }
  return inlineMdastNodes(children, placeholders);
}

function wikiTableRow(
  line: string,
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
): MarkdownRichNode | null {
  const boundaries = markdownTableCellBoundaries(line);
  if (
    boundaries.length < 2 ||
    boundaries[0] !== 0 ||
    line.slice(boundaries.at(-1)! + 1).trim()
  ) {
    return null;
  }

  const cells: MarkdownRichNode[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    const raw = line.slice(start + 1, end);
    if (!raw && cells.length) {
      const previous = cells.at(-1)!;
      previous.attrs = {
        ...previous.attrs,
        colspan: Math.min(50, Number(previous.attrs?.colspan ?? 1) + 1),
      };
      continue;
    }
    const source = raw.trim();
    cells.push({
      type: "tableCell",
      attrs: {
        header: line[start] === "^",
        align: markdownTableAlignment(raw),
        colspan: 1,
        rowspanContinuation: source === ":::",
      },
      content:
        source === ":::"
          ? undefined
          : inlineWikiTableCell(source, placeholders),
    });
  }
  return { type: "tableRow", content: cells };
}

function resolveWikiTableRowSpans(
  rows: MarkdownRichNode[],
): MarkdownRichNode[] {
  let previousColumns: Array<MarkdownRichNode | undefined> = [];

  rows.forEach((row) => {
    const currentColumns: Array<MarkdownRichNode | undefined> = [];
    const resolvedCells: MarkdownRichNode[] = [];
    let column = 0;

    for (const cell of row.content ?? []) {
      const colspan = Math.min(
        50,
        Math.max(1, Number(cell.attrs?.colspan ?? 1)),
      );
      if (cell.attrs?.rowspanContinuation === true) {
        const origin = previousColumns[column];
        const originColspan = Math.min(
          50,
          Math.max(1, Number(origin?.attrs?.colspan ?? 1)),
        );
        if (
          !origin ||
          originColspan !== colspan ||
          Array.from(
            { length: colspan },
            (_, offset) => previousColumns[column + offset],
          ).some((candidate) => candidate !== origin)
        ) {
          throw new MarkdownTableSyntaxError(
            "INVALID_ROWSPAN",
            "A ::: table cell must continue one cell directly above with the same column span",
          );
        }
        const nextRowspan = Number(origin.attrs?.rowspan ?? 1) + 1;
        if (nextRowspan > 500) {
          throw new MarkdownTableSyntaxError(
            "TOO_MANY_ROWS",
            "A table heading can span at most 500 rows",
          );
        }
        origin.attrs = {
          ...origin.attrs,
          rowspan: nextRowspan,
        };
        for (let offset = 0; offset < colspan; offset += 1) {
          currentColumns[column + offset] = origin;
        }
      } else {
        if (cell.attrs) {
          const { rowspanContinuation: _continuation, ...attrs } = cell.attrs;
          cell.attrs = attrs;
        }
        resolvedCells.push(cell);
        for (let offset = 0; offset < colspan; offset += 1) {
          currentColumns[column + offset] = cell;
        }
      }
      column += colspan;
    }

    row.content = resolvedCells;
    previousColumns = currentColumns;
  });

  return rows;
}

function protectWikiTables(
  source: string,
  inlinePlaceholders: ReadonlyMap<string, ProtectedMarkdownInline>,
): {
  source: string;
  placeholders: Map<string, ProtectedMarkdownBlock>;
} {
  let prefix = "FLASHNFLIPBLOCKTOKEN";
  while (source.includes(prefix)) prefix += "X";
  const placeholders = new Map<string, ProtectedMarkdownBlock>();
  const lines = source.split("\n");
  const output: string[] = [];
  let fenced = false;
  let displayMath = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!displayMath && /^\s*```/.test(line)) {
      fenced = !fenced;
      output.push(line);
      continue;
    }
    if (!fenced && /^\s*\$\$\s*$/.test(line)) {
      displayMath = !displayMath;
      output.push(line);
      continue;
    }
    if (fenced || displayMath || !wikiTableRowPattern.test(line)) {
      output.push(line);
      continue;
    }

    if (
      line.startsWith("|") &&
      gfmDelimiterRowPattern.test(lines[index + 1] ?? "")
    ) {
      output.push(line, lines[index + 1]!);
      index += 1;
      while (wikiTableRowPattern.test(lines[index + 1] ?? "")) {
        output.push(lines[index + 1]!);
        index += 1;
      }
      continue;
    }

    const rows: MarkdownRichNode[] = [];
    while (wikiTableRowPattern.test(lines[index] ?? "")) {
      const row = wikiTableRow(lines[index]!, inlinePlaceholders);
      if (!row) break;
      rows.push(row);
      index += 1;
    }
    index -= 1;
    if (!rows.length) {
      output.push(line);
      continue;
    }

    const columnCount = Math.max(
      ...rows.map((row) =>
        (row.content ?? []).reduce(
          (total, cell) => total + Number(cell.attrs?.colspan ?? 1),
          0,
        ),
      ),
    );
    if (columnCount > 50) {
      throw new Error("A Markdown table supports at most 50 columns");
    }
    rows.forEach((row) => {
      let columns = (row.content ?? []).reduce(
        (total, cell) => total + Number(cell.attrs?.colspan ?? 1),
        0,
      );
      while (columns < columnCount) {
        row.content ??= [];
        row.content.push({
          type: "tableCell",
          attrs: { header: false, align: null, colspan: 1 },
        });
        columns += 1;
      }
    });

    const placeholder = `${prefix}${placeholders.size + 1}END`;
    placeholders.set(placeholder, {
      type: "wikiTable",
      node: {
        type: "table",
        attrs: { align: [] },
        content: resolveWikiTableRowSpans(rows),
      },
    });
    output.push(placeholder);
  }

  return { source: output.join("\n"), placeholders };
}

function protectedGfmCells(line: string): string[] {
  const boundaries = markdownTableCellBoundaries(line);
  if (
    boundaries.length < 2 ||
    line.slice(0, boundaries[0]).trim() ||
    line.slice(boundaries.at(-1)! + 1).trim()
  ) {
    return [];
  }
  return boundaries
    .slice(0, -1)
    .map((start, index) => line.slice(start + 1, boundaries[index + 1]).trim());
}

const gfmColumnAlignment = (value: string): MarkdownTableAlign => {
  const delimiter = value.trim();
  if (delimiter.startsWith(":") && delimiter.endsWith(":")) return "center";
  if (delimiter.endsWith(":")) return "right";
  if (delimiter.startsWith(":")) return "left";
  return null;
};

function protectedInlineSource(
  source: string,
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
): string {
  let restored = source;
  for (const [placeholder, value] of placeholders) {
    restored = restored.replaceAll(
      placeholder,
      value.type === "cloze" ? value.cloze.source : `$${value.latex}$`,
    );
  }
  return restored;
}

export function migrateGfmTablesToWikiTables(source: string): {
  source: string;
  changed: boolean;
} {
  let clozes: ParsedMarkdownCloze[];
  try {
    clozes = parseMarkdownClozes(source);
  } catch {
    return { source, changed: false };
  }
  const protectedMarkdown = protectMarkdownInlines(source, clozes);
  const lines = protectedMarkdown.source.split("\n");
  const output: string[] = [];
  let changed = false;
  let fenced = false;
  let displayMath = false;

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]!;
    if (!displayMath && /^\s*```/.test(header)) {
      fenced = !fenced;
      output.push(header);
      continue;
    }
    if (!fenced && /^\s*\$\$\s*$/.test(header)) {
      displayMath = !displayMath;
      output.push(header);
      continue;
    }
    const delimiter = lines[index + 1] ?? "";
    if (
      fenced ||
      displayMath ||
      !header.startsWith("|") ||
      !wikiTableRowPattern.test(header) ||
      !gfmDelimiterRowPattern.test(delimiter)
    ) {
      output.push(header);
      continue;
    }
    const headerCells = protectedGfmCells(header);
    const delimiterCells = protectedGfmCells(delimiter);
    if (!headerCells.length || headerCells.length !== delimiterCells.length) {
      output.push(header);
      continue;
    }
    const align = delimiterCells.map(gfmColumnAlignment);
    const renderRow = (cells: readonly string[], marker: "^" | "|") => {
      let row = marker;
      cells.forEach((cell, cellIndex) => {
        const value = cell.trim();
        const cellAlign = align[cellIndex];
        row +=
          (cellAlign === "center"
            ? ` ${value} `
            : cellAlign === "right"
              ? ` ${value}`
              : cellAlign === "left"
                ? `${value} `
                : value || " ") + marker;
      });
      return row;
    };

    output.push(renderRow(headerCells, "^"));
    index += 1;
    while (
      lines[index + 1]?.startsWith("|") &&
      wikiTableRowPattern.test(lines[index + 1]!)
    ) {
      const cells = protectedGfmCells(lines[index + 1]!);
      if (cells.length !== headerCells.length) break;
      output.push(renderRow(cells, "|"));
      index += 1;
    }
    changed = true;
  }

  const migrated = protectedInlineSource(
    output.join("\n"),
    protectedMarkdown.placeholders,
  );
  return { source: changed ? migrated : source, changed };
}

function textWithProtectedInlines(
  value: string,
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
  marks: MarkdownMark[] = [],
): MarkdownRichNode[] {
  const matches = [...placeholders.keys()]
    .map((placeholder) => ({
      placeholder,
      index: value.indexOf(placeholder),
    }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index);
  if (!matches.length) {
    return value ? [{ type: "text", text: value, marks }] : [];
  }
  const nodes: MarkdownRichNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index > cursor) {
      nodes.push({
        type: "text",
        text: value.slice(cursor, match.index),
        marks,
      });
    }
    const protectedInline = placeholders.get(match.placeholder);
    if (protectedInline?.type === "cloze") {
      nodes.push(clozeNode(protectedInline.cloze));
    } else if (protectedInline?.type === "mathInline") {
      nodes.push({
        type: "mathInline",
        attrs: { latex: protectedInline.latex },
      });
    }
    cursor = match.index + match.placeholder.length;
  }
  if (cursor < value.length) {
    nodes.push({ type: "text", text: value.slice(cursor), marks });
  }
  return nodes;
}

function inlineMdastNodes(
  nodes: readonly MdastNode[],
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
  marks: MarkdownMark[] = [],
): MarkdownRichNode[] {
  return nodes.flatMap((node): MarkdownRichNode[] => {
    if (node.type === "text") {
      return textWithProtectedInlines(node.value ?? "", placeholders, marks);
    }
    if (node.type === "inlineCode") {
      return node.value
        ? [
            {
              type: "text",
              text: node.value,
              marks: [...marks, { type: "code" }],
            },
          ]
        : [];
    }
    if (node.type === "inlineMath") {
      return [
        {
          type: "mathInline",
          attrs: { latex: node.value ?? "" },
        },
      ];
    }
    if (node.type === "break") return [{ type: "hardBreak" }];
    if (node.type === "emphasis") {
      return inlineMdastNodes(node.children ?? [], placeholders, [
        ...marks,
        { type: "italic" },
      ]);
    }
    if (node.type === "strong") {
      return inlineMdastNodes(node.children ?? [], placeholders, [
        ...marks,
        { type: "bold" },
      ]);
    }
    if (node.type === "delete") {
      return inlineMdastNodes(node.children ?? [], placeholders, [
        ...marks,
        { type: "strike" },
      ]);
    }
    if (node.type === "link") {
      const href = node.url ?? "";
      if (href === wikiUnderlineHref) {
        return inlineMdastNodes(node.children ?? [], placeholders, [
          ...marks,
          { type: "underline" },
        ]);
      }
      if (!safeLinkPattern.test(href)) {
        return inlineMdastNodes(node.children ?? [], placeholders, marks);
      }
      return inlineMdastNodes(node.children ?? [], placeholders, [
        ...marks,
        {
          type: "link",
          attrs: {
            href,
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            title: node.title || null,
          },
        },
      ]);
    }
    if (node.type === "footnoteReference") {
      const identifier = node.identifier ?? node.label ?? "";
      return safeIdentifierPattern.test(identifier)
        ? [{ type: "footnoteReference", attrs: { identifier } }]
        : [];
    }
    if (node.type === "image" || node.type === "imageReference") {
      throw new Error("External Markdown images are not allowed");
    }
    if (node.type === "html") {
      throw new Error("Raw HTML is not allowed in Markdown cards");
    }
    return inlineMdastNodes(node.children ?? [], placeholders, marks);
  });
}

function blockMdastNodes(
  nodes: readonly MdastNode[],
  placeholders: ReadonlyMap<string, ProtectedMarkdownInline>,
  blockPlaceholders: ReadonlyMap<string, ProtectedMarkdownBlock> = new Map(),
): MarkdownRichNode[] {
  return nodes.flatMap((node): MarkdownRichNode[] => {
    if (node.type === "paragraph") {
      const blockPlaceholder =
        node.children?.length === 1 && node.children[0]?.type === "text"
          ? blockPlaceholders.get(node.children[0].value ?? "")
          : undefined;
      if (blockPlaceholder) return [blockPlaceholder.node];
      return [
        {
          type: "paragraph",
          content: inlineMdastNodes(node.children ?? [], placeholders),
        },
      ];
    }
    if (node.type === "heading") {
      return [
        {
          type: "heading",
          attrs: { level: Math.min(6, Math.max(1, node.depth ?? 2)) },
          content: inlineMdastNodes(node.children ?? [], placeholders),
        },
      ];
    }
    if (node.type === "blockquote") {
      return [
        {
          type: "blockquote",
          content: blockMdastNodes(
            node.children ?? [],
            placeholders,
            blockPlaceholders,
          ),
        },
      ];
    }
    if (node.type === "list") {
      return [
        {
          type: node.ordered ? "orderedList" : "bulletList",
          attrs: node.ordered
            ? { start: Math.max(1, node.start ?? 1), type: null }
            : undefined,
          content: blockMdastNodes(
            node.children ?? [],
            placeholders,
            blockPlaceholders,
          ),
        },
      ];
    }
    if (node.type === "listItem") {
      return [
        {
          type: "listItem",
          attrs:
            typeof node.checked === "boolean"
              ? { checked: node.checked }
              : undefined,
          content: blockMdastNodes(
            node.children ?? [],
            placeholders,
            blockPlaceholders,
          ),
        },
      ];
    }
    if (node.type === "code") {
      const language =
        node.lang && /^[a-zA-Z0-9_+-]{1,40}$/.test(node.lang)
          ? node.lang
          : null;
      return [
        {
          type: "codeBlock",
          attrs: { language },
          content: node.value
            ? [{ type: "text", text: node.value }]
            : undefined,
        },
      ];
    }
    if (node.type === "thematicBreak") return [{ type: "horizontalRule" }];
    if (node.type === "math") {
      return [{ type: "mathBlock", attrs: { latex: node.value ?? "" } }];
    }
    if (node.type === "table") {
      return [
        {
          type: "table",
          attrs: { align: [] },
          content: (node.children ?? []).map((row, rowIndex) => ({
            type: "tableRow",
            content: (row.children ?? []).map(
              (cell, cellIndex): MarkdownRichNode => ({
                type: "tableCell",
                attrs: {
                  header: rowIndex === 0,
                  align: node.align?.[cellIndex] ?? null,
                  colspan: 1,
                },
                content: inlineMdastNodes(cell.children ?? [], placeholders),
              }),
            ),
          })),
        },
      ];
    }
    if (node.type === "footnoteDefinition") {
      const identifier = node.identifier ?? node.label ?? "";
      if (!safeIdentifierPattern.test(identifier)) return [];
      return [
        {
          type: "footnoteDefinition",
          attrs: { identifier },
          content: blockMdastNodes(
            node.children ?? [],
            placeholders,
            blockPlaceholders,
          ),
        },
      ];
    }
    if (node.type === "html") {
      throw new Error("Raw HTML is not allowed in Markdown cards");
    }
    if (node.type === "image" || node.type === "imageReference") {
      throw new Error("External Markdown images are not allowed");
    }
    if (
      node.type === "definition" ||
      node.type === "footnoteReference" ||
      node.type === "yaml"
    ) {
      return [];
    }
    if (node.children?.length) {
      return blockMdastNodes(node.children, placeholders, blockPlaceholders);
    }
    return [];
  });
}

export function markdownToRichTextDocument(
  source: string,
): MarkdownRichDocument {
  const clozes = parseMarkdownClozes(source);
  const protectedMarkdown = protectMarkdownInlines(source, clozes);
  const protectedTables = protectWikiTables(
    protectedMarkdown.source,
    protectedMarkdown.placeholders,
  );
  const tree = markdownProcessor.parse(protectedTables.source) as MdastNode;
  const content = blockMdastNodes(
    tree.children ?? [],
    protectedMarkdown.placeholders,
    protectedTables.placeholders,
  );
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

const escapeMarkdown = (value: string, tableCell = false): string =>
  value.replace(tableCell ? /([\\`*_[\]{}|^])/g : /([\\`*_[\]{}])/g, "\\$1");

function richInlineToMarkdown(
  nodes: MarkdownRichNode[] = [],
  tableCell = false,
): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "cloze") {
        const attrs = node.attrs ?? {};
        const answer = String(attrs.answer ?? "");
        const choices = Array.isArray(attrs.choices)
          ? attrs.choices.map(String)
          : [answer];
        const order = Number(attrs.order ?? 0);
        return `{{${order > 0 ? `${order}:` : ""}${[
          answer,
          ...choices.filter((choice) => choice !== answer),
        ].join("|")}}}`;
      }
      if (node.type === "mathInline") {
        return `$${String(node.attrs?.latex ?? "")}$`;
      }
      if (node.type === "footnoteReference") {
        return `[^${String(node.attrs?.identifier ?? "")}]`;
      }
      if (node.type !== "text")
        return richInlineToMarkdown(node.content, tableCell);
      let result = escapeMarkdown(node.text ?? "", tableCell);
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") result = `**${result}**`;
        else if (mark.type === "italic")
          result = tableCell ? `//${result}//` : `*${result}*`;
        else if (mark.type === "strike") result = `~~${result}~~`;
        else if (mark.type === "code")
          result = tableCell
            ? `''${(node.text ?? "").replaceAll("''", "\\'\\'")}''`
            : `\`${node.text ?? ""}\``;
        else if (mark.type === "underline")
          result = tableCell ? `__${result}__` : result;
        else if (mark.type === "link") {
          const title = mark.attrs.title
            ? ` "${mark.attrs.title.replaceAll('"', '\\"')}"`
            : "";
          result = `[${result}](${mark.attrs.href}${title})`;
        }
      }
      return result;
    })
    .join("");
}

function richTableToWikiMarkdown(node: MarkdownRichNode): string {
  const rows = node.content ?? [];
  const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
  let activeRowSpans: Array<{
    column: number;
    colspan: number;
    remaining: number;
  }> = [];

  return rows
    .map((row) => {
      const items: Array<{
        column: number;
        colspan: number;
        cell?: MarkdownRichNode;
      }> = activeRowSpans.map(({ column, colspan }) => ({
        column,
        colspan,
      }));
      const occupied = (column: number, colspan: number) =>
        activeRowSpans.some(
          (span) =>
            column < span.column + span.colspan &&
            column + colspan > span.column,
        );
      const nextRowSpans: typeof activeRowSpans = [];
      let column = 0;

      for (const cell of row.content ?? []) {
        const colspan = Math.min(
          50,
          Math.max(1, Number(cell.attrs?.colspan ?? 1)),
        );
        while (occupied(column, colspan)) column += 1;
        items.push({ column, colspan, cell });
        const rowspan = Math.min(
          500,
          Math.max(1, Number(cell.attrs?.rowspan ?? 1)),
        );
        if (rowspan > 1) {
          nextRowSpans.push({
            column,
            colspan,
            remaining: rowspan - 1,
          });
        }
        column += colspan;
      }

      items.sort((left, right) => left.column - right.column);
      let value = "";
      for (const item of items) {
        const marker = item.cell?.attrs?.header ? "^" : "|";
        if (!item.cell) {
          value += `${marker} ::: ${marker.repeat(item.colspan - 1)}`;
          continue;
        }
        const content = richInlineToMarkdown(item.cell.content, true);
        const cellAlign = (item.cell.attrs?.align ??
          align[item.column] ??
          null) as MarkdownTableAlign;
        const aligned =
          cellAlign === "center"
            ? ` ${content} `
            : cellAlign === "right"
              ? ` ${content}`
              : cellAlign === "left"
                ? `${content} `
                : content || " ";
        value += `${marker}${aligned}${marker.repeat(item.colspan - 1)}`;
      }
      value += items.at(-1)?.cell?.attrs?.header ? "^" : "|";

      activeRowSpans = [
        ...activeRowSpans
          .map((span) => ({ ...span, remaining: span.remaining - 1 }))
          .filter((span) => span.remaining > 0),
        ...nextRowSpans,
      ];
      return value;
    })
    .join("\n");
}

export function richTextDocumentToMarkdown(
  document: MarkdownRichDocument,
): string {
  const render = (node: MarkdownRichNode): string => {
    const inline = richInlineToMarkdown(node.content);
    if (node.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `${"#".repeat(level)} ${inline}`;
    }
    if (node.type === "paragraph") return inline;
    if (node.type === "blockquote") {
      return render(node.content?.[0] ?? { type: "paragraph" })
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      return (node.content ?? [])
        .map(
          (item, index) =>
            `${node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}.` : "-"} ${
              typeof item.attrs?.checked === "boolean"
                ? `[${item.attrs.checked ? "x" : " "}] `
                : ""
            }${richInlineToMarkdown(item.content?.[0]?.content)}`,
        )
        .join("\n");
    }
    if (node.type === "codeBlock") {
      return `\`\`\`${String(node.attrs?.language ?? "")}\n${(node.content ?? []).map((child) => child.text ?? "").join("")}\n\`\`\``;
    }
    if (node.type === "horizontalRule") return "---";
    if (node.type === "mathBlock") {
      return `$$\n${String(node.attrs?.latex ?? "")}\n$$`;
    }
    if (node.type === "table") {
      return richTableToWikiMarkdown(node);
    }
    if (node.type === "footnoteDefinition") {
      const identifier = String(node.attrs?.identifier ?? "");
      const value = (node.content ?? []).map(render).join("\n");
      return `[^${identifier}]: ${value.replaceAll("\n", "\n    ")}`;
    }
    return inline;
  };
  return document.content.map(render).join("\n\n").trim();
}
