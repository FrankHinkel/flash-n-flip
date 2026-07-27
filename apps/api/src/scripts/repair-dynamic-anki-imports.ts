import { and, eq, inArray, isNull } from "drizzle-orm";

import { validateCardContent } from "@flashcards/domain/content";

import { closeDatabase, db } from "../db/client.js";
import { cards, decks } from "../db/schema.js";
import {
  compactLegacyDynamicAnkiCard,
  stripLegacyDynamicMarkers,
} from "../services/anki-repair.js";

const deckIds = process.argv
  .slice(2)
  .filter((argument) => argument.startsWith("--deck-id="))
  .map((argument) => argument.slice("--deck-id=".length))
  .filter(Boolean);

if (deckIds.length === 0) {
  throw new Error("Mindestens eine --deck-id=<UUID> ist erforderlich.");
}

try {
  const rows = await db
    .select({ card: cards })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(
      and(
        inArray(cards.deckId, deckIds),
        isNull(decks.archivedAt),
        eq(cards.suspended, false),
      ),
    );
  let repaired = 0;
  await db.transaction(async (tx) => {
    for (const { card } of rows) {
      const sourceFront = validateCardContent(card.front);
      const sourceBack = validateCardContent(card.back);
      const compact = compactLegacyDynamicAnkiCard(sourceFront, sourceBack, {
        force: true,
      });
      const repairedCard = compact ?? {
        front: stripLegacyDynamicMarkers(sourceFront),
        back: stripLegacyDynamicMarkers(sourceBack),
      };
      if (
        JSON.stringify(repairedCard.front) === JSON.stringify(sourceFront) &&
        JSON.stringify(repairedCard.back) === JSON.stringify(sourceBack)
      ) {
        continue;
      }
      await tx
        .update(cards)
        .set({
          front: repairedCard.front,
          back: repairedCard.back,
          version: card.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, card.id));
      repaired += 1;
    }
  });
  console.log(
    `Repaired ${repaired} of ${rows.length} card(s); original note fields remain unchanged.`,
  );
} finally {
  await closeDatabase();
}
