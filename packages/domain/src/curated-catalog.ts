import { z } from "zod";

import {
  cardContentSchema,
  localizedCardContentsSchema,
  type CardContent,
  type LocalizedCardContents,
} from "./content.js";

export type CuratedCatalogCard = {
  key: string;
  front: CardContent;
  back: CardContent;
  questionLocale?: string | null;
  answerLocale?: string | null;
  translations?: LocalizedCardContents;
  kind?: "QUESTION" | "EXPLANATION";
  linkedToPrevious?: boolean;
};

export type CuratedCatalogDeck = {
  key: string;
  parentKey: string | null;
  title: string;
  description: string;
  language: string;
  contentLocales: string[];
  defaultContentLocale: string;
  sourceLocale: string;
  targetLocale: string;
  studyOrder?: "SCHEDULED" | "SEQUENTIAL";
  tags: string[];
  visual?:
    | { kind: "GLOBE"; value: "world" }
    | { kind: "MAP"; value: string }
    | { kind: "FLAG"; value: string }
    | { kind: "IMAGE"; value: string }
    | null;
  cards: CuratedCatalogCard[];
};

export type CuratedCatalogCollection = {
  id: string;
  title: string;
  description: string;
  rootKey: string;
  stats: Record<string, number>;
  languages: Array<{
    locale: "de" | "es" | "en" | "fr";
    code: "DE" | "ES" | "EN" | "FR";
    title: string;
    itemCount: number;
  }>;
  decks: CuratedCatalogDeck[];
};

export type CuratedCatalog = {
  format: "flash-n-flip-curated-catalog";
  generation: 2;
  collections: CuratedCatalogCollection[];
  geographyTemplates: Array<{
    id: string;
    parentId: string | null;
    mapId: string;
    countryCode?: string;
    titles: Record<string, string>;
    descriptions: Record<string, string>;
    deckKey: string;
  }>;
};

const curatedCatalogCardSchema: z.ZodType<CuratedCatalogCard> = z.object({
  key: z.string().min(1).max(240),
  front: cardContentSchema,
  back: cardContentSchema,
  questionLocale: z.string().max(24).nullable().optional(),
  answerLocale: z.string().max(24).nullable().optional(),
  translations: localizedCardContentsSchema.optional(),
  kind: z.enum(["QUESTION", "EXPLANATION"]).optional(),
  linkedToPrevious: z.boolean().optional(),
});

const curatedCatalogDeckSchema: z.ZodType<CuratedCatalogDeck> = z.object({
  key: z.string().min(1).max(240),
  parentKey: z.string().min(1).max(240).nullable(),
  title: z.string().min(1).max(240),
  description: z.string().max(4_000).default(""),
  language: z.string().min(2).max(24),
  contentLocales: z.array(z.string().min(2).max(24)).min(1).max(20),
  defaultContentLocale: z.string().min(2).max(24),
  sourceLocale: z.string().min(2).max(24),
  targetLocale: z.string().min(2).max(24),
  studyOrder: z.enum(["SCHEDULED", "SEQUENTIAL"]).optional(),
  tags: z.array(z.string().max(120)).max(40).default([]),
  visual: z
    .union([
      z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }),
      z.object({ kind: z.literal("MAP"), value: z.string().min(1).max(240) }),
      z.object({ kind: z.literal("FLAG"), value: z.string().min(1).max(240) }),
      z.object({ kind: z.literal("IMAGE"), value: z.string().min(1).max(240) }),
    ])
    .nullable()
    .optional(),
  cards: z.array(curatedCatalogCardSchema).max(10_000),
});

const curatedCatalogCollectionSchema: z.ZodType<CuratedCatalogCollection> =
  z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(240),
    description: z.string().max(4_000),
    rootKey: z.string().min(1).max(240),
    stats: z
      .record(z.string().max(80), z.number().int().nonnegative())
      .default({}),
    languages: z
      .array(
        z.object({
          locale: z.enum(["de", "es", "en", "fr"]),
          code: z.enum(["DE", "ES", "EN", "FR"]),
          title: z.string().min(1).max(240),
          itemCount: z.number().int().nonnegative(),
        }),
      )
      .max(10)
      .default([]),
    decks: z.array(curatedCatalogDeckSchema).min(1).max(500),
  });

const curatedGeographyTemplateSchema = z.object({
  id: z.string().min(1).max(120),
  parentId: z.string().min(1).max(120).nullable(),
  mapId: z.string().min(1).max(120),
  countryCode: z.string().min(2).max(3).optional(),
  titles: z.record(z.string(), z.string().min(1).max(240)),
  descriptions: z.record(z.string(), z.string().max(4_000)),
  deckKey: z.string().min(1).max(240),
});

export const curatedCatalogSchema: z.ZodType<CuratedCatalog> = z.object({
  format: z.literal("flash-n-flip-curated-catalog"),
  generation: z.literal(2),
  collections: z.array(curatedCatalogCollectionSchema).max(50),
  geographyTemplates: z.array(curatedGeographyTemplateSchema).max(500),
});
