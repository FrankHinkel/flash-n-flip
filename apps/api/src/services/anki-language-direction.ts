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
      directions: {},
    };
  }
  const locales = [
    languagePair.sourceLocale,
    languagePair.targetLocale,
  ] as const;
  let detectedCards = 0;
  let removedMarkers = 0;
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
      const key = `${direction.questionLocale}→${direction.answerLocale}`;
      directions[key] = (directions[key] ?? 0) + 1;
      return {
        ...card,
        front: cleanedFront.content,
        back: cleanedBack.content,
        ...direction,
      };
    }),
  }));
  if (detectedCards === 0) {
    return {
      package: parsed,
      detectedCards: 0,
      removedMarkers: 0,
      directions: {},
    };
  }
  const warnings = [
    ...parsed.warnings,
    `Xefjord-Sprachrichtung für ${detectedCards} Karten automatisch erkannt; ${removedMarkers} reine Sprachmarker wurden entfernt.`,
  ];
  return {
    package: { ...parsed, decks, warnings },
    detectedCards,
    removedMarkers,
    directions,
  };
}
