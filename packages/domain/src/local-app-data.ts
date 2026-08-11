import { z } from "zod";

import { cardContentSchema, localizedCardContentsSchema } from "./content.js";
import type {
  CardContent,
  ContentBlock,
  LocalizedCardContents,
} from "./content.js";
import {
  cardKindSchema,
  cardStateSchema,
  deckStudyOrderSchema,
  deckSummarySchema,
  ratingSchema,
} from "./index.js";
import type { CardState } from "./index.js";
import { localAuthorityExportEnvelopeSchema } from "./local-authority.js";

const instantSchema = z.string().datetime();

export const localDeckPayloadSchema = deckSummarySchema
  .omit({
    id: true,
    version: true,
    cardCount: true,
    reviewedCardCount: true,
    storageBytes: true,
  })
  .extend({
    parentDeckId: z.uuid().nullable().default(null),
    contentLocales: z
      .array(z.string().trim().min(2).max(16))
      .min(1)
      .max(20)
      .default(["de"]),
    defaultContentLocale: z.string().trim().min(2).max(16).default("de"),
    sourceLocale: z.string().trim().min(2).max(16).default("de"),
    targetLocale: z.string().trim().min(2).max(16).default("de"),
    studyOrder: deckStudyOrderSchema.default("SCHEDULED"),
    protectionMode: z
      .enum(["STANDARD", "ACCOUNT_BOUND"])
      .default("ACCOUNT_BOUND"),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    favorite: z.boolean().default(false),
    hiddenAt: instantSchema.nullable().default(null),
    archivedAt: instantSchema.nullable().default(null),
    visual: deckSummarySchema.shape.visual.default(null),
    sourceTemplateKey: z.string().nullable().default(null),
    createdAt: instantSchema,
  })
  .strict();
export type LocalDeckPayload = z.infer<typeof localDeckPayloadSchema>;

export type LocalCardPayload = {
  deckId: string;
  noteId?: string;
  tags: string[];
  importSource?: {
    kind: "ANKI";
    sourceCardId?: string;
    sourceNoteId: string;
    sourceNoteTypeId?: string;
    sourceNoteTypeName?: string;
    sourceTemplateOrd?: number;
    sourceClozeOrdinal?: number;
    sourceTemplateName?: string;
    sourceFieldText: Record<string, string>;
    sourceState?: {
      cardType: number;
      queue: number;
      cardFlag: number;
      noteFlag: number;
    };
  };
  front: CardContent;
  back: CardContent;
  questionLocale?: string | null;
  answerLocale?: string | null;
  translations: LocalizedCardContents;
  kind: "QUESTION" | "EXPLANATION";
  linkedToPrevious: boolean;
  position: number;
  suspended: boolean;
  state: CardState;
  createdAt: string;
  updatedAt: string;
};

export const localCardPayloadSchema: z.ZodType<LocalCardPayload> = z
  .object({
    deckId: z.uuid(),
    noteId: z.uuid().optional(),
    tags: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
    importSource: z
      .object({
        kind: z.literal("ANKI"),
        sourceCardId: z.string().trim().min(1).max(200).optional(),
        sourceNoteId: z.string().trim().min(1).max(200),
        sourceNoteTypeId: z.string().trim().min(1).max(200).optional(),
        sourceNoteTypeName: z.string().trim().min(1).max(200).optional(),
        sourceTemplateOrd: z.number().int().nonnegative().optional(),
        sourceClozeOrdinal: z.number().int().nonnegative().optional(),
        sourceTemplateName: z.string().trim().min(1).max(200).optional(),
        sourceFieldText: z
          .record(z.string().trim().min(1).max(200), z.string().max(1_000_000))
          .default({}),
        sourceState: z
          .object({
            cardType: z.number().int(),
            queue: z.number().int(),
            cardFlag: z.number().int(),
            noteFlag: z.number().int(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    front: cardContentSchema,
    back: cardContentSchema,
    questionLocale: z.string().trim().min(2).max(16).nullable().optional(),
    answerLocale: z.string().trim().min(2).max(16).nullable().optional(),
    translations: localizedCardContentsSchema.default({}),
    kind: cardKindSchema.default("QUESTION"),
    linkedToPrevious: z.boolean().default(false),
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
    virtualCard: z
      .object({
        kind: z.literal("XEFJORD_CROSS_LANGUAGE_V1"),
        questionDeckId: z.uuid(),
        answerDeckId: z.uuid(),
        matchKey: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .optional(),
  })
  .strict();
export type LocalReviewPayload = z.infer<typeof localReviewPayloadSchema>;

export const localSettingsPayloadSchema = z
  .object({
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
    locale: z.string().trim().min(2).max(16),
    dailyGoal: z.number().int().min(1).max(1_000),
    pagePinchZoom: z.boolean().default(false),
    textToSpeechMode: z
      .enum(["off", "sentence", "sentence-and-choices"])
      .default("sentence-and-choices"),
    showQuestionWithAnswer: z.boolean().default(true),
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
