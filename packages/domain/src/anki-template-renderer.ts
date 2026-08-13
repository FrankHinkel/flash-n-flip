export type AnkiTemplateRenderContext = {
  fields: ReadonlyMap<string, string>;
  ordinal: number;
  answer: boolean;
  front?: string;
  deckPath?: readonly string[];
  noteTypeName?: string;
  templateName?: string;
  tags?: readonly string[];
  cardFlag?: number;
};

export type AnkiTemplateRenderResult = {
  html: string;
  warnings: string[];
};

const maximumTemplateLength = 100_000;
const maximumRenderedLength = 500_000;

const normalize = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase("en");

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_match, number: string) =>
      String.fromCodePoint(Number(number)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) =>
      String.fromCodePoint(Number.parseInt(number, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const plainText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(
        /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        "",
      )
      .replace(/<[^>]+>/g, ""),
  );

const cloze = (value: string, target: number, answer: boolean): string =>
  value.replace(
    /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/gi,
    (_match, number: string, text: string, hint?: string) =>
      Number(number) !== target || answer
        ? text
        : `[${hint?.trim() || "…"}]`,
  );

const furigana = (value: string): string =>
  value.replace(/\s*([^\s\[\]]+)\[([^\[\]]+)\]/g, "$1（$2）");

const kana = (value: string): string =>
  value.replace(/(?:[^\s\[\]]+)\[([^\[\]]+)\]/g, "$1");

const kanji = (value: string): string =>
  value.replace(/([^\s\[\]]+)\[[^\[\]]+\]/g, "$1");

const lookup = (
  fields: ReadonlyMap<string, string>,
  requested: string,
): string | undefined => {
  if (fields.has(requested)) return fields.get(requested);
  const target = normalize(requested);
  for (const [name, value] of fields) {
    if (normalize(name) === target) return value;
  }
  return undefined;
};

const specialValue = (
  name: string,
  context: AnkiTemplateRenderContext,
): string | undefined => {
  switch (normalize(name)) {
    case "frontside":
      return context.front ?? "";
    case "tags":
      return context.tags?.join(" ") ?? "";
    case "type":
      return context.noteTypeName ?? "";
    case "deck":
      return context.deckPath?.join("::") ?? "";
    case "subdeck":
      return context.deckPath?.at(-1) ?? "";
    case "card":
      return context.templateName ?? "";
    case "cardflag":
      return String(context.cardFlag ?? 0);
    default:
      return undefined;
  }
};

const fieldValue = (
  name: string,
  context: AnkiTemplateRenderContext,
): string => specialValue(name, context) ?? lookup(context.fields, name) ?? "";

type ConditionalFrame = {
  name: string;
  inverted: boolean;
  chunks: string[];
};

const renderConditionals = (
  source: string,
  context: AnkiTemplateRenderContext,
  warnings: Set<string>,
): string => {
  const root: ConditionalFrame = { name: "", inverted: false, chunks: [] };
  const stack = [root];
  const tokenPattern = /\{\{\s*([#^/])\s*([^{}]+?)\s*\}\}/g;
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    const current = stack.at(-1)!;
    current.chunks.push(source.slice(cursor, match.index));
    const operator = match[1]!;
    const name = match[2]!.trim().split(":").at(-1)!.trim();
    if (operator === "#" || operator === "^") {
      stack.push({ name, inverted: operator === "^", chunks: [] });
    } else if (stack.length > 1 && normalize(stack.at(-1)!.name) === normalize(name)) {
      const frame = stack.pop()!;
      const present = Boolean(fieldValue(frame.name, context).trim());
      if (present !== frame.inverted) stack.at(-1)!.chunks.push(frame.chunks.join(""));
    } else {
      warnings.add("Eine fehlerhafte bedingte Anki-Vorlage wurde sicher vereinfacht.");
    }
    cursor = (match.index ?? 0) + match[0].length;
  }
  stack.at(-1)!.chunks.push(source.slice(cursor));
  while (stack.length > 1) {
    const frame = stack.pop()!;
    const present = Boolean(fieldValue(frame.name, context).trim());
    if (present !== frame.inverted) stack.at(-1)!.chunks.push(frame.chunks.join(""));
    warnings.add("Eine nicht geschlossene bedingte Anki-Vorlage wurde sicher vereinfacht.");
  }
  return root.chunks.join("");
};

const renderExpression = (
  expression: string,
  context: AnkiTemplateRenderContext,
  warnings: Set<string>,
): string => {
  const trimmed = expression.trim();
  if (!trimmed || trimmed.startsWith("!")) return "";
  const parts = trimmed.split(":").map((part) => part.trim());
  const name = parts.pop() ?? "";
  const filters = parts.map((part) => normalize(part.split(/\s+/)[0] ?? ""));
  let value = fieldValue(name, context);

  if (filters.includes("cloze") || filters.includes("cloze-only")) {
    value = cloze(value, context.ordinal + 1, context.answer);
  }
  if (filters.includes("furigana")) value = furigana(value);
  if (filters.includes("kana")) value = kana(value);
  if (filters.includes("kanji")) value = kanji(value);
  if (filters.includes("text")) value = plainText(value);
  if (filters.includes("type")) value = context.answer ? plainText(value) : "";
  if (filters.some((filter) => filter === "tts")) {
    warnings.add(
      "Eine Anki-TTS-Anweisung wurde nicht ausgeführt; der Text bleibt für die Flash-n-Flip-Sprachausgabe erhalten.",
    );
    return "";
  }
  const supported = new Set([
    "cloze",
    "cloze-only",
    "furigana",
    "kana",
    "kanji",
    "text",
    "type",
    "hint",
  ]);
  if (filters.some((filter) => filter && !supported.has(filter))) {
    warnings.add("Ein unbekannter Anki-Vorlagenfilter wurde ohne Codeausführung als Text importiert.");
  }
  return value;
};

export const renderAnkiTemplate = (
  template: string,
  context: AnkiTemplateRenderContext,
): AnkiTemplateRenderResult => {
  const warnings = new Set<string>();
  const bounded = template.slice(0, maximumTemplateLength);
  if (template.length > maximumTemplateLength) {
    warnings.add("Eine übergroße Anki-Vorlage wurde auf 100.000 Zeichen begrenzt.");
  }
  const conditional = renderConditionals(bounded, context, warnings);
  let remainingExpansion = Math.max(
    0,
    maximumRenderedLength - conditional.length,
  );
  const expanded = conditional.replace(
    /\{\{([^{}]+)\}\}/g,
    (_token, expression: string) => {
      const replacement = renderExpression(expression, context, warnings);
      const limited = replacement.slice(0, remainingExpansion);
      if (limited.length !== replacement.length) {
        warnings.add(
          "Der Inhalt einer Anki-Karte wurde auf 500.000 Zeichen begrenzt.",
        );
      }
      remainingExpansion -= limited.length;
      return limited;
    },
  );
  const rendered = expanded.replace(
    /\[(?:latex|mathjax)\]([\s\S]*?)\[\/(?:latex|mathjax)\]/gi,
    "$1",
  );
  if (rendered.length > maximumRenderedLength) {
    warnings.add("Der Inhalt einer Anki-Karte wurde auf 500.000 Zeichen begrenzt.");
  }
  const html = rendered.slice(0, maximumRenderedLength);
  return { html, warnings: [...warnings] };
};

export const ankiTemplateFieldNames = (
  template: string,
  fields: readonly string[],
): string[] => {
  const available = new Map(fields.map((field) => [normalize(field), field]));
  return [
    ...new Set(
      [...template.matchAll(/\{\{\s*(?:[#^/]\s*)?([^{}]+?)\s*\}\}/g)].flatMap(
        (match) => {
          const name = match[1]?.split(":").at(-1)?.trim();
          if (!name) return [];
          const field = available.get(normalize(name));
          return field ? [field] : [];
        },
      ),
    ),
  ];
};
