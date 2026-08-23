import { z } from "zod";

import {
  cardContentSchema,
  localizedCardContentsSchema,
  type CardContent,
  type LocalizedCardContents,
} from "@flashcards/domain/content";
import { contentStyleDefinitionsSchema } from "@flashcards/domain/content-style";

export const fnfV3MimeType =
  "application/vnd.flash-n-flip.package+zip;version=3" as const;
export const fnfV3ContainerMediaType =
  "application/vnd.flash-n-flip.package+zip" as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const instantSchema = z.string().datetime();

export const fnfV3EntrySchema = z
  .object({
    path: z.string().min(1).max(512),
    mediaType: z.string().min(1).max(120),
    byteSize: z.number().int().nonnegative(),
    sha256: sha256Schema,
  })
  .strict();

export const fnfV3ManifestSchema = z
  .object({
    format: z.literal("flash-n-flip.package"),
    formatVersion: z.literal(3),
    packageId: z.uuid(),
    lineageId: z.uuid(),
    createdAt: instantSchema,
    generator: z
      .object({
        name: z.string().trim().min(1).max(80),
        version: z.string().trim().min(1).max(40),
      })
      .strict(),
    profile: z.enum(["CONTENT_ONLY", "CONTENT_AND_PROGRESS"]),
    requiredFeatures: z.array(z.string().min(1).max(120)).max(100),
    optionalFeatures: z.array(z.string().min(1).max(120)).max(100),
    roots: z.array(z.uuid()).min(1).max(10_000),
    entries: z.array(fnfV3EntrySchema).min(4).max(100_000),
  })
  .strict()
  .superRefine((manifest, context) => {
    const features = [
      ...manifest.requiredFeatures,
      ...manifest.optionalFeatures,
    ];
    if (new Set(features).size !== features.length) {
      context.addIssue({
        code: "custom",
        path: ["optionalFeatures"],
        message: "FNF feature names must be unique",
      });
    }
    const paths = manifest.entries.map((entry) => entry.path.normalize("NFC"));
    if (new Set(paths).size !== paths.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "FNF entry paths must be unique",
      });
    }
    if (
      manifest.profile === "CONTENT_ONLY" &&
      paths.some((path) => path.startsWith("progress/"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Content-only packages cannot contain learning progress",
      });
    }
  });

const fnfV3VisualSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("IMAGE"), value: z.uuid() }).strict(),
    z
      .object({
        kind: z.literal("MAP"),
        value: z.string().trim().min(1).max(120),
      })
      .strict(),
    z
      .object({
        kind: z.literal("FLAG"),
        value: z.string().regex(/^[A-Z]{2}$/),
      })
      .strict(),
    z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }).strict(),
  ])
  .nullable();

export const fnfV3DeckSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(10_000),
    language: z.string().trim().min(2).max(16),
    contentLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
    defaultContentLocale: z.string().trim().min(2).max(16),
    sourceLocale: z.string().trim().min(2).max(16),
    targetLocale: z.string().trim().min(2).max(16),
    languageDirectionMode: z.enum(["OVERRIDE", "INHERIT"]),
    sourceLocaleOverride: z.string().trim().min(2).max(16).nullable(),
    targetLocaleOverride: z.string().trim().min(2).max(16).nullable(),
    studyOrder: z.enum(["SCHEDULED", "SEQUENTIAL"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    visual: fnfV3VisualSchema,
    sourceTemplateKey: z.string().max(200).nullable(),
    contentStyles: contentStyleDefinitionsSchema,
  })
  .strict();

export const fnfV3NoteSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
  })
  .strict();

const supplementalContentSchema = z
  .array(
    z
      .object({
        label: z.string().trim().min(1).max(200),
        content: cardContentSchema,
      })
      .strict(),
  )
  .max(200);

export type FnfV3Card = {
  schemaVersion: 1;
  id: string;
  deckId: string;
  noteId: string;
  position: number;
  front: CardContent;
  back: CardContent;
  supplementalContent: Array<{ label: string; content: CardContent }>;
  tags: string[];
  questionLocale?: string | null;
  answerLocale?: string | null;
  languageDirectionMode?: "DECK_DEFAULT" | "DECK_REVERSED" | "CUSTOM";
  linkedToPrevious: boolean;
  ratingEnabled: boolean;
  translations: LocalizedCardContents;
  kind: "QUESTION" | "EXPLANATION";
  suspended: boolean;
};

export const fnfV3CardSchema: z.ZodType<FnfV3Card> = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    deckId: z.uuid(),
    noteId: z.uuid(),
    position: z.number().int().nonnegative(),
    front: cardContentSchema,
    back: cardContentSchema,
    supplementalContent: supplementalContentSchema,
    tags: z.array(z.string().trim().min(1).max(200)).max(200),
    questionLocale: z.string().trim().min(2).max(16).nullable().optional(),
    answerLocale: z.string().trim().min(2).max(16).nullable().optional(),
    languageDirectionMode: z
      .enum(["DECK_DEFAULT", "DECK_REVERSED", "CUSTOM"])
      .optional(),
    linkedToPrevious: z.boolean(),
    ratingEnabled: z.boolean().default(true),
    translations: localizedCardContentsSchema,
    kind: z.enum(["QUESTION", "EXPLANATION"]),
    suspended: z.boolean(),
  })
  .strict();

export const fnfV3MediaSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    path: z.string().regex(/^media\/sha256\/[a-f0-9]{64}$/),
    fileName: z.string().trim().min(1).max(255).nullable(),
    mimeType: z.string().trim().min(1).max(120),
    byteSize: z.number().int().positive(),
    sha256: sha256Schema,
  })
  .strict()
  .superRefine((media, context) => {
    if (media.path !== `media/sha256/${media.sha256}`) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "FNF media path must match its SHA-256 digest",
      });
    }
  });

export type FnfV3Manifest = z.infer<typeof fnfV3ManifestSchema>;
export type FnfV3Entry = z.infer<typeof fnfV3EntrySchema>;
export type FnfV3Deck = z.infer<typeof fnfV3DeckSchema>;
export type FnfV3Note = z.infer<typeof fnfV3NoteSchema>;
export type FnfV3Media = z.infer<typeof fnfV3MediaSchema>;

export const parseFnfV3JsonLines = <T>(
  source: string,
  schema: z.ZodType<T>,
  label: string,
): T[] => {
  const lines = source.split("\n");
  const result: T[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let candidate: unknown;
    try {
      candidate = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`${label} contains invalid JSON on line ${index + 1}`);
    }
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`${label} is invalid on line ${index + 1}`);
    }
    result.push(parsed.data);
  }
  return result;
};

export const stringifyFnfV3JsonLines = (records: readonly unknown[]): string =>
  records.map((record) => JSON.stringify(record)).join("\n") + "\n";

export const validateFnfV3ContentReferences = (input: {
  manifest: FnfV3Manifest;
  decks: readonly FnfV3Deck[];
  notes: readonly FnfV3Note[];
  cards: readonly FnfV3Card[];
  media: readonly FnfV3Media[];
}): void => {
  const unique = (values: readonly string[], label: string) => {
    if (new Set(values).size !== values.length) {
      throw new Error(`FNF package contains duplicate ${label} IDs`);
    }
  };
  unique(
    input.decks.map((item) => item.id),
    "deck",
  );
  unique(
    input.notes.map((item) => item.id),
    "note",
  );
  unique(
    input.cards.map((item) => item.id),
    "card",
  );
  unique(
    input.media.map((item) => item.id),
    "media",
  );

  const deckIds = new Set(input.decks.map((item) => item.id));
  const noteIds = new Set(input.notes.map((item) => item.id));
  for (const root of input.manifest.roots) {
    if (!deckIds.has(root)) throw new Error("FNF package root deck is missing");
  }
  for (const deck of input.decks) {
    if (deck.parentId && !deckIds.has(deck.parentId)) {
      throw new Error("FNF package deck parent is missing");
    }
    const visited = new Set<string>([deck.id]);
    let parentId = deck.parentId;
    while (parentId) {
      if (visited.has(parentId))
        throw new Error("FNF deck hierarchy is cyclic");
      visited.add(parentId);
      parentId =
        input.decks.find((candidate) => candidate.id === parentId)?.parentId ??
        null;
    }
  }
  for (const card of input.cards) {
    if (!deckIds.has(card.deckId)) throw new Error("FNF card deck is missing");
    if (!noteIds.has(card.noteId)) throw new Error("FNF card note is missing");
  }
  const mediaIds = new Set(input.media.map((item) => item.id));
  const referencedMediaIds = (content: z.infer<typeof cardContentSchema>) =>
    content.blocks.flatMap((block) => {
      if (
        block.type === "image" ||
        block.type === "audio" ||
        block.type === "video"
      ) {
        return [
          block.mediaId,
          ...(block.type === "video" && block.posterMediaId
            ? [block.posterMediaId]
            : []),
        ];
      }
      return block.type === "imageOverlay"
        ? [block.baseMediaId, block.overlayMediaId]
        : [];
    });
  for (const deck of input.decks) {
    if (deck.visual?.kind === "IMAGE" && !mediaIds.has(deck.visual.value)) {
      throw new Error("FNF deck image is missing");
    }
  }
  for (const card of input.cards) {
    const contents = [
      card.front,
      card.back,
      ...card.supplementalContent.map((item) => item.content),
      ...Object.values(card.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ];
    for (const content of contents) {
      for (const mediaId of referencedMediaIds(content)) {
        if (!mediaIds.has(mediaId))
          throw new Error("FNF card media is missing");
      }
    }
  }
};
