import { z } from "zod";

import { cardContentSchema } from "./content.js";
import type { CardContent, ContentBlock } from "./content.js";
import { cardStateSchema, ratingSchema } from "./index.js";
import type { CardState } from "./index.js";
import { localAuthorityExportEnvelopeSchema } from "./local-authority.js";

const instantSchema = z.string().datetime();

export const localDeckPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1_000),
    language: z.string().trim().min(2).max(16),
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();
export type LocalDeckPayload = z.infer<typeof localDeckPayloadSchema>;

export type LocalCardPayload = {
  deckId: string;
  front: CardContent;
  back: CardContent;
  position: number;
  suspended: boolean;
  state: CardState;
  createdAt: string;
  updatedAt: string;
};

export const localCardPayloadSchema: z.ZodType<LocalCardPayload> = z
  .object({
    deckId: z.uuid(),
    front: cardContentSchema,
    back: cardContentSchema,
    position: z.number().int().nonnegative(),
    suspended: z.boolean(),
    state: cardStateSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const plainLocalCardContent = (text: string): CardContent =>
  cardContentSchema.parse({
    blocks: [{ type: "markdown", revealMode: "ALL", source: text.trim() }],
  });

const richNodeText = (node: {
  text?: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
}): string => {
  if (node.text) return node.text;
  if (typeof node.attrs?.answer === "string") return node.attrs.answer;
  return (node.content ?? [])
    .map((child) => richNodeText(child as Parameters<typeof richNodeText>[0]))
    .join(" ");
};

const blockText = (block: ContentBlock): string => {
  switch (block.type) {
    case "text":
    case "heading":
      return block.text;
    case "list":
      return block.items.join(" · ");
    case "formula":
      return block.latex;
    case "image":
    case "imageOverlay":
      return block.alt;
    case "audio":
      return block.transcript || block.label;
    case "video":
      return block.captions || block.label;
    case "animation":
    case "graphic":
    case "europeMap":
    case "geographyMap":
      return block.label;
    case "cloze":
      return block.text;
    case "markdown":
      return block.source;
    case "richText":
      return block.document.content.map(richNodeText).join(" ");
  }
};

export const localCardContentPlainText = (content: CardContent): string =>
  cardContentSchema
    .parse(content)
    .blocks.map(blockText)
    .filter(Boolean)
    .join("\n");

export const localReviewPayloadSchema = z
  .object({
    reviewId: z.uuid(),
    deckId: z.uuid(),
    cardId: z.uuid(),
    reviewedAt: instantSchema,
    timezone: z.string().trim().min(1).max(100),
    rating: ratingSchema,
    schedulerVersion: z.string().trim().min(1).max(100),
    parameters: z.array(z.number()).min(1).max(64),
    before: cardStateSchema,
    after: cardStateSchema,
  })
  .strict();
export type LocalReviewPayload = z.infer<typeof localReviewPayloadSchema>;

export const localSettingsPayloadSchema = z
  .object({
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
    locale: z.string().trim().min(2).max(16),
    dailyGoal: z.number().int().min(1).max(1_000),
    updatedAt: instantSchema,
  })
  .strict();
export type LocalSettingsPayload = z.infer<typeof localSettingsPayloadSchema>;

export const localMediaReferencePayloadSchema = z
  .object({
    deckId: z.uuid(),
    cardId: z.uuid().nullable(),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    byteSize: z
      .number()
      .int()
      .nonnegative()
      .max(512 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: instantSchema,
  })
  .strict();
export type LocalMediaReferencePayload = z.infer<
  typeof localMediaReferencePayloadSchema
>;

export const localMediaBackupEntrySchema = z
  .object({
    mediaId: z.uuid(),
    mimeType: z.string().trim().min(1).max(120),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z
      .number()
      .int()
      .nonnegative()
      .max(512 * 1024 * 1024),
    dataBase64: z.string(),
  })
  .strict();
export type LocalMediaBackupEntry = z.infer<typeof localMediaBackupEntrySchema>;

export const localAppBackupEnvelopeSchema = z
  .object({
    format: z.literal("flash-n-flip-local-backup"),
    version: z.literal(1),
    exportedAt: instantSchema,
    authority: localAuthorityExportEnvelopeSchema,
    media: z.array(localMediaBackupEntrySchema).max(100_000),
  })
  .strict();
export type LocalAppBackupEnvelope = z.infer<
  typeof localAppBackupEnvelopeSchema
>;
