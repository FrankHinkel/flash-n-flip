import { describe, expect, it } from "vitest";

import type { CloudDeckSyncResult } from "@flashcards/direct-connect-webstack/cloud-library-runtime";
import { sortCloudDeckResults, upsertCloudDeckResult } from "./cloud-deck-view";

const deck = (
  deckId: string,
  title: string,
  parentDeckId: string | null = null,
): CloudDeckSyncResult => ({
  deckId,
  title,
  parentDeckId,
  cardCount: 1,
  curated: false,
  localAvailable: true,
  removed: false,
  revisions: [],
  status: "synced",
});

describe("cloud deck view projection", () => {
  it("updates a deck in place instead of moving it after every sync event", () => {
    const first = deck("00000000-0000-4000-8000-000000000001", "Alpha");
    const second = deck("00000000-0000-4000-8000-000000000002", "Beta");
    const updated = { ...first, cardCount: 42 };

    expect(upsertCloudDeckResult([first, second], updated)).toEqual([
      updated,
      second,
    ]);
  });

  it("deduplicates equal deck IDs and sorts complete hierarchies deterministically", () => {
    const parent = deck("00000000-0000-4000-8000-000000000010", "Language Hub");
    const french = deck(
      "00000000-0000-4000-8000-000000000011",
      "Xefjord French",
      parent.deckId,
    );
    const german = deck(
      "00000000-0000-4000-8000-000000000012",
      "Xefjord German",
      parent.deckId,
    );

    expect(
      sortCloudDeckResults([
        german,
        { ...french, cardCount: 1 },
        parent,
        french,
      ]),
    ).toEqual([parent, french, german]);
  });
});
