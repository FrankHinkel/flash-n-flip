import type { CardContent } from "./content.js";
import {
  formatNumberDigits,
  numberLanguages,
  numberLanguage,
  numberLearningCategories,
  numberLearningCategoriesForMaximum,
  numberLearningCategoryValue,
  numberPracticeRanges,
  numberPracticeValueAt,
  spellNumber,
  type NumberLearningCategoryKey,
  type NumberLocale,
  type NumberPracticeMaximum,
} from "./numbers.js";

export const numberCollectionGeneration = 2;
export const numberCollectionTemplateKey = `virtual:numbers:v${numberCollectionGeneration}`;
export const numberCollectionTag = "virtual-number-collection";
export const numberExerciseTag = "virtual-number-exercise";
export const numberProgressUnitTag = "virtual-progress-unit";
export type NumberCollectionUiLocale = "en" | "de" | "es" | "fr";

const numberCollectionCopy = {
  en: {
    title: "Numbers across languages",
    description:
      "Locally generated number exercises with category-based progress.",
    pair: (pair: string) => `Independent local progress for ${pair}.`,
    category: (slots: number) =>
      `${slots} stable competency exercises with changing numbers.`,
  },
  de: {
    title: "Zahlen in Sprachen",
    description:
      "Lokal erzeugte Zahlenübungen mit kategoriebasiertem Lernfortschritt.",
    pair: (pair: string) => `Eigener lokaler Lernfortschritt für ${pair}.`,
    category: (slots: number) =>
      `${slots} stabile Kompetenzübungen mit wechselnden Zahlen.`,
  },
  es: {
    title: "Números en otros idiomas",
    description:
      "Ejercicios de números generados localmente con progreso por categorías.",
    pair: (pair: string) => `Progreso local independiente para ${pair}.`,
    category: (slots: number) =>
      `${slots} ejercicios estables de competencia con números cambiantes.`,
  },
  fr: {
    title: "Les nombres dans les langues",
    description:
      "Exercices de nombres générés localement avec progression par catégorie.",
    pair: (pair: string) => `Progression locale indépendante pour ${pair}.`,
    category: (slots: number) =>
      `${slots} exercices de compétence stables avec des nombres variables.`,
  },
} as const;

export type NumberCollectionCardSeed = {
  key: string;
  front: CardContent;
  back: CardContent;
  questionLocale: NumberLocale;
  answerLocale: NumberLocale;
};

export type NumberCollectionDeckSeed = {
  key: string;
  parentKey: string | null;
  title: string;
  description: string;
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  contentLocales: NumberLocale[];
  tags: string[];
  cards: NumberCollectionCardSeed[];
};

const content = (...texts: string[]): CardContent => ({
  blocks: texts.map((text) => ({ type: "text" as const, text })),
});

const silentDigits = (value: number, locale: NumberLocale): string =>
  `(${formatNumberDigits(value, locale)})`;

export const numberCollectionPairKey = (
  source: NumberLocale,
  target: NumberLocale,
) => `${numberCollectionTemplateKey}:pair:${source}:${target}`;

export const numberCollectionCategoryKey = (
  source: NumberLocale,
  target: NumberLocale,
  category: NumberLearningCategoryKey,
) => `${numberCollectionPairKey(source, target)}:category:${category}`;

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

export const numberCollectionSequenceFromTags = (
  tags: readonly string[],
): {
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  categoryMaximum: NumberPracticeMaximum;
  key: string;
} | null => {
  const definition = numberCollectionCategoryFromTags(tags);
  if (!definition) return null;
  const category = numberLearningCategories.find(
    ({ key }) => key === definition.categoryKey,
  )!;
  return {
    sourceLocale: definition.sourceLocale,
    targetLocale: definition.targetLocale,
    categoryMaximum: category.maximum,
    key: `${definition.sourceLocale}:${definition.targetLocale}`,
  };
};

export async function createNumberCollectionDeckSeeds(input: {
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  maximum: NumberPracticeMaximum;
  uiLocale: NumberCollectionUiLocale;
}): Promise<NumberCollectionDeckSeed[]> {
  const source = numberLanguage(input.sourceLocale);
  const target = numberLanguage(input.targetLocale);
  const copy = numberCollectionCopy[input.uiLocale];
  const root: NumberCollectionDeckSeed = {
    key: numberCollectionTemplateKey,
    parentKey: null,
    title: copy.title,
    description: copy.description,
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    contentLocales: [input.sourceLocale, input.targetLocale],
    tags: [numberCollectionTag, "virtual-collection"],
    cards: [],
  };
  const pair: NumberCollectionDeckSeed = {
    key: numberCollectionPairKey(input.sourceLocale, input.targetLocale),
    parentKey: root.key,
    title: `${source.nativeName} → ${target.nativeName}`,
    description: copy.pair(`${source.nativeName} → ${target.nativeName}`),
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    contentLocales: [input.sourceLocale, input.targetLocale],
    tags: [numberCollectionTag, "virtual-language-pair"],
    cards: [],
  };
  const categories = await Promise.all(
    numberLearningCategoriesForMaximum(input.maximum).map(
      async (category): Promise<NumberCollectionDeckSeed> => ({
        key: numberCollectionCategoryKey(
          input.sourceLocale,
          input.targetLocale,
          category.key,
        ),
        parentKey: pair.key,
        title: category[input.uiLocale],
        description: copy.category(category.slots),
        sourceLocale: input.sourceLocale,
        targetLocale: input.targetLocale,
        contentLocales: [input.sourceLocale, input.targetLocale],
        tags: [
          numberCollectionTag,
          numberExerciseTag,
          numberProgressUnitTag,
          `number-source:${input.sourceLocale}`,
          `number-target:${input.targetLocale}`,
          `number-category:${category.key}`,
          `number-maximum:${input.maximum}`,
        ],
        cards: await Promise.all(
          Array.from({ length: category.slots }, async (_, slot) => {
            const key = `${category.key}:slot:${slot + 1}`;
            const value = numberLearningCategoryValue(category.key, key);
            const [sourceWords, targetWords] = await Promise.all([
              spellNumber(value, input.sourceLocale),
              spellNumber(value, input.targetLocale),
            ]);
            return {
              key,
              front: content(
                silentDigits(value, input.sourceLocale),
                sourceWords,
              ),
              back: content(
                silentDigits(value, input.targetLocale),
                targetWords,
              ),
              questionLocale: input.sourceLocale,
              answerLocale: input.targetLocale,
            };
          }),
        ),
      }),
    ),
  );
  return [root, pair, ...categories];
}

export async function renderNumberExerciseCard<
  T extends {
    id: string;
    front: unknown;
    back: unknown;
    questionLocale?: string | null;
    answerLocale?: string | null;
  },
>(
  card: T,
  tags: readonly string[],
  completedCount: number,
  options?: {
    maximum?: NumberPracticeMaximum;
    sequenceKey?: string;
  },
): Promise<T> {
  const definition = numberCollectionSequenceFromTags(tags);
  if (!definition) return card;
  const maximum = options?.maximum ?? definition.categoryMaximum;
  const value = numberPracticeValueAt(
    maximum,
    completedCount,
    options?.sequenceKey ?? definition.key,
  );
  const [sourceWords, targetWords] = await Promise.all([
    spellNumber(value, definition.sourceLocale),
    spellNumber(value, definition.targetLocale),
  ]);
  return {
    ...card,
    front: content(silentDigits(value, definition.sourceLocale), sourceWords),
    back: content(silentDigits(value, definition.targetLocale), targetWords),
    questionLocale: definition.sourceLocale,
    answerLocale: definition.targetLocale,
  };
}

export const numberCollectionTemplate = {
  title: "Numbers across languages",
  description:
    "Install language pairs locally while exercises are generated when studied.",
  languageCount: numberLanguages.length,
  categoryCount: numberLearningCategories.length,
  ranges: numberPracticeRanges,
};
