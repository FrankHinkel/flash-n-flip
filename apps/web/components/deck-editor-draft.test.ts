import { describe, expect, it } from "vitest";

import type { Card, DeckDetail } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";

import {
  buildDeckEditorCardCommit,
  stageCardDeletion,
  stageCardDraft,
} from "./deck-editor-draft";

const content = (text: string): CardContent => ({
  blocks: [{ type: "text", text }],
});
const card = (id: string, position: number): Card =>
  ({
    id,
    deckId: "019fdc00-0000-7000-8000-000000000001",
    noteId: `019fdc00-0000-7000-8000-0000000000${position + 10}`,
    front: content(`Question ${position}`),
    back: content(`Answer ${position}`),
    translations: {},
    kind: "QUESTION",
    position,
    linkedToPrevious: false,
    version: 1,
    suspended: false,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  }) as Card;
const deck = (cards: Card[]): DeckDetail =>
  ({ id: "019fdc00-0000-7000-8000-000000000001", cards }) as DeckDetail;

describe("deck editor draft", () => {
  it("stages an update without mutating the baseline deck", () => {
    const original = card("019fdc00-0000-7000-8000-000000000021", 1);
    const baseline = deck([original]);
    const result = stageCardDraft(baseline, {
      editing: original,
      front: content("Changed question"),
      back: original.back,
      frontChanged: true,
      backChanged: false,
    });

    expect(baseline.cards[0]!.front).toEqual(content("Question 1"));
    expect(result.deck.cards[0]!.front).toEqual(content("Changed question"));
    expect(
      buildDeckEditorCardCommit(baseline.cards, result.deck.cards),
    ).toMatchObject({
      changed: true,
      createdCards: [],
      deletedCards: [],
      updatedCards: [{ id: original.id, version: 1 }],
    });
  });

  it("stages deletion and reordering until the final commit", () => {
    const first = card("019fdc00-0000-7000-8000-000000000021", 1);
    const second = card("019fdc00-0000-7000-8000-000000000022", 2);
    const baseline = deck([first, second]);
    const deleted = stageCardDeletion(baseline, first);

    expect(baseline.cards).toEqual([first, second]);
    expect(
      buildDeckEditorCardCommit(baseline.cards, deleted.cards),
    ).toMatchObject({
      changed: true,
      cardIds: [second.id],
      deletedCards: [{ id: first.id, version: 1 }],
    });
  });
});
