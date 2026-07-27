import type { CardContent, ContentBlock } from "@flashcards/domain/content";

const oversizedDynamicTextLength = 1_000;

const cleanLine = (value: string): string =>
  value
    .replace(/\u3000/g, " ")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();

const textSections = (value: string): string[] =>
  value
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((section) =>
      section.split("\n").map(cleanLine).filter(Boolean).join("\n"),
    )
    .filter(Boolean);

const normalizedText = (value: string): string =>
  cleanLine(value).toLocaleLowerCase();

const appendText = (
  blocks: ContentBlock[],
  seen: Set<string>,
  value: string | undefined,
): void => {
  const text = value?.trim();
  if (!text || text.length > oversizedDynamicTextLength) return;
  const normalized = normalizedText(text);
  if (!normalized || seen.has(normalized) || /^(?:\d+\s*)+$/.test(normalized)) {
    return;
  }
  seen.add(normalized);
  blocks.push({ type: "text", text });
};

export function stripLegacyDynamicMarkers(content: CardContent): CardContent {
  return {
    blocks: content.blocks.map((block) =>
      block.type === "text"
        ? {
            ...block,
            text: block.text.replace(/\*([^*\n]+)\*/g, "$1"),
          }
        : block,
    ),
  };
}

export function compactLegacyDynamicAnkiCard(
  front: CardContent,
  back: CardContent,
  options: { force?: boolean } = {},
): { front: CardContent; back: CardContent } | null {
  const frontTextBlocks = front.blocks.filter(
    (block): block is Extract<ContentBlock, { type: "text" }> =>
      block.type === "text",
  );
  const backTextBlocks = back.blocks.filter(
    (block): block is Extract<ContentBlock, { type: "text" }> =>
      block.type === "text",
  );
  const sourceFront = frontTextBlocks.map((block) => block.text).join("");
  const hasFlattenedTemplateSignature =
    sourceFront.includes("\n\n") ||
    (backTextBlocks[0]?.text.includes("\u3000") ?? false);
  if (
    front.blocks.length !== frontTextBlocks.length ||
    frontTextBlocks.length === 0 ||
    !hasFlattenedTemplateSignature ||
    (!options.force &&
      (sourceFront.length <= oversizedDynamicTextLength ||
        backTextBlocks.reduce(
          (length, block) => length + block.text.length,
          0,
        ) <= oversizedDynamicTextLength))
  ) {
    return null;
  }

  const prompt = cleanLine(sourceFront.split(/\r?\n/)[0] ?? "");
  if (!prompt) return null;

  const seen = new Set([normalizedText(prompt)]);
  const compactBack: ContentBlock[] = [];
  const summarySections = textSections(backTextBlocks[0]?.text ?? "");
  appendText(compactBack, seen, summarySections[0]);
  appendText(compactBack, seen, summarySections[2]);
  appendText(compactBack, seen, summarySections[3]);

  for (const block of back.blocks) {
    if (block.type !== "text") compactBack.push(block);
  }

  const detailSections = textSections(
    backTextBlocks
      .slice(1)
      .map((block) => block.text)
      .join(""),
  );
  const detailLines = (detailSections[0] ?? "")
    .split("\n")
    .filter((line) => !seen.has(normalizedText(line)));
  appendText(compactBack, seen, detailLines[0]);
  appendText(compactBack, seen, detailSections[1]);

  if (compactBack.length === 0) return null;
  return {
    front: { blocks: [{ type: "text", text: prompt }] },
    back: { blocks: compactBack },
  };
}
