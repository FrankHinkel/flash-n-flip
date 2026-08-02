import { describe, expect, it } from "vitest";

import { createGermanVerbDeckSeeds } from "./german-verb-deck.js";
import {
  germanVerbCardTag,
  planGermanVerbCardSync,
} from "./german-verb-deck-sync.js";

describe("German verb template card synchronization", () => {
  const seed = createGermanVerbDeckSeeds().find(
    (candidate) => candidate.title === "Präsens",
  )!;

  it("adds the introduction without shifting legacy verb IDs or progress", () => {
    const legacyCards = seed.cards.filter(
      (card) => card.legacyPosition !== undefined,
    );
    const existing = legacyCards.map((card) => ({
      cardId: `card-${card.legacyPosition}`,
      noteId: `note-${card.legacyPosition}`,
      position: card.legacyPosition!,
      tags: [],
    }));

    const plan = planGermanVerbCardSync(seed, existing);

    expect(plan).toHaveLength(seed.cards.length);
    expect(plan[0]).toMatchObject({
      seed: { key: "introduction" },
      existing: null,
      position: 1,
    });
    expect(plan.slice(1).map((entry) => entry.existing?.cardId)).toEqual(
      existing.map((card) => card.cardId),
    );
  });

  it("is idempotent after template tags have been backfilled", () => {
    const first = planGermanVerbCardSync(
      seed,
      seed.cards
        .filter((card) => card.legacyPosition !== undefined)
        .map((card) => ({
          cardId: `card-${card.legacyPosition}`,
          noteId: `note-${card.legacyPosition}`,
          position: card.legacyPosition!,
          tags: [],
        })),
    );
    const tagged = first.map((entry) => ({
      cardId: entry.existing?.cardId ?? entry.seed.id,
      noteId: entry.existing?.noteId ?? entry.seed.noteId,
      position: entry.position,
      tags: [entry.tag],
    }));
    const second = planGermanVerbCardSync(seed, tagged);

    expect(second.map((entry) => entry.existing?.cardId)).toEqual(
      tagged.map((card) => card.cardId),
    );
    expect(second.every((entry) => entry.existing !== null)).toBe(true);
  });

  it("adds only missing template cards and leaves unrelated cards unmatched", () => {
    const firstCard = seed.cards[0]!;
    const existing = [
      {
        cardId: "known-card",
        noteId: "known-note",
        position: 7,
        tags: [germanVerbCardTag(seed.key, firstCard.key)],
      },
    ];

    const plan = planGermanVerbCardSync(seed, existing);

    expect(plan[0]?.existing?.cardId).toBe("known-card");
    expect(plan.slice(1).every((entry) => entry.existing === null)).toBe(true);
  });
});
