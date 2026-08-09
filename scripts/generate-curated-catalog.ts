import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { curatedCatalogSchema } from "../packages/domain/src/curated-catalog.js";

import {
  conjugationLanguageSummaries,
  conjugationVerbCount,
  createConjugationCollectionDeckSeeds,
} from "../apps/api/src/services/conjugation-deck.js";
import {
  coreLanguageConceptCount,
  createCoreLanguageDeckSeeds,
} from "../apps/api/src/services/core-language-deck.js";
import {
  createDeveloperReferenceLibraryDeckSeeds,
  developerReferenceLibraryCategoryCount,
  developerReferenceLibraryTechnologyCount,
} from "../apps/api/src/services/developer-reference-library.js";
import {
  createGeographyDeckSeed,
  geographyTemplateKey,
  geographyTemplates,
} from "../apps/api/src/services/geography-decks.js";
import {
  createIrregularVerbDeckSeeds,
  irregularVerbCount,
  irregularVerbLanguageSummaries,
} from "../apps/api/src/services/irregular-verb-deck.js";

type SourceCard = {
  key?: string;
  conceptKey?: string;
  front: unknown;
  back: unknown;
  translations?: unknown;
  questionLocale?: string | null;
  answerLocale?: string | null;
  kind?: "QUESTION" | "EXPLANATION";
  linkedToPrevious?: boolean;
};

type SourceDeck = {
  key: string;
  parentKey: string | null;
  title: string;
  description?: string;
  locale?: string;
  contentLocales?: readonly string[];
  studyOrder?: "SCHEDULED" | "SEQUENTIAL";
  tags?: readonly string[];
  visual?: { kind: "GLOBE" | "MAP" | "FLAG" | "IMAGE"; value: string };
  cards: readonly SourceCard[];
};

const normalizeDeck = (seed: SourceDeck) => {
  const language = seed.locale ?? "en";
  const contentLocales = [...(seed.contentLocales ?? [language])];
  return {
    key: seed.key,
    parentKey: seed.parentKey,
    title: seed.title,
    description: seed.description ?? "",
    language,
    contentLocales,
    defaultContentLocale: language,
    sourceLocale: language,
    targetLocale: language,
    studyOrder: seed.studyOrder,
    tags: [...(seed.tags ?? [])],
    visual: seed.visual,
    cards: seed.cards.map((card, index) => ({
      key: card.key ?? card.conceptKey ?? `card-${String(index + 1)}`,
      front: card.front,
      back: card.back,
      questionLocale: card.questionLocale,
      answerLocale: card.answerLocale,
      translations: card.translations,
      kind: card.kind,
      linkedToPrevious: card.linkedToPrevious,
    })),
  };
};

const stableLocalUuid = (scope: string, key: string) => {
  const bytes = createHash("sha256")
    .update(`flash-n-flip:local-v2:${scope}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const conjugations = createConjugationCollectionDeckSeeds().map((seed) =>
  normalizeDeck(seed),
);
const irregularVerbs = createIrregularVerbDeckSeeds().map((seed) =>
  normalizeDeck(seed),
);
const coreLanguages = createCoreLanguageDeckSeeds().map((seed) =>
  normalizeDeck({
    ...seed,
    locale: "en",
    contentLocales: ["en", "de", "fr", "es"],
    tags: ["Languages", "Core 100"],
  }),
);
const developerReference = createDeveloperReferenceLibraryDeckSeeds().map(
  (seed) => normalizeDeck({ ...seed, locale: "en", contentLocales: ["en"] }),
);
const geographyDecks = geographyTemplates.map((template) => {
  const seed = createGeographyDeckSeed(template.id);
  const cardIds = new Map(
    seed.cards.map((card, index) => [
      card.id,
      stableLocalUuid(
        `deck:${seed.templateKey}`,
        `card:card-${String(index + 1)}`,
      ),
    ]),
  );
  const deterministicCards = JSON.parse(
    JSON.stringify(seed.cards, (_key, value: unknown) =>
      typeof value === "string" ? (cardIds.get(value) ?? value) : value,
    ),
  ) as typeof seed.cards;
  return normalizeDeck({
    ...seed,
    cards: deterministicCards,
    key: seed.templateKey,
    parentKey: seed.parentTemplateId
      ? geographyTemplateKey(seed.parentTemplateId)
      : null,
    locale: seed.language,
  });
});

const catalog = curatedCatalogSchema.parse({
  format: "flash-n-flip-curated-catalog",
  generation: 2,
  collections: [
    {
      id: "conjugations",
      title: "Konjugation",
      description:
        "Konjugation in Deutsch, Spanisch, Englisch und Französisch.",
      rootKey: conjugations[0]!.key,
      stats: { verbCount: conjugationVerbCount },
      languages: conjugationLanguageSummaries.map((language) => ({
        ...language,
        itemCount: language.verbCount,
      })),
      decks: conjugations,
    },
    {
      id: "irregular-verbs",
      title: "Irregular Verbs",
      description:
        "Wichtige unregelmäßige Verben in Deutsch, Englisch, Spanisch und Französisch.",
      rootKey: irregularVerbs[0]!.key,
      stats: { verbCount: irregularVerbCount },
      languages: irregularVerbLanguageSummaries.map((language) => ({
        ...language,
        itemCount: language.verbCount,
      })),
      decks: irregularVerbs,
    },
    {
      id: "core-languages",
      title: "Core Languages: Core 100",
      description:
        "100 gemeinsame Begriffe in Englisch, Deutsch, Französisch und Spanisch.",
      rootKey: coreLanguages[0]!.key,
      stats: { conceptCount: coreLanguageConceptCount },
      decks: coreLanguages,
    },
    {
      id: "developer-reference-library",
      title: "Developer Reference Library",
      description:
        "Eine englische Referenzsammlung für Entwicklung, Werkzeuge und Diagnose.",
      rootKey: developerReference[0]!.key,
      stats: {
        categoryCount: developerReferenceLibraryCategoryCount,
        technologyCount: developerReferenceLibraryTechnologyCount,
      },
      decks: developerReference,
    },
    {
      id: "geography",
      title: "Geography",
      description: "Kuratierte Karten für Welt, Kontinente und Regionen.",
      rootKey: geographyTemplateKey("world"),
      decks: geographyDecks,
    },
  ],
  geographyTemplates: geographyTemplates.map((template) => ({
    ...template,
    deckKey: geographyTemplateKey(template.id),
  })),
});

const main = async () => {
  const target = resolve(
    process.cwd(),
    "../web/public/curated/catalog.v2.json",
  );
  const output = `${JSON.stringify(catalog)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== output) {
      throw new Error("Curated catalog is not up to date.");
    }
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output);
  }
};

void main();
