import { z } from "zod";

import { geographyMapIds } from "@flashcards/domain/geography";

const textMarksSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
});

export const contentLocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().max(10_000),
    marks: textMarksSchema.optional(),
  }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
  }),
  z.object({
    type: z.literal("formula"),
    latex: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal("image"),
    mediaId: z.uuid(),
    alt: z.string().trim().max(500),
    decorative: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("audio"),
    mediaId: z.uuid(),
    label: z.string().trim().min(1).max(300),
    transcript: z.string().trim().max(5000).optional(),
  }),
  z.object({
    type: z.literal("video"),
    mediaId: z.uuid(),
    label: z.string().trim().min(1).max(300),
    captions: z.string().trim().max(10_000).optional(),
    posterMediaId: z.uuid().optional(),
  }),
  z.object({
    type: z.literal("animation"),
    preset: z.enum(["fade", "pulse", "draw"]),
    label: z.string().trim().min(1).max(300),
    durationMs: z.number().int().min(100).max(10_000),
  }),
  z.object({
    type: z.literal("graphic"),
    graphicId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    label: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("europeMap"),
    label: z.string().trim().min(1).max(300),
    selectedCountryCode: z.string().length(2).optional(),
    interactive: z.boolean().default(false),
    targets: z
      .array(
        z.object({
          countryCode: z.string().length(2),
          cardId: z.uuid(),
        }),
      )
      .max(100)
      .default([]),
  }),
  z.object({
    type: z.literal("geographyMap"),
    mapId: z.enum(geographyMapIds),
    label: z.string().trim().min(1).max(300),
    selectedRegionCode: z.string().trim().min(2).max(8).optional(),
    interactive: z.boolean().default(false),
    overlays: z
      .array(
        z.object({
          id: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .regex(/^[a-z0-9][a-z0-9-]*$/),
          label: z.string().trim().min(1).max(100),
          color: z.enum(["blue", "yellow", "green", "purple"]),
          regionCodes: z.array(z.string().trim().min(2).max(8)).min(1).max(250),
        }),
      )
      .max(12)
      .default([]),
    targets: z
      .array(
        z.object({
          regionCode: z.string().trim().min(2).max(8),
          cardId: z.uuid(),
        }),
      )
      .max(250)
      .default([]),
  }),
  z.object({
    type: z.literal("cloze"),
    text: z.string().trim().min(1).max(10_000),
    deletions: z
      .array(
        z.object({
          id: z.number().int().positive(),
          start: z.number().int().nonnegative(),
          end: z.number().int().positive(),
          hint: z.string().max(300).optional(),
        }),
      )
      .min(1),
  }),
]);

export const cardContentSchema = z.object({
  blocks: z.array(contentBlockSchema).min(1).max(200),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type CardContent = z.infer<typeof cardContentSchema>;

export const localizedCardContentsSchema = z
  .record(
    contentLocaleSchema,
    z.object({
      front: cardContentSchema,
      back: cardContentSchema,
    }),
  )
  .refine((translations) => Object.keys(translations).length <= 20, {
    message: "A card supports at most 20 content locales",
  });

export type LocalizedCardContents = z.infer<typeof localizedCardContentsSchema>;

export const resolveLocalizedCardContent = (
  card: {
    front: CardContent;
    back: CardContent;
    translations?: LocalizedCardContents;
  },
  requestedLocale: string,
  defaultLocale: string,
): { front: CardContent; back: CardContent; locale: string } => {
  const exact = card.translations?.[requestedLocale];
  if (exact) return { ...exact, locale: requestedLocale };
  const language = requestedLocale.split("-")[0]!;
  const languageMatch = Object.entries(card.translations ?? {}).find(
    ([locale]) => locale.split("-")[0] === language,
  );
  if (languageMatch) return { ...languageMatch[1], locale: languageMatch[0] };
  const fallback = card.translations?.[defaultLocale];
  if (fallback) return { ...fallback, locale: defaultLocale };
  const first = Object.entries(card.translations ?? {})[0];
  return first
    ? { ...first[1], locale: first[0] }
    : { front: card.front, back: card.back, locale: defaultLocale };
};

const forbiddenPattern =
  /<\s*\/?\s*(script|iframe|object|embed|form|style|svg)|\bon\w+\s*=|javascript:|data:text\/html|file:/i;

export const assertSafeText = (value: string): string => {
  if (forbiddenPattern.test(value)) {
    throw new Error("Executable or unsafe card content is not allowed");
  }
  return value;
};

export const validateCardContent = (input: unknown): CardContent => {
  const content = cardContentSchema.parse(input);
  for (const block of content.blocks) {
    if ("text" in block) {
      assertSafeText(block.text);
    }
    if (block.type === "formula") {
      assertSafeText(block.latex);
    }
    if (block.type === "list") {
      block.items.forEach(assertSafeText);
    }
    if ("label" in block) {
      assertSafeText(block.label);
    }
    if (block.type === "audio" && block.transcript) {
      assertSafeText(block.transcript);
    }
    if (block.type === "video" && block.captions) {
      assertSafeText(block.captions);
    }
  }
  return content;
};
