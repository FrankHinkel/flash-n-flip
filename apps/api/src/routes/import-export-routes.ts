import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import { cards, decks, notes } from "../db/schema.js";
import { createCsvExport, parseCardImport } from "../services/import-export.js";

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
        language: z.string().trim().min(2).max(16).default("de"),
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
};
