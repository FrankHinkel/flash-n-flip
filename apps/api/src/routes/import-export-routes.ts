import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  createId,
  deckDescendantIds,
  resolveDeckLanguageDirection,
} from "@flashcards/domain";
import {
  ankiImportProfileSelectionSchema,
  manualAnkiFieldMappingProfileId,
  xefjordAnkiProfileId,
  type AnkiImportProfileSelection,
} from "@flashcards/domain/anki-import-profile";
import {
  contentLocaleSchema,
  localizedCardContentsSchema,
  validateCardContent,
  type CardContent,
  type ContentBlock,
} from "@flashcards/domain/content";

import { authenticate } from "../auth.js";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import {
  cards,
  cardTemplates,
  decks,
  media,
  notes,
  noteTypes,
} from "../db/schema.js";
import {
  ankiCategoryTags,
  ankiFieldRoles,
  hasPreservedAnkiLayout,
  createAnkiImportPreview,
  prepareAnkiCompatiblePackage,
  prepareAnkiFieldMappedPackage,
  suggestedAnkiFieldMappings,
  xefjordAnkiFieldMappings,
  sanitizedAnkiNoteFields,
  selectAnkiSourceDecks,
  selectedAnkiMediaNames,
  type AnkiFieldMapping,
} from "../services/anki-import-plan.js";
import { createAnkiImportHierarchy } from "../services/anki-import-hierarchy.js";
import { applyCustomAnkiImportProfile } from "../services/anki-import-profile.js";
import type {
  AnkiCardContent,
  ParsedAnkiPackage,
} from "../services/anki-package.js";
import { parseAnkiPackage } from "../services/anki-package.js";
import { optimizeImportedAudioMedia } from "../services/audio-optimizer.js";
import { createCsvExport, parseCardImport } from "../services/import-export.js";
import {
  xefjordCollectionTemplateKey,
  xefjordCollectionTitle,
} from "../services/xefjord-collection.js";
import {
  createFlashNFlipPackage,
  readFlashNFlipPackage,
  type FlashNFlipManifest,
} from "../services/fnf-package.js";
import {
  detectSupportedMedia,
  mediaSha256,
  sanitizeImportedSvg,
} from "../services/media-file.js";

const extensionForMime = (mimeType: string): string | null =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm",
  })[mimeType] ?? null;

const referencedMediaIds = (values: unknown[]): string[] => {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (
        (key === "mediaId" ||
          key === "posterMediaId" ||
          key === "baseMediaId" ||
          key === "overlayMediaId") &&
        typeof nested === "string"
      ) {
        ids.add(nested);
      } else {
        visit(nested);
      }
    }
  };
  values.forEach(visit);
  return [...ids];
};

const referencedCardIds = (values: unknown[]): string[] => {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (key === "cardId" && typeof nested === "string") ids.add(nested);
      else visit(nested);
    }
  };
  values.forEach(visit);
  return [...ids];
};

const rewritePackageReferences = (
  value: unknown,
  mediaIds: ReadonlyMap<string, string>,
  cardIds: ReadonlyMap<string, string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewritePackageReferences(item, mediaIds, cardIds),
    );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      if (
        (key === "mediaId" ||
          key === "posterMediaId" ||
          key === "baseMediaId" ||
          key === "overlayMediaId") &&
        typeof nested === "string"
      ) {
        return [key, mediaIds.get(nested) ?? nested];
      }
      if (key === "cardId" && typeof nested === "string") {
        return [key, cardIds.get(nested) ?? nested];
      }
      return [key, rewritePackageReferences(nested, mediaIds, cardIds)];
    }),
  );
};

const plainText = (content: unknown): string => {
  const parsed = z
    .object({
      blocks: z.array(z.object({ type: z.string() }).passthrough()),
    })
    .safeParse(content);
  if (!parsed.success) return "";
  return parsed.data.blocks
    .map((block) => {
      if ("text" in block && typeof block.text === "string") return block.text;
      if ("latex" in block && typeof block.latex === "string")
        return block.latex;
      if ("items" in block && Array.isArray(block.items))
        return block.items.join("\n");
      if ("label" in block && typeof block.label === "string")
        return block.label;
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

export const registerImportExportRoutes = async (
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> => {
  app.get(
    "/decks/:deckId/export",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, request.user.id)))
        .limit(1);
      if (!deck) return reply.code(404).send({ message: "Deck not found" });
      const deckCards = await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(cards.position);
      const csv = createCsvExport(
        deckCards.map((card) => ({
          front: plainText(card.front),
          back: plainText(card.back),
          tags: [],
        })),
      );
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header(
          "content-disposition",
          `attachment; filename="${deck.title.replace(/[^a-z0-9_-]+/gi, "-")}.csv"`,
        )
        .send(`\uFEFF${csv}`);
    },
  );

  app.post(
    "/decks/:deckId/export/fnf",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const ownedDecks = await db
        .select()
        .from(decks)
        .where(
          and(eq(decks.ownerId, request.user.id), isNull(decks.archivedAt)),
        );
      const deck = ownedDecks.find((item) => item.id === deckId);
      if (!deck) return reply.code(404).send({ message: "Deck not found" });
      if (deck.protectionMode !== "ACCOUNT_BOUND") {
        return reply
          .code(409)
          .send({ message: "Enable account-bound protection before export" });
      }
      const includedDeckIdSet = deckDescendantIds(ownedDecks, deckId);
      const includedDecks = ownedDecks.filter((item) =>
        includedDeckIdSet.has(item.id),
      );
      const includedDeckIds = includedDecks.map((item) => item.id);
      const deckCards = await db
        .select()
        .from(cards)
        .where(inArray(cards.deckId, includedDeckIds))
        .orderBy(cards.position);
      const noteIds = [...new Set(deckCards.map((card) => card.noteId))];
      const deckNotes = noteIds.length
        ? await db.select().from(notes).where(inArray(notes.id, noteIds))
        : [];
      const noteTypeIds = [
        ...new Set(
          deckNotes
            .map((note) => note.noteTypeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      let packageNoteTypes = noteTypeIds.length
        ? await db
            .select()
            .from(noteTypes)
            .where(
              and(
                eq(noteTypes.ownerId, request.user.id),
                inArray(noteTypes.id, noteTypeIds),
              ),
            )
        : [];
      const templateIds = [
        ...new Set(
          deckCards
            .map((card) => card.templateId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const packageTemplates = templateIds.length
        ? await db
            .select()
            .from(cardTemplates)
            .where(inArray(cardTemplates.id, templateIds))
        : [];
      const additionalNoteTypeIds = [
        ...new Set(
          packageTemplates
            .map((template) => template.noteTypeId)
            .filter(
              (id): id is string => Boolean(id) && !noteTypeIds.includes(id!),
            ),
        ),
      ];
      if (additionalNoteTypeIds.length) {
        packageNoteTypes = [
          ...packageNoteTypes,
          ...(await db
            .select()
            .from(noteTypes)
            .where(
              and(
                eq(noteTypes.ownerId, request.user.id),
                inArray(noteTypes.id, additionalNoteTypeIds),
              ),
            )),
        ];
      }
      const mediaIds = referencedMediaIds([
        ...includedDecks.map((item) => item.visual),
        ...deckCards.flatMap((card) => [
          card.front,
          card.back,
          card.translations,
        ]),
        ...deckNotes.map((note) => note.fields),
        ...packageTemplates.flatMap((template) => [
          template.front,
          template.back,
        ]),
      ]);
      for (const item of includedDecks) {
        if (item.visual?.kind === "IMAGE") mediaIds.push(item.visual.value);
      }
      const uniqueMediaIds = [...new Set(mediaIds)];
      const internalCardIds = new Set(deckCards.map((card) => card.id));
      const externalNavigationTarget = referencedCardIds(
        deckCards.flatMap((card) => [card.front, card.back, card.translations]),
      ).find((id) => !internalCardIds.has(id));
      if (externalNavigationTarget) {
        return reply.code(422).send({
          message:
            "The collection contains a card link outside the exported hierarchy",
        });
      }
      const deckMedia =
        uniqueMediaIds.length > 0
          ? await db
              .select()
              .from(media)
              .where(
                and(
                  eq(media.ownerId, request.user.id),
                  inArray(media.id, uniqueMediaIds),
                  isNull(media.deletedAt),
                ),
              )
          : [];
      if (deckMedia.length !== uniqueMediaIds.length) {
        return reply
          .code(422)
          .send({ message: "A referenced private media file is missing" });
      }
      const assets = await Promise.all(
        deckMedia.map(async (item) => {
          const data = await readFile(
            join(config.UPLOAD_DIRECTORY, basename(item.storageKey)),
          );
          return {
            sourceMediaId: item.id,
            mimeType: item.mimeType,
            sha256: mediaSha256(data),
            altText: item.altText,
            data: data.toString("base64"),
          };
        }),
      );
      const packageId = createId();
      const output = await createFlashNFlipPackage(
        {
          format: "flash-n-flip.collection",
          formatVersion: 2,
          packageId,
          exportedAt: new Date().toISOString(),
          rootSourceDeckId: deck.id,
          decks: includedDecks.map((item) => ({
            sourceDeckId: item.id,
            sourceParentDeckId: includedDeckIdSet.has(item.parentDeckId ?? "")
              ? item.parentDeckId
              : null,
            title: item.title,
            description: item.description,
            language: item.language,
            contentLocales: item.contentLocales,
            defaultContentLocale: item.defaultContentLocale,
            sourceLocale: item.sourceLocale,
            targetLocale: item.targetLocale,
            studyOrder:
              item.studyOrder === "SEQUENTIAL" ? "SEQUENTIAL" : "SCHEDULED",
            protectionMode: "ACCOUNT_BOUND",
            tags: item.tags,
            visual: item.visual,
          })),
          noteTypes: packageNoteTypes.map((noteType) => ({
            sourceNoteTypeId: noteType.id,
            name: noteType.name,
            fields: noteType.fields,
          })),
          cardTemplates: packageTemplates.map((template) => ({
            sourceTemplateId: template.id,
            sourceNoteTypeId: template.noteTypeId,
            name: template.name,
            front: template.front,
            back: template.back,
          })),
          notes: deckNotes.map((note) => ({
            sourceNoteId: note.id,
            sourceDeckId: includedDeckIdSet.has(note.deckId)
              ? note.deckId
              : deckCards.find((card) => card.noteId === note.id)!.deckId,
            sourceNoteTypeId: note.noteTypeId,
            fields: note.fields,
            tags: note.tags,
          })),
          cards: deckCards.map((card) => ({
            sourceCardId: card.id,
            sourceDeckId: card.deckId,
            sourceNoteId: card.noteId,
            sourceTemplateId: card.templateId,
            front: card.front as CardContent,
            back: card.back as CardContent,
            questionLocale: card.questionLocale,
            answerLocale: card.answerLocale,
            translations: card.translations,
            kind: card.kind === "EXPLANATION" ? "EXPLANATION" : "QUESTION",
            position: card.position,
            linkedToPrevious: card.linkedToPrevious,
            suspended: card.suspended,
          })),
          assets,
        },
        request.user.id,
        config.FNF_DECK_MASTER_SECRET,
      );
      if (output.length > config.FNF_MAX_PACKAGE_BYTES) {
        return reply
          .code(413)
          .send({ message: "Flash-n-Flip package is too large" });
      }
      return reply
        .header("content-type", "application/vnd.flash-n-flip.package")
        .header(
          "content-disposition",
          `attachment; filename="${deck.title.replace(/[^a-z0-9_-]+/gi, "-")}.fnf"`,
        )
        .send(output);
    },
  );

  app.post("/imports", { preHandler: authenticate }, async (request, reply) => {
    const input = z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).default(""),
        language: z.string().trim().min(2).max(16).default("en"),
        sourceLocale: contentLocaleSchema.optional(),
        targetLocale: contentLocaleSchema.optional(),
        format: z.enum(["CSV", "ANKI_TSV"]),
        content: z.string().min(1).max(5_000_000),
      })
      .parse(request.body);
    const languageDirection = resolveDeckLanguageDirection({
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      fallbackLocale: input.language,
    });
    const imported = parseCardImport(input.content, input.format);
    if (!imported.length)
      return reply.code(400).send({ message: "Import is empty" });
    const deckId = createId();
    await db.transaction(async (tx) => {
      await tx.insert(decks).values({
        id: deckId,
        ownerId: request.user.id,
        title: input.title,
        description: input.description,
        language: languageDirection.targetLocale,
        contentLocales: [languageDirection.targetLocale],
        defaultContentLocale: languageDirection.targetLocale,
        ...languageDirection,
        protectionMode: "ACCOUNT_BOUND",
        tags: input.format === "ANKI_TSV" ? ["Anki Import"] : ["CSV Import"],
      });
      for (const [index, importedCard] of imported.entries()) {
        const noteId = createId();
        const front = {
          blocks: [{ type: "text" as const, text: importedCard.front }],
        };
        const back = {
          blocks: [{ type: "text" as const, text: importedCard.back }],
        };
        await tx.insert(notes).values({
          id: noteId,
          deckId,
          fields: { front, back },
          tags: importedCard.tags,
        });
        await tx.insert(cards).values({
          id: createId(),
          deckId,
          noteId,
          front,
          back,
          position: index + 1,
        });
      }
    });
    return reply.code(201).send({ deckId, importedCards: imported.length });
  });

  app.post(
    "/imports/fnf",
    { preHandler: authenticate },
    async (request, reply) => {
      const file = await request.file({
        limits: { fileSize: config.FNF_MAX_PACKAGE_BYTES, files: 1 },
      });
      if (!file || !file.filename.toLowerCase().endsWith(".fnf")) {
        return reply.code(415).send({ message: "Please select a .fnf file" });
      }
      const packageBuffer = await file.toBuffer();
      let manifest: FlashNFlipManifest;
      try {
        manifest = await readFlashNFlipPackage(
          packageBuffer,
          request.user.id,
          config.FNF_DECK_MASTER_SECRET,
        );
      } catch (cause) {
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "The Flash-n-Flip package is invalid",
        });
      }
      const totalAssetBytes = manifest.assets.reduce(
        (sum, asset) => sum + Buffer.byteLength(asset.data, "base64"),
        0,
      );
      if (totalAssetBytes > config.FNF_MAX_PACKAGE_BYTES) {
        return reply.code(413).send({ message: "Deck media is too large" });
      }
      const packageMediaIds = new Set(
        manifest.assets.map((asset) => asset.sourceMediaId),
      );
      const referencedPackageMediaIds = referencedMediaIds([
        ...manifest.decks.map((deck) => deck.visual),
        ...manifest.notes.map((note) => note.fields),
        ...manifest.cardTemplates.flatMap((template) => [
          template.front,
          template.back,
        ]),
        ...manifest.cards.flatMap((card) => [
          card.front,
          card.back,
          card.translations,
        ]),
      ]);
      for (const deck of manifest.decks) {
        if (deck.visual?.kind === "IMAGE") {
          referencedPackageMediaIds.push(deck.visual.value);
        }
      }
      if (referencedPackageMediaIds.some((id) => !packageMediaIds.has(id))) {
        return reply
          .code(422)
          .send({ message: "Flash-n-Flip package references missing media" });
      }
      const packageCardIds = new Set(
        manifest.cards.map((card) => card.sourceCardId),
      );
      if (
        referencedCardIds(
          manifest.cards.flatMap((card) => [
            card.front,
            card.back,
            card.translations,
          ]),
        ).some((id) => !packageCardIds.has(id))
      ) {
        return reply
          .code(422)
          .send({ message: "Flash-n-Flip package references a missing card" });
      }
      const deckIds = new Map(
        manifest.decks.map((deck) => [deck.sourceDeckId, createId()]),
      );
      const noteTypeIds = new Map(
        manifest.noteTypes.map((noteType) => [
          noteType.sourceNoteTypeId,
          createId(),
        ]),
      );
      const templateIds = new Map(
        manifest.cardTemplates.map((template) => [
          template.sourceTemplateId,
          createId(),
        ]),
      );
      const noteIds = new Map(
        manifest.notes.map((note) => [note.sourceNoteId, createId()]),
      );
      const cardIds = new Map(
        manifest.cards.map((card) => [card.sourceCardId, createId()]),
      );
      const mediaIds = new Map<string, string>();
      const orderedDecks: typeof manifest.decks = [];
      const remainingDecks = new Map(
        manifest.decks.map((deck) => [deck.sourceDeckId, deck]),
      );
      while (remainingDecks.size) {
        const ready = [...remainingDecks.values()].filter(
          (deck) =>
            !deck.sourceParentDeckId ||
            orderedDecks.some(
              (parent) => parent.sourceDeckId === deck.sourceParentDeckId,
            ),
        );
        if (!ready.length) {
          return reply.code(422).send({
            message: "Flash-n-Flip package contains a cyclic hierarchy",
          });
        }
        for (const deck of ready) {
          orderedDecks.push(deck);
          remainingDecks.delete(deck.sourceDeckId);
        }
      }
      const newlyWrittenFiles: string[] = [];
      await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
      try {
        await db.transaction(async (tx) => {
          for (const asset of manifest.assets) {
            const extension = extensionForMime(asset.mimeType);
            const data = Buffer.from(asset.data, "base64");
            if (!extension || mediaSha256(data) !== asset.sha256) {
              throw new Error("Flash-n-Flip package contains invalid media");
            }
            const detected =
              asset.mimeType === "image/svg+xml"
                ? null
                : detectSupportedMedia(data, `asset.${extension}`);
            if (
              asset.mimeType !== "image/svg+xml" &&
              detected?.mimeType !== asset.mimeType
            ) {
              throw new Error(
                "Flash-n-Flip package contains media with a mismatched type",
              );
            }
            const safeData =
              asset.mimeType === "image/svg+xml"
                ? sanitizeImportedSvg(data)
                : data;
            if (!safeData) {
              throw new Error(
                "Flash-n-Flip package contains an unsafe SVG image",
              );
            }
            const safeSha256 = mediaSha256(safeData);
            const [existing] = await tx
              .select()
              .from(media)
              .where(
                and(
                  eq(media.ownerId, request.user.id),
                  eq(media.sha256, safeSha256),
                  isNull(media.deletedAt),
                ),
              )
              .limit(1);
            if (existing) {
              mediaIds.set(asset.sourceMediaId, existing.id);
              continue;
            }
            const id = createId();
            const storageKey = `${id}.${extension}`;
            const storagePath = join(config.UPLOAD_DIRECTORY, storageKey);
            await writeFile(storagePath, safeData, {
              flag: "wx",
              mode: 0o600,
            });
            newlyWrittenFiles.push(storagePath);
            await tx.insert(media).values({
              id,
              ownerId: request.user.id,
              storageKey,
              sha256: safeSha256,
              mimeType: asset.mimeType,
              byteSize: safeData.length,
              altText: asset.altText,
            });
            mediaIds.set(asset.sourceMediaId, id);
          }
          for (const sourceNoteType of manifest.noteTypes) {
            await tx.insert(noteTypes).values({
              id: noteTypeIds.get(sourceNoteType.sourceNoteTypeId)!,
              ownerId: request.user.id,
              name: sourceNoteType.name,
              fields: sourceNoteType.fields,
            });
          }
          for (const sourceTemplate of manifest.cardTemplates) {
            await tx.insert(cardTemplates).values({
              id: templateIds.get(sourceTemplate.sourceTemplateId)!,
              noteTypeId: sourceTemplate.sourceNoteTypeId
                ? noteTypeIds.get(sourceTemplate.sourceNoteTypeId)!
                : null,
              name: sourceTemplate.name,
              front: rewritePackageReferences(
                sourceTemplate.front,
                mediaIds,
                cardIds,
              ) as Record<string, unknown>,
              back: rewritePackageReferences(
                sourceTemplate.back,
                mediaIds,
                cardIds,
              ) as Record<string, unknown>,
            });
          }
          for (const sourceDeck of orderedDecks) {
            const languageDirection = resolveDeckLanguageDirection({
              sourceLocale: sourceDeck.sourceLocale,
              targetLocale: sourceDeck.targetLocale,
              fallbackLocale: sourceDeck.defaultContentLocale,
            });
            await tx.insert(decks).values({
              id: deckIds.get(sourceDeck.sourceDeckId)!,
              ownerId: request.user.id,
              parentDeckId: sourceDeck.sourceParentDeckId
                ? deckIds.get(sourceDeck.sourceParentDeckId)!
                : null,
              title: sourceDeck.title,
              description: sourceDeck.description,
              language: sourceDeck.language,
              contentLocales: sourceDeck.contentLocales,
              defaultContentLocale: sourceDeck.defaultContentLocale,
              ...languageDirection,
              studyOrder: sourceDeck.studyOrder,
              protectionMode: "ACCOUNT_BOUND",
              tags: sourceDeck.tags,
              visual:
                sourceDeck.visual?.kind === "IMAGE"
                  ? {
                      ...sourceDeck.visual,
                      value: mediaIds.get(sourceDeck.visual.value)!,
                    }
                  : sourceDeck.visual,
            });
          }
          for (const sourceNote of manifest.notes) {
            await tx.insert(notes).values({
              id: noteIds.get(sourceNote.sourceNoteId)!,
              deckId: deckIds.get(sourceNote.sourceDeckId)!,
              noteTypeId: sourceNote.sourceNoteTypeId
                ? noteTypeIds.get(sourceNote.sourceNoteTypeId)!
                : null,
              fields: rewritePackageReferences(
                sourceNote.fields,
                mediaIds,
                cardIds,
              ) as Record<string, unknown>,
              tags: sourceNote.tags,
            });
          }
          for (const sourceCard of manifest.cards) {
            const front = validateCardContent(
              rewritePackageReferences(sourceCard.front, mediaIds, cardIds),
            );
            const back = validateCardContent(
              rewritePackageReferences(sourceCard.back, mediaIds, cardIds),
            );
            const translations = localizedCardContentsSchema.parse(
              rewritePackageReferences(
                sourceCard.translations,
                mediaIds,
                cardIds,
              ),
            );
            await tx.insert(cards).values({
              id: cardIds.get(sourceCard.sourceCardId)!,
              deckId: deckIds.get(sourceCard.sourceDeckId)!,
              noteId: noteIds.get(sourceCard.sourceNoteId)!,
              templateId: sourceCard.sourceTemplateId
                ? templateIds.get(sourceCard.sourceTemplateId)!
                : null,
              front,
              back,
              questionLocale: sourceCard.questionLocale,
              answerLocale: sourceCard.answerLocale,
              translations,
              kind: sourceCard.kind,
              position: sourceCard.position,
              linkedToPrevious: sourceCard.linkedToPrevious,
              suspended: sourceCard.suspended,
            });
          }
        });
      } catch (cause) {
        await Promise.all(
          newlyWrittenFiles.map((filePath) =>
            unlink(filePath).catch(() => undefined),
          ),
        );
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "The Flash-n-Flip package could not be imported",
        });
      }
      const deckId = deckIds.get(manifest.rootSourceDeckId)!;
      return reply.code(201).send({
        deckId,
        importedDecks: manifest.decks.length,
        importedCards: manifest.cards.length,
        importedMedia: manifest.assets.length,
        formatVersion: 2,
      });
    },
  );

  const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
  const languageDirectionSchema = z.object({
    sourceLocale: contentLocaleSchema,
    targetLocale: contentLocaleSchema.optional(),
  });
  const fieldMappingsSchema = z.record(
    z.string().min(1).max(80),
    z.record(z.string().min(1).max(120), z.enum(ankiFieldRoles)),
  );
  const subdeckFieldsSchema = z.record(
    z.string().min(1).max(80),
    z.array(z.string().min(1).max(120)).max(4),
  );
  const cachePath = (userId: string, sha256: string) =>
    join(config.UPLOAD_DIRECTORY, "apkg-cache", userId, `${sha256}.apkg`);
  const cacheExists = async (userId: string, sha256: string) => {
    const path = cachePath(userId, sha256);
    try {
      const details = await stat(path);
      if (Date.now() - details.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        await unlink(path).catch(() => undefined);
        return false;
      }
      return details.isFile();
    } catch {
      return false;
    }
  };
  const cachedArchive = async (userId: string, sha256: string) => {
    const path = cachePath(userId, sha256);
    if (!(await cacheExists(userId, sha256)))
      throw new Error(
        "Das Anki-Paket ist nicht mehr im privaten Import-Cache.",
      );
    const archive = await readFile(path);
    if (createHash("sha256").update(archive).digest("hex") !== sha256) {
      await unlink(path).catch(() => undefined);
      throw new Error(
        "Der lokale Import-Cache war beschädigt und wurde entfernt.",
      );
    }
    return archive;
  };
  const parseArchive = async (archive: Buffer, fileName: string) => {
    if (
      archive.length < 4 ||
      archive.length > config.APKG_MAX_UPLOAD_BYTES ||
      archive[0] !== 0x50 ||
      archive[1] !== 0x4b
    ) {
      throw new Error("Ungültiges Anki-Paket.");
    }
    return parseAnkiPackage(archive, {
      maximumMediaBytes: config.MAX_UPLOAD_BYTES,
      fileName,
    });
  };

  const persistAnkiPackage = async (input: {
    parsed: ParsedAnkiPackage;
    userId: string;
    languageDirection: { sourceLocale: string; targetLocale: string };
    mappings: Record<string, AnkiFieldMapping>;
    subdeckFields: Record<string, string[]>;
    includedSourceDeckIds: string[];
    includedMediaGroupIds: string[];
    coverSourceName?: string;
    flattenHierarchy?: boolean;
    groupXefjordCollection?: boolean;
    profileSelection?: AnkiImportProfileSelection;
    sha256: string;
    fileName: string;
    reply: FastifyReply;
  }) => {
    selectAnkiSourceDecks(input.parsed, input.includedSourceDeckIds);
    const usesManualFieldMapping =
      input.profileSelection?.kind === "BUILT_IN" &&
      input.profileSelection.profileId === manualAnkiFieldMappingProfileId;
    let languageDetection = {
      detectedCards: 0,
      removedMarkers: 0,
      directions: {} as Record<string, number>,
    };
    const parsed =
      input.profileSelection?.kind === "CUSTOM"
        ? applyCustomAnkiImportProfile(
            input.parsed,
            input.profileSelection.profile,
            input.languageDirection,
          )
        : (() => {
            const detection = usesManualFieldMapping
              ? prepareAnkiFieldMappedPackage(
                  input.parsed,
                  input.mappings,
                  input.languageDirection,
                )
              : prepareAnkiCompatiblePackage(
                  input.parsed,
                  input.languageDirection,
                );
            languageDetection = detection;
            return detection.package;
          })();
    const preview = createAnkiImportPreview(parsed, {
      sha256: input.sha256,
      fileName: input.fileName,
      cached: true,
    });
    const selectedMedia = selectedAnkiMediaNames(
      parsed,
      preview,
      input.includedMediaGroupIds,
      input.coverSourceName,
    );
    parsed.media = parsed.media.filter((item) =>
      selectedMedia.has(item.sourceName),
    );
    const audioOptimization = await optimizeImportedAudioMedia(
      parsed.media.filter(
        (item): item is typeof item & { kind: "audio" } =>
          item.kind === "audio",
      ),
    );
    const optimizedAudioBySourceName = new Map(
      audioOptimization.media.map((item) => [item.sourceName, item]),
    );
    parsed.media = parsed.media.flatMap((item) => {
      if (item.kind === "image") return [item];
      const optimized = optimizedAudioBySourceName.get(item.sourceName);
      return optimized ? [optimized] : [];
    });
    parsed.warnings.push(...audioOptimization.warnings);
    await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
    const newlyWrittenFiles: string[] = [];
    const mediaIds = new Map<string, string>();
    const hierarchy = createAnkiImportHierarchy(
      parsed.collectionTitle,
      parsed.decks,
      input.subdeckFields,
      { flatten: input.flattenHierarchy },
    );
    const hierarchyIds = new Map(
      hierarchy.nodes.map((node) => [node.key, createId()]),
    );
    const collectionDeckId = hierarchyIds.get(hierarchy.collectionKey)!;
    const deckIds = [
      ...new Set(
        parsed.decks.flatMap((deck) => {
          const sourceDeckKey = hierarchy.nodeKeyBySourceDeckId.get(
            deck.sourceDeckId,
          )!;
          const targetKeys = deck.cards.map(
            (card) => hierarchy.nodeKeyByCard.get(card) ?? sourceDeckKey,
          );
          return (targetKeys.length ? targetKeys : [sourceDeckKey]).map((key) =>
            hierarchyIds.get(key)!,
          );
        }),
      ),
    ];
    const noteTypeIds = new Map(
      parsed.noteTypes.map((noteType) => [
        noteType.sourceNoteTypeId,
        createId(),
      ]),
    );
    const templateIds = new Map<string, string>();
    for (const noteType of parsed.noteTypes) {
      for (const template of noteType.templates) {
        templateIds.set(
          `${noteType.sourceNoteTypeId}:${template.ord}`,
          createId(),
        );
      }
    }
    let importedCards = 0;
    const materializeContent = (
      content: AnkiCardContent,
      fallback = true,
    ): CardContent => {
      const blocks: ContentBlock[] = [];
      for (const block of content.blocks) {
        if (block.type === "imageOverlay") {
          const baseMediaId = mediaIds.get(block.baseSourceName);
          const overlayMediaId = mediaIds.get(block.overlaySourceName);
          if (!baseMediaId || !overlayMediaId) continue;
          const {
            baseSourceName: _baseSourceName,
            overlaySourceName: _overlaySourceName,
            ...safeBlock
          } = block;
          blocks.push({ ...safeBlock, baseMediaId, overlayMediaId });
          continue;
        }
        if (!("sourceName" in block)) {
          blocks.push(block);
          continue;
        }
        const mediaId = mediaIds.get(block.sourceName);
        if (!mediaId) continue;
        if (block.type === "importImage") {
          blocks.push({
            type: "image",
            mediaId,
            alt: block.alt,
            decorative: block.decorative,
          });
        } else if (block.type === "importAudio") {
          blocks.push({
            type: "audio",
            mediaId,
            label: block.label,
            ...(block.transcript ? { transcript: block.transcript } : {}),
          });
        } else {
          const { sourceName: _sourceName, ...safeBlock } = block;
          blocks.push({ ...safeBlock, mediaId });
        }
      }
      return {
        blocks:
          blocks.length || !fallback
            ? blocks
            : [{ type: "text", text: "Medium wurde nicht mit importiert." }],
      };
    };

    try {
      await db.transaction(async (tx) => {
        for (const importedMedia of parsed.media) {
          const sha256 = mediaSha256(importedMedia.data);
          const [existing] = await tx
            .select()
            .from(media)
            .where(
              and(
                eq(media.ownerId, input.userId),
                eq(media.sha256, sha256),
                isNull(media.deletedAt),
              ),
            )
            .limit(1);
          if (existing) {
            mediaIds.set(importedMedia.sourceName, existing.id);
            continue;
          }
          const id = createId();
          const storageKey = `${id}.${importedMedia.extension}`;
          const storagePath = join(config.UPLOAD_DIRECTORY, storageKey);
          await writeFile(storagePath, importedMedia.data, {
            flag: "wx",
            mode: 0o600,
          });
          newlyWrittenFiles.push(storagePath);
          await tx.insert(media).values({
            id,
            ownerId: input.userId,
            storageKey,
            sha256,
            mimeType: importedMedia.mimeType,
            byteSize: importedMedia.data.length,
            altText: importedMedia.sourceName,
          });
          mediaIds.set(importedMedia.sourceName, id);
        }

        for (const noteType of parsed.noteTypes) {
          const noteTypeId = noteTypeIds.get(noteType.sourceNoteTypeId)!;
          await tx.insert(noteTypes).values({
            id: noteTypeId,
            ownerId: input.userId,
            name: `Anki · ${noteType.name}`.slice(0, 120),
            fields: noteType.fields.map((label, index) => ({
              key: `field_${index}`,
              label: label.slice(0, 120),
            })),
          });
          for (const template of noteType.templates) {
            const mapping = input.mappings[noteType.sourceNoteTypeId] ?? {};
            const profileTemplate = template.profileTemplate;
            await tx.insert(cardTemplates).values({
              id: templateIds.get(
                `${noteType.sourceNoteTypeId}:${template.ord}`,
              )!,
              noteTypeId,
              name: template.name.slice(0, 120),
              front: profileTemplate
                ? {
                    format: "ANKI_IMPORT_PROFILE_V1",
                    templateOrd: template.ord,
                    profileId: profileTemplate.profileId,
                    profileVersion: profileTemplate.profileVersion,
                    outputId: profileTemplate.outputId,
                    source: profileTemplate.frontTemplate,
                  }
                : {
                    format: "ANKI_SAFE_MAPPING_V1",
                    templateOrd: template.ord,
                    questionFields: template.questionFields,
                    fieldRoles: mapping,
                  },
              back: profileTemplate
                ? {
                    format: "ANKI_IMPORT_PROFILE_V1",
                    templateOrd: template.ord,
                    profileId: profileTemplate.profileId,
                    profileVersion: profileTemplate.profileVersion,
                    outputId: profileTemplate.outputId,
                    source: profileTemplate.backTemplate,
                  }
                : {
                    format: "ANKI_SAFE_MAPPING_V1",
                    templateOrd: template.ord,
                    answerFields: template.answerFields,
                    fieldRoles: mapping,
                  },
            });
          }
        }

        for (const node of hierarchy.nodes) {
          const isCollectionRoot = node.key === hierarchy.collectionKey;
          const coverMediaId = input.coverSourceName
            ? mediaIds.get(input.coverSourceName)
            : undefined;
          await tx.insert(decks).values({
            id: hierarchyIds.get(node.key)!,
            ownerId: input.userId,
            parentDeckId: node.parentKey
              ? hierarchyIds.get(node.parentKey)!
              : null,
            title: node.title,
            description: isCollectionRoot
              ? "Aus einem Anki-Paket importiert. Originalfelder und sichere Kartenvorlagen wurden erhalten."
              : node.sourceFieldName
                ? `Aus dem Anki-Feld „${node.sourceFieldName}“ erzeugt.`
                : "Aus einem Anki-Paket importiert. Der Lernfortschritt startet in Flash-n-Flip neu.",
            language: input.languageDirection.targetLocale,
            contentLocales: [input.languageDirection.targetLocale],
            defaultContentLocale: input.languageDirection.targetLocale,
            ...input.languageDirection,
            protectionMode: "ACCOUNT_BOUND",
            tags: isCollectionRoot
              ? ["Anki Import", "Collection"]
              : ["Anki Import"],
            visual:
              isCollectionRoot && coverMediaId
                ? { kind: "IMAGE", value: coverMediaId }
                : null,
          });
        }

        if (input.groupXefjordCollection) {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`xefjord:${input.userId}`}))`,
          );
          const [existingCollection] = await tx
            .select({ id: decks.id })
            .from(decks)
            .where(
              and(
                eq(decks.ownerId, input.userId),
                eq(decks.sourceTemplateKey, xefjordCollectionTemplateKey),
                isNull(decks.archivedAt),
              ),
            )
            .limit(1);
          const ungroupedLanguageDecks = await tx
            .select({ id: decks.id })
            .from(decks)
            .where(
              and(
                eq(decks.ownerId, input.userId),
                isNull(decks.parentDeckId),
                isNull(decks.archivedAt),
                sql`${decks.title} ~* '^Xefjord[''’]s Complete[[:space:]]+'`,
                sql`${decks.tags} @> '["Anki Import"]'::jsonb`,
              ),
            );
          let sharedCollectionId = existingCollection?.id;
          if (!sharedCollectionId && ungroupedLanguageDecks.length >= 2) {
            sharedCollectionId = createId();
            await tx.insert(decks).values({
              id: sharedCollectionId,
              ownerId: input.userId,
              title: xefjordCollectionTitle,
              description:
                "Gemeinsame Collection der importierten Xefjord-Sprachdecks.",
              language: "en",
              contentLocales: ["en"],
              defaultContentLocale: "en",
              sourceLocale: "en",
              targetLocale: "en",
              protectionMode: "ACCOUNT_BOUND",
              tags: ["Anki Import", "Collection", "Xefjord"],
              sourceTemplateKey: xefjordCollectionTemplateKey,
            });
          }
          if (sharedCollectionId && ungroupedLanguageDecks.length) {
            await tx
              .update(decks)
              .set({
                parentDeckId: sharedCollectionId,
                updatedAt: new Date(),
                version: sql`${decks.version} + 1`,
              })
              .where(
                inArray(
                  decks.id,
                  ungroupedLanguageDecks.map(({ id }) => id),
                ),
              );
          }
        }

        for (const importedDeck of parsed.decks) {
          const nodeKey = hierarchy.nodeKeyBySourceDeckId.get(
            importedDeck.sourceDeckId,
          )!;
          const noteIds = new Map<string, string>();
          const positionsByDeck = new Map<string, number>();
          const sourceCardsByNote = new Map<
            string,
            typeof importedDeck.cards
          >();
          for (const sourceCard of importedDeck.cards) {
            const related =
              sourceCardsByNote.get(sourceCard.sourceNoteId) ?? [];
            related.push(sourceCard);
            sourceCardsByNote.set(sourceCard.sourceNoteId, related);
          }
          const noteValues: Array<typeof notes.$inferInsert> = [];
          const cardValues: Array<typeof cards.$inferInsert> = [];
          for (const importedCard of importedDeck.cards) {
            const deckId = hierarchyIds.get(
              hierarchy.nodeKeyByCard.get(importedCard) ?? nodeKey,
            )!;
            let noteId = noteIds.get(importedCard.sourceNoteId);
            const front = materializeContent(importedCard.front);
            const back = materializeContent(importedCard.back);
            if (!noteId) {
              noteId = createId();
              noteIds.set(importedCard.sourceNoteId, noteId);
              const noteType = parsed.noteTypes.find(
                (item) =>
                  item.sourceNoteTypeId === importedCard.sourceNoteTypeId,
              );
              noteValues.push({
                id: noteId,
                deckId,
                noteTypeId: noteTypeIds.get(
                  importedCard.sourceNoteTypeId ?? "",
                ),
                fields: sanitizedAnkiNoteFields(
                  importedCard,
                  noteType?.fields ?? [],
                  (content) => materializeContent(content, false),
                  sourceCardsByNote.get(importedCard.sourceNoteId) ?? [
                    importedCard,
                  ],
                ),
                tags: ankiCategoryTags(
                  importedCard,
                  input.mappings[importedCard.sourceNoteTypeId ?? ""],
                ),
              });
            }
            cardValues.push({
              id: createId(),
              deckId,
              noteId,
              templateId: templateIds.get(
                `${importedCard.sourceNoteTypeId}:${importedCard.sourceTemplateOrd}`,
              ),
              front,
              back,
              questionLocale: importedCard.questionLocale,
              answerLocale: importedCard.answerLocale,
              position: (positionsByDeck.get(deckId) ?? 0) + 1,
              linkedToPrevious: importedCard.linkedToPrevious ?? false,
              suspended: importedCard.sourceState?.queue === -1,
            });
            positionsByDeck.set(deckId, (positionsByDeck.get(deckId) ?? 0) + 1);
          }
          for (let offset = 0; offset < noteValues.length; offset += 500)
            await tx
              .insert(notes)
              .values(noteValues.slice(offset, offset + 500));
          for (let offset = 0; offset < cardValues.length; offset += 500)
            await tx
              .insert(cards)
              .values(cardValues.slice(offset, offset + 500));
          importedCards += cardValues.length;
        }
      });
    } catch (cause) {
      await Promise.all(
        newlyWrittenFiles.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );
      throw cause;
    }
    return input.reply.code(201).send({
      deckIds,
      primaryDeckId: deckIds[0],
      collectionDeckId,
      collectionTitle: parsed.collectionTitle,
      importedDecks: hierarchy.nodes.length - 1,
      importedCards,
      importedMedia: mediaIds.size,
      detectedLanguageCards: languageDetection.detectedCards,
      removedLanguageMarkers: languageDetection.removedMarkers,
      detectedDirections: languageDetection.directions,
      warnings: parsed.warnings,
      audioOptimization: audioOptimization.stats,
      packageVersion: parsed.packageVersion,
      schedulingImported: false,
    });
  };

  app.get(
    "/imports/apkg/cache/:sha256",
    { preHandler: authenticate },
    async (request) => {
      const { sha256 } = z
        .object({ sha256: sha256Schema })
        .parse(request.params);
      const cached = await cacheExists(request.user.id, sha256);
      return { cached };
    },
  );

  app.get(
    "/imports/apkg/preview/:sha256",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sha256 } = z
        .object({ sha256: sha256Schema })
        .parse(request.params);
      const { fileName } = z
        .object({ fileName: z.string().trim().min(1).max(255) })
        .parse(request.query);
      try {
        const archive = await cachedArchive(request.user.id, sha256);
        const parsed = await parseArchive(archive, fileName);
        return createAnkiImportPreview(parsed, {
          sha256,
          fileName,
          cached: true,
        });
      } catch (cause) {
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "Das Anki-Paket konnte nicht analysiert werden.",
        });
      }
    },
  );

  app.post(
    "/imports/apkg/preview",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sha256 } = z
        .object({ sha256: sha256Schema })
        .parse(request.query);
      const file = await request.file({
        limits: { fileSize: config.APKG_MAX_UPLOAD_BYTES, files: 1 },
      });
      if (!file || !file.filename.toLowerCase().endsWith(".apkg"))
        return reply
          .code(415)
          .send({ message: "Bitte eine .apkg-Datei auswählen." });
      const archive = await file.toBuffer();
      if (createHash("sha256").update(archive).digest("hex") !== sha256)
        return reply
          .code(422)
          .send({ message: "Die Datei-Prüfsumme stimmt nicht überein." });
      try {
        const parsed = await parseArchive(archive, file.filename);
        const directory = join(
          config.UPLOAD_DIRECTORY,
          "apkg-cache",
          request.user.id,
        );
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(cachePath(request.user.id, sha256), archive, {
          flag: "wx",
          mode: 0o600,
        }).catch((cause: NodeJS.ErrnoException) => {
          if (cause.code !== "EEXIST") throw cause;
        });
        return createAnkiImportPreview(parsed, {
          sha256,
          fileName: file.filename,
          cached: false,
        });
      } catch (cause) {
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "Das Anki-Paket konnte nicht analysiert werden.",
        });
      }
    },
  );

  app.post(
    "/imports/apkg/commit",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = z
        .object({
          sha256: sha256Schema,
          fileName: z.string().trim().min(1).max(255),
          ...languageDirectionSchema.shape,
          mappings: fieldMappingsSchema,
          subdeckFields: subdeckFieldsSchema.optional().default({}),
          includedSourceDeckIds: z
            .array(z.string().min(1).max(120))
            .max(50_000)
            .optional(),
          includedMediaGroupIds: z.array(z.string().min(1).max(240)).max(500),
          coverSourceName: z.string().min(1).max(255).optional(),
          profileSelection: ankiImportProfileSelectionSchema.optional(),
        })
        .parse(request.body);
      let languageDirection = resolveDeckLanguageDirection({
        sourceLocale: body.sourceLocale,
        targetLocale: body.targetLocale,
        fallbackLocale: "en",
      });
      try {
        const archive = await cachedArchive(request.user.id, body.sha256);
        const parsed = await parseArchive(archive, body.fileName);
        const preview = createAnkiImportPreview(parsed, {
          sha256: body.sha256,
          fileName: body.fileName,
          cached: true,
        });
        const builtInXefjord =
          body.profileSelection?.kind === "BUILT_IN" &&
          body.profileSelection.profileId === xefjordAnkiProfileId;
        const usesManualFieldMapping =
          body.profileSelection?.kind === "BUILT_IN" &&
          body.profileSelection.profileId ===
            manualAnkiFieldMappingProfileId;
        if (builtInXefjord) {
          const preset = preview.xefjordPreset;
          if (
            !preset.detected ||
            !preset.directImportAvailable ||
            !preset.suggestedSourceLocale ||
            !preset.suggestedTargetLocale
          ) {
            return reply.code(422).send({
              message: preset.detected
                ? "Die Zielsprache dieses Xefjord-Pakets konnte nicht sicher bestimmt werden. Bitte verwende ein eigenes oder das Standardprofil."
                : "Dieses Paket passt nicht zum Xefjord-Systemprofil.",
            });
          }
          languageDirection = {
            sourceLocale: preset.suggestedSourceLocale,
            targetLocale: preset.suggestedTargetLocale,
          };
        }
        const allowedNoteTypes = new Set(
          preview.noteTypes.map((item) => item.sourceNoteTypeId),
        );
        const availableSourceDeckIds = new Set(
          preview.sourceHierarchy.decks.map((deck) => deck.sourceDeckId),
        );
        const includedSourceDeckIds = body.includedSourceDeckIds ?? [
          ...availableSourceDeckIds,
        ];
        if (
          includedSourceDeckIds.length === 0 ||
          new Set(includedSourceDeckIds).size !==
            includedSourceDeckIds.length ||
          includedSourceDeckIds.some((id) => !availableSourceDeckIds.has(id))
        )
          return reply
            .code(422)
            .send({ message: "Ungültige Anki-Stapelauswahl." });
        const selectedCardCount = preview.sourceHierarchy.decks
          .filter((deck) => includedSourceDeckIds.includes(deck.sourceDeckId))
          .reduce((sum, deck) => sum + deck.cardCount, 0);
        if (selectedCardCount === 0)
          return reply.code(422).send({
            message: "Die ausgewählten Anki-Stapel enthalten keine Karten.",
          });
        if (Object.keys(body.mappings).some((id) => !allowedNoteTypes.has(id)))
          return reply.code(422).send({ message: "Ungültige Feldzuordnung." });
        if (
          Object.keys(body.subdeckFields).some(
            (id) => !allowedNoteTypes.has(id),
          )
        )
          return reply
            .code(422)
            .send({ message: "Ungültige Unterdeck-Auswahl." });
        for (const noteType of preview.noteTypes) {
          const selectedFields =
            body.subdeckFields[noteType.sourceNoteTypeId] ?? [];
          const allowedFields = new Set(
            noteType.fields.map((field) => field.name),
          );
          if (
            new Set(selectedFields).size !== selectedFields.length ||
            selectedFields.some((field) => !allowedFields.has(field))
          )
            return reply
              .code(422)
              .send({ message: "Ungültige Unterdeck-Auswahl." });
        }
        for (const noteType of preview.noteTypes) {
          if (builtInXefjord) continue;
          if (hasPreservedAnkiLayout(noteType)) continue;
          if (
            body.profileSelection?.kind === "CUSTOM" ||
            !usesManualFieldMapping
          ) {
            continue;
          }
          const mapping = body.mappings[noteType.sourceNoteTypeId] ?? {};
          const allowedFields = new Set(
            noteType.fields.map((field) => field.name),
          );
          if (
            Object.keys(mapping).length !== allowedFields.size ||
            Object.keys(mapping).some((field) => !allowedFields.has(field))
          ) {
            return reply.code(422).send({
              message: `Die Feldzuordnung für „${noteType.name}“ ist unvollständig oder enthält unbekannte Felder. Bitte analysiere das Paket erneut.`,
            });
          }
          const roles = Object.values(mapping);
          const primaryACount = roles.filter(
            (role) => role === "PRIMARY_A",
          ).length;
          const primaryBCount = roles.filter(
            (role) => role === "PRIMARY_B",
          ).length;
          if (primaryACount + primaryBCount < 1) {
            return reply.code(422).send({
              message: `Für „${noteType.name}“ muss mindestens eine Hauptseite A oder B zugeordnet sein.`,
            });
          }
        }
        const allowedGroups = new Set(
          preview.mediaGroups.map((item) => item.id),
        );
        if (body.includedMediaGroupIds.some((id) => !allowedGroups.has(id)))
          return reply.code(422).send({ message: "Ungültige Medienauswahl." });
        return persistAnkiPackage({
          parsed,
          userId: request.user.id,
          languageDirection,
          mappings: builtInXefjord
            ? xefjordAnkiFieldMappings(preview)
            : body.mappings,
          subdeckFields: body.subdeckFields,
          includedSourceDeckIds,
          includedMediaGroupIds: body.includedMediaGroupIds,
          coverSourceName: body.coverSourceName,
          flattenHierarchy: builtInXefjord,
          groupXefjordCollection: builtInXefjord,
          profileSelection: body.profileSelection,
          sha256: body.sha256,
          fileName: body.fileName,
          reply,
        });
      } catch (cause) {
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "Der Anki-Import konnte nicht abgeschlossen werden.",
        });
      }
    },
  );
};
