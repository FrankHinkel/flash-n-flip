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

const normalizeChoice = (value: string): string => value.trim();

export function parseMarkdownClozes(source: string): ParsedMarkdownCloze[] {
  const raw: Array<{
    explicitOrder?: number;
    answer: string;
    choices: string[];
    mixCount: number;
    source: string;
  }> = [];
  let fenced = false;

  for (const line of source.split("\n")) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const withoutInlineCode = line.replace(/`[^`\n]*`/g, "");
    for (const match of withoutInlineCode.matchAll(clozeTokenPattern)) {
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
  }
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

const mapEditableMarkdown = (
  source: string,
  transform: (segment: string) => string,
): string => {
  let fenced = false;
  return source
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .split(/(`[^`\n]*`)/g)
        .map((segment) =>
          segment.startsWith("`") ? segment : transform(segment),
        )
        .join("");
    })
    .join("\n");
};

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

function inlineNodes(
  text: string,
  clozeQueues: Map<string, ParsedMarkdownCloze[]>,
): MarkdownRichNode[] {
  const nodes: MarkdownRichNode[] = [];

  const tokenPattern =
    /(\{\{[^{}\n]+\}\}|`[^`\n]+`|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  let cursor = 0;
  const pushText = (value: string, marks?: MarkdownMark[]) => {
    if (value) nodes.push({ type: "text", text: value, marks });
  };

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    pushText(text.slice(cursor, index));
    const token = match[0];
    if (token.startsWith("{{")) {
      const cloze = clozeQueues.get(token)?.shift();
      if (cloze) {
        nodes.push({
          type: "cloze",
          attrs: {
            id: cloze.id,
            answer: cloze.answer,
            choices: cloze.choices,
            order: cloze.order,
            hint: null,
          },
        });
      } else {
        pushText(token);
      }
    } else if (token.startsWith("`")) {
      pushText(token.slice(1, -1), [{ type: "code" }]);
    } else if (token.startsWith("[")) {
      const href = match[3] ?? "";
      if (!safeLinkPattern.test(href)) {
        pushText(match[2] ?? "");
      } else {
        pushText(match[2] ?? "", [
          {
            type: "link",
            attrs: {
              href,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
              title: match[4] || null,
            },
          },
        ]);
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      pushText(match[5] ?? match[6] ?? "", [{ type: "bold" }]);
    } else if (token.startsWith("~~")) {
      pushText(match[7] ?? "", [{ type: "strike" }]);
    } else {
      pushText(match[8] ?? match[9] ?? "", [{ type: "italic" }]);
    }
    cursor = index + token.length;
  }
  pushText(text.slice(cursor));
  return nodes;
}

export function markdownToRichTextDocument(
  source: string,
): MarkdownRichDocument {
  const clozes = parseMarkdownClozes(source);
  const clozeQueues = new Map<string, ParsedMarkdownCloze[]>();
  clozes.forEach((cloze) => {
    const queue = clozeQueues.get(cloze.source) ?? [];
    queue.push(cloze);
    clozeQueues.set(cloze.source, queue);
  });
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const content: MarkdownRichNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index]!)) {
        code.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      content.push({
        type: "codeBlock",
        attrs: { language: language || null },
        content: code.length
          ? [{ type: "text", text: code.join("\n") }]
          : undefined,
      });
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1]!.length },
        content: inlineNodes(heading[2]!, clozeQueues),
      });
      index += 1;
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: inlineNodes(quote[1]!, clozeQueues),
          },
        ],
      });
      index += 1;
      continue;
    }
    const list = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /\d+\./.test(list[2]!);
      const items: MarkdownRichNode[] = [];
      const start = ordered ? Number.parseInt(list[2]!, 10) : 1;
      while (index < lines.length) {
        const item = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(lines[index]!);
        if (!item || /\d+\./.test(item[2]!) !== ordered) break;
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineNodes(item[3]!, clozeQueues),
            },
          ],
        });
        index += 1;
      }
      content.push({
        type: ordered ? "orderedList" : "bulletList",
        attrs: ordered ? { start, type: null } : undefined,
        content: items,
      });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(?:#{2,3}\s+|>\s?|```|\s*(?:[-*+]\s+|\d+\.\s+|---+\s*$|\*\*\*+\s*$))/.test(
        lines[index]!,
      )
    ) {
      paragraph.push(lines[index]!);
      index += 1;
    }
    const paragraphNodes: MarkdownRichNode[] = [];
    paragraph.forEach((value, lineIndex) => {
      paragraphNodes.push(...inlineNodes(value, clozeQueues));
      if (lineIndex < paragraph.length - 1) {
        paragraphNodes.push({ type: "hardBreak" });
      }
    });
    content.push({ type: "paragraph", content: paragraphNodes });
  }

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

const escapeMarkdown = (value: string): string =>
  value.replace(/([\\`*_[\]{}])/g, "\\$1");

function richInlineToMarkdown(nodes: MarkdownRichNode[] = []): string {
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
      if (node.type !== "text") return richInlineToMarkdown(node.content);
      let result = escapeMarkdown(node.text ?? "");
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
      return `${Number(node.attrs?.level) === 3 ? "###" : "##"} ${inline}`;
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
            `${node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}.` : "-"} ${richInlineToMarkdown(item.content?.[0]?.content)}`,
        )
        .join("\n");
    }
    if (node.type === "codeBlock") {
      return `\`\`\`${String(node.attrs?.language ?? "")}\n${(node.content ?? []).map((child) => child.text ?? "").join("")}\n\`\`\``;
    }
    if (node.type === "horizontalRule") return "---";
    return inline;
  };
  return document.content.map(render).join("\n\n").trim();
}
