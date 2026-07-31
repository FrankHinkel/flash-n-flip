import type {
  AnkiCardContent,
  AnkiContentBlock,
  ParsedAnkiPackage,
} from "./anki-package.js";

export type DetectedAnkiLanguageDirection = {
  questionLocale: string;
  answerLocale: string;
};

export type XefjordLanguageDetection = {
  package: ParsedAnkiPackage;
  detectedCards: number;
  removedMarkers: number;
  removedRepeatedQuestions: number;
  directions: Record<string, number>;
};

type Marker = {
  line: string;
  locale: string;
  production: boolean;
};

const xefjordTitlePattern = /^xefjord['’]s complete\b/i;

const normalizedLabel = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const localeLabels = (locale: string): string[] => {
  const language = locale.split("-")[0] ?? locale;
  const labels = new Set([normalizedLabel(locale), normalizedLabel(language)]);
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    for (const candidate of [locale, language]) {
      const label = displayNames.of(candidate);
      if (label) labels.add(normalizedLabel(label));
    }
  } catch {
    // Locale codes remain available as a conservative fallback.
  }
  return [...labels];
};

const labelMatchesLocale = (label: string, locale: string): boolean => {
  const normalized = normalizedLabel(label);
  return localeLabels(locale).some(
    (candidate) =>
      normalized === candidate || normalized.startsWith(`${candidate} (`),
  );
};

const textLines = (content: AnkiCardContent): string[] =>
  content.blocks.flatMap((block) => {
    if (block.type === "text" || block.type === "heading") {
      return block.text.replace(/\r\n?/g, "\n").split("\n");
    }
    if (block.type === "list") return block.items;
    return [];
  });

const lastMatchingIndex = (
  values: readonly string[],
  predicate: (value: string) => boolean,
): number => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index]!)) return index;
  }
  return -1;
};

const detectMarker = (
  content: AnkiCardContent,
  locales: readonly [string, string],
): Marker | null => {
  const candidate = textLines(content)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!candidate) return null;
  const productionMatch = candidate.match(/^to\s+(.+)$/i);
  const label = productionMatch?.[1]?.trim() ?? candidate;
  const matches = [...new Set(locales)].filter((locale) =>
    labelMatchesLocale(label, locale),
  );
  if (matches.length !== 1) return null;
  return {
    line: candidate,
    locale: matches[0]!,
    production: Boolean(productionMatch),
  };
};

const removeLastMarkerLine = (
  content: AnkiCardContent,
  markerLine: string,
): { content: AnkiCardContent; removed: boolean } => {
  let removed = false;
  const marker = normalizedLabel(markerLine);
  const blocks = [...content.blocks]
    .reverse()
    .flatMap((block): AnkiContentBlock[] => {
      if (removed) return [block];
      if (block.type === "text" || block.type === "heading") {
        const lines = block.text.replace(/\r\n?/g, "\n").split("\n");
        const index = lastMatchingIndex(
          lines,
          (line) => normalizedLabel(line) === marker,
        );
        if (index < 0) return [block];
        lines.splice(index, 1);
        removed = true;
        const text = lines
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        return text ? [{ ...block, text }] : [];
      }
      if (block.type === "list") {
        const index = lastMatchingIndex(
          block.items,
          (item) => normalizedLabel(item) === marker,
        );
        if (index < 0) return [block];
        const items = [...block.items];
        items.splice(index, 1);
        removed = true;
        return items.length ? [{ ...block, items }] : [];
      }
      return [block];
    })
    .reverse();
  return { content: { blocks }, removed };
};

const hasMeaningfulContent = (content: AnkiCardContent): boolean =>
  content.blocks.some((block) => {
    if (block.type === "text" || block.type === "heading") {
      return Boolean(block.text.trim());
    }
    if (block.type === "list") return block.items.some((item) => item.trim());
    return true;
  });

const removeRepeatedQuestionFromAnswer = (
  question: AnkiCardContent,
  answer: AnkiCardContent,
): { content: AnkiCardContent; removed: boolean } => {
  if (question.blocks.length !== 1 || answer.blocks.length === 0) {
    return { content: answer, removed: false };
  }
  const questionBlock = question.blocks[0]!;
  const answerBlock = answer.blocks[0]!;
  if (
    (questionBlock.type !== "text" && questionBlock.type !== "heading") ||
    (answerBlock.type !== "text" && answerBlock.type !== "heading")
  ) {
    return { content: answer, removed: false };
  }
  const questionText = questionBlock.text.replace(/\r\n?/g, "\n");
  const answerText = answerBlock.text.replace(/\r\n?/g, "\n");
  if (!questionText || !answerText.startsWith(questionText)) {
    return { content: answer, removed: false };
  }
  const suffix = answerText.slice(questionText.length);
  const separator = suffix.match(
    /^(?:\u0001[ \t\n]*|\n[ \t]*\n[ \t\n]*)/u,
  )?.[0];
  if (!separator) return { content: answer, removed: false };
  const targetText = suffix.slice(separator.length).trim();
  if (!targetText) return { content: answer, removed: false };
  return {
    content: {
      blocks: [{ ...answerBlock, text: targetText }, ...answer.blocks.slice(1)],
    },
    removed: true,
  };
};

export function detectXefjordLanguageDirections(
  parsed: ParsedAnkiPackage,
  languagePair: { sourceLocale: string; targetLocale: string },
): XefjordLanguageDetection {
  if (
    !xefjordTitlePattern.test(parsed.collectionTitle) ||
    languagePair.sourceLocale === languagePair.targetLocale
  ) {
    return {
      package: parsed,
      detectedCards: 0,
      removedMarkers: 0,
      removedRepeatedQuestions: 0,
      directions: {},
    };
  }
  const locales = [
    languagePair.sourceLocale,
    languagePair.targetLocale,
  ] as const;
  let detectedCards = 0;
  let removedMarkers = 0;
  let removedRepeatedQuestions = 0;
  const directions: Record<string, number> = {};
  const decks = parsed.decks.map((deck) => ({
    ...deck,
    cards: deck.cards.map((card) => {
      const marker = detectMarker(card.front, locales);
      if (!marker) return card;
      const otherLocale = locales.find((locale) => locale !== marker.locale);
      if (!otherLocale) return card;
      const cleanedFront = removeLastMarkerLine(card.front, marker.line);
      if (
        !cleanedFront.removed ||
        !hasMeaningfulContent(cleanedFront.content)
      ) {
        return card;
      }
      const cleanedBack = marker.production
        ? removeLastMarkerLine(card.back, marker.line)
        : { content: card.back, removed: false };
      const deduplicatedBack = marker.production
        ? removeRepeatedQuestionFromAnswer(
            cleanedFront.content,
            cleanedBack.content,
          )
        : { content: cleanedBack.content, removed: false };
      const direction: DetectedAnkiLanguageDirection = marker.production
        ? {
            questionLocale: otherLocale,
            answerLocale: marker.locale,
          }
        : {
            questionLocale: marker.locale,
            answerLocale: otherLocale,
          };
      detectedCards += 1;
      removedMarkers +=
        Number(cleanedFront.removed) + Number(cleanedBack.removed);
      removedRepeatedQuestions += Number(deduplicatedBack.removed);
      const key = `${direction.questionLocale}→${direction.answerLocale}`;
      directions[key] = (directions[key] ?? 0) + 1;
      return {
        ...card,
        front: cleanedFront.content,
        back: deduplicatedBack.content,
        ...direction,
      };
    }),
  }));
  if (detectedCards === 0) {
    return {
      package: parsed,
      detectedCards: 0,
      removedMarkers: 0,
      removedRepeatedQuestions: 0,
      directions: {},
    };
  }
  const warnings = [
    ...parsed.warnings,
    `Xefjord-Sprachrichtung für ${detectedCards} Karten automatisch erkannt; ${removedMarkers} reine Sprachmarker und ${removedRepeatedQuestions} wiederholte Fragen wurden entfernt.`,
  ];
  return {
    package: { ...parsed, decks, warnings },
    detectedCards,
    removedMarkers,
    removedRepeatedQuestions,
    directions,
  };
}
