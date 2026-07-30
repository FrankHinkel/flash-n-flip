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

export type MarkdownClozeErrorCode =
  "EMPTY_ANSWER" | "INVALID_CHOICE" | "INVALID_POSITION" | "TOO_MANY_CLOZES";

export class MarkdownClozeSyntaxError extends Error {
  constructor(
    readonly code: MarkdownClozeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MarkdownClozeSyntaxError";
  }
}

const safeLinkPattern = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;
const clozeTokenPattern = /\{\{([^{}\n]+)\}\}/g;
const safeIdentifierPattern = /^[a-zA-Z0-9_-]{1,120}$/;

type MdastNode = {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  align?: Array<"left" | "right" | "center" | null>;
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
): MarkdownRichNode[] {
  return nodes.flatMap((node): MarkdownRichNode[] => {
    if (node.type === "paragraph") {
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
          content: blockMdastNodes(node.children ?? [], placeholders),
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
          content: blockMdastNodes(node.children ?? [], placeholders),
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
          content: blockMdastNodes(node.children ?? [], placeholders),
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
          attrs: { align: node.align ?? [] },
          content: (node.children ?? []).map((row, rowIndex) => ({
            type: "tableRow",
            content: (row.children ?? []).map((cell) => ({
              type: "tableCell",
              attrs: { header: rowIndex === 0 },
              content: inlineMdastNodes(cell.children ?? [], placeholders),
            })),
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
          content: blockMdastNodes(node.children ?? [], placeholders),
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
      return blockMdastNodes(node.children, placeholders);
    }
    return [];
  });
}

export function markdownToRichTextDocument(
  source: string,
): MarkdownRichDocument {
  const clozes = parseMarkdownClozes(source);
  const protectedMarkdown = protectMarkdownInlines(source, clozes);
  const tree = markdownProcessor.parse(protectedMarkdown.source) as MdastNode;
  const content = blockMdastNodes(
    tree.children ?? [],
    protectedMarkdown.placeholders,
  );
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

const escapeMarkdown = (value: string, tableCell = false): string =>
  value.replace(tableCell ? /([\\`*_[\]{}|])/g : /([\\`*_[\]{}])/g, "\\$1");

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
        else if (mark.type === "italic") result = `*${result}*`;
        else if (mark.type === "strike") result = `~~${result}~~`;
        else if (mark.type === "code") result = `\`${node.text ?? ""}\``;
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
      const rows = node.content ?? [];
      if (!rows.length) return "";
      const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
      const row = (value: MarkdownRichNode) =>
        `| ${(value.content ?? [])
          .map((cell) => richInlineToMarkdown(cell.content, true))
          .join(" | ")} |`;
      const columns = rows[0]?.content?.length ?? 0;
      const delimiter = `| ${Array.from({ length: columns }, (_, index) => {
        const value = align[index];
        if (value === "center") return ":---:";
        if (value === "right") return "---:";
        if (value === "left") return ":---";
        return "---";
      }).join(" | ")} |`;
      return [row(rows[0]!), delimiter, ...rows.slice(1).map(row)].join("\n");
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
