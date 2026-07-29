import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";
import {
  localizedCardContentsSchema,
  validateCardContent,
  type CardContent,
  type ContentBlock,
} from "@flashcards/domain/content";

import { authenticate } from "../auth.js";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import { cards, decks, media, notes } from "../db/schema.js";
import { createAnkiImportHierarchy } from "../services/anki-import-hierarchy.js";
import type { AnkiCardContent } from "../services/anki-package.js";
import { parseAnkiPackage } from "../services/anki-package.js";
import { createCsvExport, parseCardImport } from "../services/import-export.js";
import {
  createFlashNFlipPackage,
  readFlashNFlipPackage,
} from "../services/fnf-package.js";
import { mediaSha256, sanitizeImportedSvg } from "../services/media-file.js";

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
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, request.user.id)))
        .limit(1);
      if (!deck) return reply.code(404).send({ message: "Deck not found" });
      if (deck.protectionMode !== "ACCOUNT_BOUND") {
        return reply
          .code(409)
          .send({ message: "Enable account-bound protection before export" });
      }
      const deckCards = await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(cards.position);
      const deckNotes = await db
        .select({ id: notes.id, tags: notes.tags })
        .from(notes)
        .where(eq(notes.deckId, deckId));
      const tagsByNote = new Map(deckNotes.map((note) => [note.id, note.tags]));
      const mediaIds = referencedMediaIds(
        deckCards.flatMap((card) => [card.front, card.back, card.translations]),
      );
      const deckMedia =
        mediaIds.length > 0
          ? await db
              .select()
              .from(media)
              .where(
                and(
                  eq(media.ownerId, request.user.id),
                  inArray(media.id, mediaIds),
                  isNull(media.deletedAt),
                ),
              )
          : [];
      if (deckMedia.length !== mediaIds.length) {
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
      const output = createFlashNFlipPackage(
        {
          format: "flash-n-flip.deck",
          formatVersion: 1,
          packageId,
          exportedAt: new Date().toISOString(),
          deck: {
            title: deck.title,
            description: deck.description,
            language: deck.language,
            contentLocales: deck.contentLocales,
            defaultContentLocale: deck.defaultContentLocale,
            studyOrder:
              deck.studyOrder === "SEQUENTIAL" ? "SEQUENTIAL" : "SCHEDULED",
            protectionMode: "ACCOUNT_BOUND",
            tags: deck.tags,
          },
          cards: deckCards.map((card) => ({
            sourceCardId: card.id,
            front: card.front as CardContent,
            back: card.back as CardContent,
            translations: card.translations,
            kind: card.kind === "EXPLANATION" ? "EXPLANATION" : "QUESTION",
            position: card.position,
            linkedToPrevious: card.linkedToPrevious,
            tags: tagsByNote.get(card.noteId) ?? [],
          })),
          assets,
        },
        request.user.id,
        config.FNF_DECK_MASTER_SECRET,
      );
      if (output.length > config.FNF_MAX_PACKAGE_BYTES) {
        return reply.code(413).send({ message: "Deck package is too large" });
      }
      return reply
        .header("content-type", "application/vnd.flash-n-flip.deck")
        .header(
          "content-disposition",
          `attachment; filename="${deck.title.replace(/[^a-z0-9_-]+/gi, "-")}.fnfdeck"`,
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
        format: z.enum(["CSV", "ANKI_TSV"]),
        content: z.string().min(1).max(5_000_000),
      })
      .parse(request.body);
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
        language: input.language,
        contentLocales: [input.language],
        defaultContentLocale: input.language,
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
      if (!file || !file.filename.toLowerCase().endsWith(".fnfdeck")) {
        return reply
          .code(415)
          .send({ message: "Please select a .fnfdeck file" });
      }
      const packageBuffer = await file.toBuffer();
      let manifest;
      try {
        manifest = readFlashNFlipPackage(
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
      const deckId = createId();
      const cardIds = new Map(
        manifest.cards.map((card) => [card.sourceCardId, createId()]),
      );
      const mediaIds = new Map<string, string>();
      const newlyWrittenFiles: string[] = [];
      await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
      try {
        await db.transaction(async (tx) => {
          for (const asset of manifest.assets) {
            const extension = extensionForMime(asset.mimeType);
            const data = Buffer.from(asset.data, "base64");
            if (!extension || mediaSha256(data) !== asset.sha256) {
              throw new Error("Deck package contains invalid media");
            }
            const safeData =
              asset.mimeType === "image/svg+xml"
                ? sanitizeImportedSvg(data)
                : data;
            if (!safeData) {
              throw new Error("Deck package contains an unsafe SVG image");
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
          await tx.insert(decks).values({
            id: deckId,
            ownerId: request.user.id,
            ...manifest.deck,
          });
          for (const [index, sourceCard] of manifest.cards.entries()) {
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
            const noteId = createId();
            await tx.insert(notes).values({
              id: noteId,
              deckId,
              fields: { front, back, translations },
              tags: sourceCard.tags,
            });
            await tx.insert(cards).values({
              id: cardIds.get(sourceCard.sourceCardId)!,
              deckId,
              noteId,
              front,
              back,
              translations,
              kind: sourceCard.kind,
              position: index + 1,
              linkedToPrevious: sourceCard.linkedToPrevious,
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
      return reply.code(201).send({
        deckId,
        importedCards: manifest.cards.length,
        importedMedia: manifest.assets.length,
        formatVersion: 1,
      });
    },
  );

  app.post(
    "/imports/apkg",
    { preHandler: authenticate },
    async (request, reply) => {
      const file = await request.file({
        limits: { fileSize: config.APKG_MAX_UPLOAD_BYTES, files: 1 },
      });
      if (!file || !file.filename.toLowerCase().endsWith(".apkg")) {
        return reply
          .code(415)
          .send({ message: "Bitte eine .apkg-Datei auswählen." });
      }
      const archive = await file.toBuffer();
      if (
        archive.length < 4 ||
        archive.length > config.APKG_MAX_UPLOAD_BYTES ||
        archive[0] !== 0x50 ||
        archive[1] !== 0x4b
      ) {
        return reply.code(422).send({ message: "Ungültiges Anki-Paket." });
      }

      let parsed;
      try {
        parsed = await parseAnkiPackage(archive, {
          maximumMediaBytes: config.MAX_UPLOAD_BYTES,
          fileName: file.filename,
        });
      } catch (cause) {
        return reply.code(422).send({
          message:
            cause instanceof Error
              ? cause.message
              : "Das Anki-Paket konnte nicht gelesen werden.",
        });
      }

      await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
      const newlyWrittenFiles: string[] = [];
      const mediaIds = new Map<string, string>();
      const hierarchy = createAnkiImportHierarchy(
        parsed.collectionTitle,
        parsed.decks,
      );
      const hierarchyIds = new Map(
        hierarchy.nodes.map((node) => [node.key, createId()]),
      );
      const collectionDeckId = hierarchyIds.get(hierarchy.collectionKey)!;
      const deckIds = [
        ...new Set(
          parsed.decks.map((deck) =>
            hierarchyIds.get(
              hierarchy.nodeKeyBySourceDeckId.get(deck.sourceDeckId)!,
            )!,
          ),
        ),
      ];
      let importedCards = 0;

      const materializeContent = (content: AnkiCardContent): CardContent => {
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
          const { sourceName: _sourceName, ...safeBlock } = block;
          blocks.push({ ...safeBlock, mediaId });
        }
        return {
          blocks:
            blocks.length > 0
              ? blocks
              : [
                  {
                    type: "text",
                    text: "Medium konnte nicht importiert werden.",
                  },
                ],
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
                  eq(media.ownerId, request.user.id),
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
              ownerId: request.user.id,
              storageKey,
              sha256,
              mimeType: importedMedia.mimeType,
              byteSize: importedMedia.data.length,
              altText: importedMedia.sourceName,
            });
            mediaIds.set(importedMedia.sourceName, id);
          }

          for (const node of hierarchy.nodes) {
            const isCollectionRoot = node.key === hierarchy.collectionKey;
            await tx.insert(decks).values({
              id: hierarchyIds.get(node.key)!,
              ownerId: request.user.id,
              parentDeckId: node.parentKey
                ? hierarchyIds.get(node.parentKey)!
                : null,
              title: node.title,
              description: isCollectionRoot
                ? "Imported from one Anki package. Delete this collection to remove the complete import."
                : "Imported from an Anki package. Learning progress starts fresh in Flash-n-Flip.",
              language: "en",
              contentLocales: ["en"],
              defaultContentLocale: "en",
              protectionMode: "ACCOUNT_BOUND",
              tags: isCollectionRoot
                ? ["Anki Import", "Collection"]
                : ["Anki Import"],
            });
          }

          for (const importedDeck of parsed.decks) {
            const nodeKey = hierarchy.nodeKeyBySourceDeckId.get(
              importedDeck.sourceDeckId,
            )!;
            const deckId = hierarchyIds.get(nodeKey)!;

            const noteIds = new Map<string, string>();
            const noteValues: Array<typeof notes.$inferInsert> = [];
            const cardValues: Array<typeof cards.$inferInsert> = [];
            for (const [index, importedCard] of importedDeck.cards.entries()) {
              let noteId = noteIds.get(importedCard.sourceNoteId);
              const front = materializeContent(importedCard.front);
              const back = materializeContent(importedCard.back);
              if (!noteId) {
                noteId = createId();
                noteIds.set(importedCard.sourceNoteId, noteId);
                noteValues.push({
                  id: noteId,
                  deckId,
                  fields: { front, back },
                  tags: importedCard.tags,
                });
              }
              cardValues.push({
                id: createId(),
                deckId,
                noteId,
                front,
                back,
                position: index + 1,
              });
            }
            for (let offset = 0; offset < noteValues.length; offset += 500) {
              await tx
                .insert(notes)
                .values(noteValues.slice(offset, offset + 500));
            }
            for (let offset = 0; offset < cardValues.length; offset += 500) {
              await tx
                .insert(cards)
                .values(cardValues.slice(offset, offset + 500));
            }
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

      return reply.code(201).send({
        deckIds,
        primaryDeckId: deckIds[0],
        collectionDeckId,
        collectionTitle: parsed.collectionTitle,
        importedDecks: parsed.decks.length,
        importedCards,
        importedMedia: mediaIds.size,
        warnings: parsed.warnings,
        packageVersion: parsed.packageVersion,
        schedulingImported: false,
      });
    },
  );
};
