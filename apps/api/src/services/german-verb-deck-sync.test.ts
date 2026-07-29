import { describe, expect, it } from "vitest";

import { createGermanVerbDeckSeeds } from "./german-verb-deck.js";
import {
  germanVerbCardTag,
  planGermanVerbCardSync,
} from "./german-verb-deck-sync.js";

describe("German verb template card synchronization", () => {
  const seed = createGermanVerbDeckSeeds().find(
    (candidate) => candidate.title === "Konjugation",
  )!;

  it("reuses legacy card and note IDs by authored position", () => {
    const existing = seed.cards.map((_, index) => ({
      cardId: `card-${index}`,
      noteId: `note-${index}`,
      position: index + 1,
      tags: [],
    }));

    const plan = planGermanVerbCardSync(seed, existing);

    expect(plan).toHaveLength(seed.cards.length);
    expect(plan.map((entry) => entry.existing?.cardId)).toEqual(
      existing.map((card) => card.cardId),
    );
    expect(new Set(plan.map((entry) => entry.existing?.cardId)).size).toBe(
      seed.cards.length,
    );
  });

  it("is idempotent after template tags have been backfilled", () => {
    const first = planGermanVerbCardSync(
      seed,
      seed.cards.map((card, index) => ({
        cardId: `card-${index}`,
        noteId: `note-${index}`,
        position: index + 1,
        tags: [],
      })),
    );
    const tagged = first.map((entry) => ({
      cardId: entry.existing!.cardId,
      noteId: entry.existing!.noteId,
      position: entry.position,
      tags: [entry.tag],
    }));
    const second = planGermanVerbCardSync(seed, tagged);

    expect(second.map((entry) => entry.existing?.cardId)).toEqual(
      first.map((entry) => entry.existing?.cardId),
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
