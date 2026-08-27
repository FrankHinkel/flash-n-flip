import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
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
  createFnfHelpLibraryDeckSeeds,
  fnfHelpLibraryCardCount,
  fnfHelpLibraryExampleCount,
  fnfHelpLibraryTemplateKey,
  fnfHelpLibraryTopicCount,
} from "../apps/api/src/services/fnf-help-library.js";
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
import {
  createStatisticsIntroductionDeckSeeds,
  statisticsIntroductionCardCount,
} from "../apps/api/src/services/statistics-introduction-deck.js";

type SourceCard = {
  key?: string;
  conceptKey?: string;
  front: unknown;
  back: unknown;
  translations?: unknown;
  questionLocale?: string | null;
  answerLocale?: string | null;
  kind?: "QUESTION" | "EXPLANATION";
  usage?: "LEARNING" | "REFERENCE";
  linkedToPrevious?: boolean;
  suspended?: boolean;
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

const catalogPublishedAt = "2026-08-27T00:00:00.000Z";

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(",")}}`;
};

const contentSha256 = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");

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
      usage: card.usage,
      linkedToPrevious: card.linkedToPrevious,
      suspended: card.suspended,
    })),
  };
};

const releaseDeck = <Deck extends ReturnType<typeof normalizeDeck>>(
  deck: Deck,
) => ({ ...deck, contentSha256: contentSha256(deck) });

const releaseCollection = <Collection extends Record<string, unknown>>(
  collection: Collection,
) => ({ ...collection, contentSha256: contentSha256(collection) });

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
  releaseDeck(normalizeDeck(seed)),
);
const irregularVerbs = createIrregularVerbDeckSeeds().map((seed) =>
  releaseDeck(normalizeDeck(seed)),
);
const coreLanguages = createCoreLanguageDeckSeeds().map((seed) =>
  releaseDeck(
    normalizeDeck({
      ...seed,
      locale: "en",
      contentLocales: ["en", "de", "fr", "es"],
      tags: ["Languages", "Core 100"],
    }),
  ),
);
const developerReference = createDeveloperReferenceLibraryDeckSeeds().map(
  (seed) =>
    releaseDeck(
      normalizeDeck({ ...seed, locale: "en", contentLocales: ["en"] }),
    ),
);
const fnfHelp = createFnfHelpLibraryDeckSeeds().map((seed) =>
  releaseDeck(
    normalizeDeck({
      ...seed,
      locale: "en",
      contentLocales: ["en"],
      studyOrder: "SEQUENTIAL",
      tags: [
        "Flash-n-Flip Help",
        "Developer reference",
        "Reference",
        "JSXGraph",
        "Mermaid",
        "ABC",
      ],
    }),
  ),
);
const statisticsIntroduction = createStatisticsIntroductionDeckSeeds().map(
  (seed) => releaseDeck(normalizeDeck(seed)),
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
  return releaseDeck(
    normalizeDeck({
      ...seed,
      cards: deterministicCards,
      key: seed.templateKey,
      parentKey: seed.parentTemplateId
        ? geographyTemplateKey(seed.parentTemplateId)
        : null,
      locale: seed.language,
    }),
  );
});

const catalog = curatedCatalogSchema.parse({
  format: "flash-n-flip-curated-catalog",
  generation: 2,
  publishedAt: catalogPublishedAt,
  collections: [
    releaseCollection({
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
    }),
    releaseCollection({
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
    }),
    releaseCollection({
      id: "core-languages",
      title: "Core Languages: Core 100",
      description:
        "100 gemeinsame Begriffe in Englisch, Deutsch, Französisch und Spanisch.",
      rootKey: coreLanguages[0]!.key,
      stats: { conceptCount: coreLanguageConceptCount },
      decks: coreLanguages,
    }),
    releaseCollection({
      id: "statistics-introduction",
      title: "Statistik · Einführung",
      description:
        "20 deutschsprachige Lernkarten mit Beispielen von deskriptiver Statistik und Wahrscheinlichkeit bis Inferenz und Regression.",
      rootKey: statisticsIntroduction[0]!.key,
      stats: { cardCount: statisticsIntroductionCardCount },
      decks: statisticsIntroduction,
    }),
    releaseCollection({
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
    }),
    releaseCollection({
      id: "fnf-help-library",
      title: "Flash-n-Flip Help",
      description:
        "English introductions and copyable references for Flash-n-Flip rich-content formats.",
      rootKey: fnfHelpLibraryTemplateKey,
      stats: {
        topicCount: fnfHelpLibraryTopicCount,
        cardCount: fnfHelpLibraryCardCount,
        exampleCount: fnfHelpLibraryExampleCount,
      },
      decks: fnfHelp,
    }),
    releaseCollection({
      id: "geography",
      title: "Geography",
      description: "Kuratierte Karten für Welt, Kontinente und Regionen.",
      rootKey: geographyTemplateKey("world"),
      decks: geographyDecks,
    }),
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
  const signatureTarget = resolve(
    process.cwd(),
    "../web/public/curated/catalog.v2.signature.json",
  );
  const localSigningKey = resolve(
    process.cwd(),
    "../../.secrets/webstack-ed25519.pem",
  );
  const signingKeyFile =
    process.env.FNF_WEBSTACK_SIGNING_KEY_FILE ||
    ((await stat(localSigningKey).catch(() => null)) ? localSigningKey : "");
  const signingKeyId =
    process.env.FNF_WEBSTACK_SIGNING_KEY_ID || "release-2026-01";
  const manifest = {
    format: "flash-n-flip-signed-curated-catalog",
    version: 1,
    generation: catalog.generation,
    catalogPath: "curated/catalog.v2.json",
    byteSize: Buffer.byteLength(output),
    sha256: createHash("sha256").update(output).digest("hex"),
    signingKeyId,
  } as const;
  let signatureOutput = "";
  if (signingKeyFile) {
    const privateKey = createPrivateKey(await readFile(signingKeyFile));
    const signature = sign(null, Buffer.from(canonical(manifest)), privateKey);
    signatureOutput = `${JSON.stringify(
      {
        manifest,
        signatureBase64: signature.toString("base64"),
      },
      null,
      2,
    )}\n`;
  } else {
    signatureOutput = await readFile(signatureTarget, "utf8").catch(() => "");
    if (!signatureOutput) {
      throw new Error(
        "Curated catalog signing key is required after catalog changes.",
      );
    }
    const signed = JSON.parse(signatureOutput) as {
      manifest: typeof manifest;
      signatureBase64: string;
    };
    const trusted = JSON.parse(
      await readFile(
        resolve(process.cwd(), "../web/public/trusted-webstack-keys.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    const publicKey = trusted[signed.manifest.signingKeyId];
    if (
      canonical(signed.manifest) !== canonical(manifest) ||
      !publicKey ||
      !verify(
        null,
        Buffer.from(canonical(signed.manifest)),
        createPublicKey({
          key: Buffer.from(publicKey, "base64"),
          format: "der",
          type: "spki",
        }),
        Buffer.from(signed.signatureBase64, "base64"),
      )
    ) {
      throw new Error("Curated catalog signature is stale or invalid.");
    }
  }
  if (process.argv.includes("--check")) {
    const current = await readFile(target, "utf8").catch(() => "");
    const currentSignature = await readFile(signatureTarget, "utf8").catch(
      () => "",
    );
    if (current !== output || currentSignature !== signatureOutput) {
      throw new Error("Curated catalog is not up to date.");
    }
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output);
    await writeFile(signatureTarget, signatureOutput);
  }
};

void main();
