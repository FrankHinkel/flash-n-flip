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
  usage?: "LEARNING" | "REFERENCE";
  linkedToPrevious?: boolean;
  suspended?: boolean;
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
  contentSha256: string;
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
  contentSha256: string;
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
  publishedAt: string;
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
  usage: z.enum(["LEARNING", "REFERENCE"]).optional(),
  linkedToPrevious: z.boolean().optional(),
  suspended: z.boolean().optional(),
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
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
  publishedAt: z.string().datetime(),
  collections: z.array(curatedCatalogCollectionSchema).max(50),
  geographyTemplates: z.array(curatedGeographyTemplateSchema).max(500),
});

export const curatedCatalogSignatureManifestSchema = z
  .object({
    format: z.literal("flash-n-flip-signed-curated-catalog"),
    version: z.literal(1),
    generation: z.number().int().positive(),
    catalogPath: z.literal("curated/catalog.v2.json"),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(32 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    signingKeyId: z.string().min(1).max(80),
  })
  .strict();

export const signedCuratedCatalogSchema = z
  .object({
    manifest: curatedCatalogSignatureManifestSchema,
    signatureBase64: z
      .string()
      .min(80)
      .max(256)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export type SignedCuratedCatalog = z.infer<typeof signedCuratedCatalogSchema>;
