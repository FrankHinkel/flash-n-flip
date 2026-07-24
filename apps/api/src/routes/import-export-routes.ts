import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";
import type { CardContent, ContentBlock } from "@flashcards/domain/content";

import { authenticate } from "../auth.js";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import { cards, decks, media, notes } from "../db/schema.js";
import type { AnkiCardContent } from "../services/anki-package.js";
import { parseAnkiPackage } from "../services/anki-package.js";
import { createCsvExport, parseCardImport } from "../services/import-export.js";
import { mediaSha256 } from "../services/media-file.js";

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
        .where(eq(cards.deckId, deckId));
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
        tags: input.format === "ANKI_TSV" ? ["Anki Import"] : ["CSV Import"],
      });
      for (const importedCard of imported) {
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
        });
      }
    });
    return reply.code(201).send({ deckId, importedCards: imported.length });
  });

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
      const deckIds: string[] = [];
      let importedCards = 0;

      const materializeContent = (content: AnkiCardContent): CardContent => {
        const blocks: ContentBlock[] = [];
        for (const block of content.blocks) {
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

          for (const importedDeck of parsed.decks) {
            const deckId = createId();
            deckIds.push(deckId);
            await tx.insert(decks).values({
              id: deckId,
              ownerId: request.user.id,
              title: importedDeck.title,
              description:
                "Imported from an Anki package. Learning progress starts fresh in Flash & Flip.",
              language: "de",
              tags: ["Anki Import"],
            });

            const noteIds = new Map<string, string>();
            const noteValues: Array<typeof notes.$inferInsert> = [];
            const cardValues: Array<typeof cards.$inferInsert> = [];
            for (const importedCard of importedDeck.cards) {
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
        importedDecks: deckIds.length,
        importedCards,
        importedMedia: mediaIds.size,
        warnings: parsed.warnings,
        packageVersion: parsed.packageVersion,
        schedulingImported: false,
      });
    },
  );
};
