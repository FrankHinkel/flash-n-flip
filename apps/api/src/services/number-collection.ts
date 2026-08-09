import type { CardContent } from "@flashcards/domain/content";
import {
  formatNumberDigits,
  numberLanguages,
  numberLanguage,
  numberLearningCategories,
  numberLearningCategoriesForMaximum,
  numberLearningCategoryValue,
  numberPracticeRanges,
  spellNumber,
  type NumberLearningCategoryKey,
  type NumberLocale,
  type NumberPracticeMaximum,
} from "@flashcards/domain/numbers";

import type { db as database } from "../db/client.js";
import {
  syncVirtualCollectionForOwner,
  type VirtualCollectionDeckSeed,
} from "./virtual-collection-sync.js";

export const numberCollectionTemplateKey = "virtual:numbers:v1";
export const numberCollectionTag = "virtual-number-collection";
export const numberExerciseTag = "virtual-number-exercise";
export const progressUnitTag = "virtual-progress-unit";

const content = (...texts: string[]): CardContent => ({
  blocks: texts.map((text) => ({ type: "text" as const, text })),
});

const pairKey = (source: NumberLocale, target: NumberLocale) =>
  `${numberCollectionTemplateKey}:pair:${source}:${target}`;

const categoryKey = (
  source: NumberLocale,
  target: NumberLocale,
  category: NumberLearningCategoryKey,
) => `${pairKey(source, target)}:category:${category}`;

export const numberCollectionCategoryFromTags = (
  tags: readonly string[],
): {
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  categoryKey: NumberLearningCategoryKey;
} | null => {
  if (!tags.includes(numberExerciseTag)) return null;
  const sourceLocale = tags
    .find((tag) => tag.startsWith("number-source:"))
    ?.slice("number-source:".length) as NumberLocale | undefined;
  const targetLocale = tags
    .find((tag) => tag.startsWith("number-target:"))
    ?.slice("number-target:".length) as NumberLocale | undefined;
  const key = tags
    .find((tag) => tag.startsWith("number-category:"))
    ?.slice("number-category:".length) as NumberLearningCategoryKey | undefined;
  if (
    !sourceLocale ||
    !targetLocale ||
    !key ||
    !numberLanguages.some(({ locale }) => locale === sourceLocale) ||
    !numberLanguages.some(({ locale }) => locale === targetLocale) ||
    !numberLearningCategories.some((category) => category.key === key)
  ) {
    return null;
  }
  return { sourceLocale, targetLocale, categoryKey: key };
};

export const createNumberCollectionDeckSeeds = async ({
  sourceLocale,
  targetLocale,
  maximum,
  uiLocale,
}: {
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  maximum: NumberPracticeMaximum;
  uiLocale: "en" | "de";
}): Promise<VirtualCollectionDeckSeed[]> => {
  const source = numberLanguage(sourceLocale);
  const target = numberLanguage(targetLocale);
  const root: VirtualCollectionDeckSeed = {
    key: numberCollectionTemplateKey,
    parentKey: null,
    title:
      uiLocale === "de" ? "Zahlen in Sprachen" : "Numbers across languages",
    description:
      uiLocale === "de"
        ? "Virtuell erzeugte Zahlenübungen mit kategoriebasiertem Lernfortschritt."
        : "Virtually generated number exercises with category-based progress.",
    sourceLocale,
    targetLocale,
    contentLocales: [sourceLocale, targetLocale],
    tags: [numberCollectionTag, "virtual-collection"],
    cards: [],
  };
  const pair: VirtualCollectionDeckSeed = {
    key: pairKey(sourceLocale, targetLocale),
    parentKey: root.key,
    title: `${source.nativeName} → ${target.nativeName}`,
    description:
      uiLocale === "de"
        ? `Eigener Lernfortschritt für ${source.nativeName} → ${target.nativeName}.`
        : `Independent progress for ${source.nativeName} → ${target.nativeName}.`,
    sourceLocale,
    targetLocale,
    contentLocales: [sourceLocale, targetLocale],
    tags: [numberCollectionTag, "virtual-language-pair"],
    cards: [],
  };
  const categories = await Promise.all(
    numberLearningCategoriesForMaximum(maximum).map(async (category) => ({
      key: categoryKey(sourceLocale, targetLocale, category.key),
      parentKey: pair.key,
      title: uiLocale === "de" ? category.de : category.en,
      description:
        uiLocale === "de"
          ? `${category.slots} stabile Kompetenzübungen mit wechselnden Zahlen.`
          : `${category.slots} stable competency exercises with changing numbers.`,
      sourceLocale,
      targetLocale,
      contentLocales: [sourceLocale, targetLocale],
      tags: [
        numberCollectionTag,
        numberExerciseTag,
        progressUnitTag,
        `number-source:${sourceLocale}`,
        `number-target:${targetLocale}`,
        `number-category:${category.key}`,
      ],
      cards: await Promise.all(
        Array.from({ length: category.slots }, async (_, slot) => {
          const key = `${category.key}:slot:${slot + 1}`;
          const value = numberLearningCategoryValue(category.key, key);
          const [sourceWords, targetWords] = await Promise.all([
            spellNumber(value, sourceLocale),
            spellNumber(value, targetLocale),
          ]);
          return {
            key,
            front: content(
              formatNumberDigits(value, sourceLocale),
              sourceWords,
            ),
            back: content(formatNumberDigits(value, targetLocale), targetWords),
            questionLocale: sourceLocale,
            answerLocale: targetLocale,
          };
        }),
      ),
    })),
  );
  return [root, pair, ...categories];
};

export async function syncNumberCollectionForOwner(
  db: typeof database,
  ownerId: string,
  input: {
    sourceLocale: NumberLocale;
    targetLocale: NumberLocale;
    maximum: NumberPracticeMaximum;
    uiLocale: "en" | "de";
  },
) {
  const seeds = await createNumberCollectionDeckSeeds(input);
  const result = await syncVirtualCollectionForOwner(db, ownerId, seeds);
  return {
    ...result,
    rootDeckId: result.idsByKey.get(numberCollectionTemplateKey)!,
    pairDeckId: result.idsByKey.get(
      pairKey(input.sourceLocale, input.targetLocale),
    )!,
  };
}

export const renderNumberExerciseCard = async <
  T extends {
    id: string;
    front: Record<string, unknown>;
    back: Record<string, unknown>;
    questionLocale?: string | null;
    answerLocale?: string | null;
  },
>(
  card: T,
  tags: readonly string[],
  reviewCount: number,
): Promise<T> => {
  const definition = numberCollectionCategoryFromTags(tags);
  if (!definition) return card;
  const value = numberLearningCategoryValue(
    definition.categoryKey,
    `${card.id}:review:${reviewCount}`,
  );
  const [sourceWords, targetWords] = await Promise.all([
    spellNumber(value, definition.sourceLocale),
    spellNumber(value, definition.targetLocale),
  ]);
  return {
    ...card,
    front: content(
      formatNumberDigits(value, definition.sourceLocale),
      sourceWords,
    ),
    back: content(
      formatNumberDigits(value, definition.targetLocale),
      targetWords,
    ),
    questionLocale: definition.sourceLocale,
    answerLocale: definition.targetLocale,
  } as T;
};

export const numberCollectionTemplate = {
  title: "Numbers across languages",
  description:
    "Install language pairs as a normal collection while exercises stay virtual.",
  languageCount: numberLanguages.length,
  categoryCount: numberLearningCategories.length,
  ranges: numberPracticeRanges,
};
