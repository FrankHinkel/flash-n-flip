import { describe, expect, it, vi } from "vitest";

import type { Card, DeckDetail } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";

import {
  CardSaveAfterDeckError,
  IncompleteCardDraftError,
  saveDeckWithPendingCard,
} from "./deck-editor-save";

const card = (front: string, back: string): Card => ({
  id: "card-1",
  deckId: "deck-1",
  noteId: "note-1",
  front: { blocks: [{ type: "text", text: front }] },
  back: { blocks: [{ type: "text", text: back }] },
  translations: {},
  version: 2,
  suspended: false,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
});

const deck = (question = "Old question"): DeckDetail => ({
  id: "deck-1",
  parentDeckId: null,
  title: "Test deck",
  description: "",
  language: "en",
  contentLocales: ["en"],
  defaultContentLocale: "en",
  protectionMode: "ACCOUNT_BOUND",
  tags: [],
  favorite: false,
  hiddenAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 3,
  updatedAt: "2026-07-25T00:00:00.000Z",
  cards: [card(question, "Answer")],
});

const deckInput = {
  title: "Test deck",
  description: "",
  language: "en",
  tags: [],
};

describe("saveDeckWithPendingCard", () => {
  it("persists an edited question before reporting complete success", async () => {
    const calls: string[] = [];
    const refreshed = deck("New question");
    const api = {
      updateDeck: vi.fn(async () => {
        calls.push("deck");
        return { ...deck(), version: 4 };
      }),
      updateCard: vi.fn(
        async (
          _deckId: string,
          _cardId: string,
          input: {
            front: CardContent;
            back: CardContent;
            version: number;
          },
        ) => {
          calls.push("card");
          return { ...card("New question", "Answer"), front: input.front };
        },
      ),
      createCard: vi.fn(),
      getDeck: vi.fn(async () => {
        calls.push("refresh");
        return refreshed;
      }),
    };

    const result = await saveDeckWithPendingCard(api, deck(), deckInput, {
      editing: deck().cards[0] ?? null,
      front: "New question",
      back: "Answer",
      frontChanged: true,
      backChanged: false,
    });

    expect(calls).toEqual(["deck", "card"]);
    expect(api.updateCard).toHaveBeenCalledWith(
      "deck-1",
      "card-1",
      expect.objectContaining({
        front: { blocks: [{ type: "text", text: "New question" }] },
        version: 2,
      }),
    );
    expect(result.cardAction).toBe("updated");
    expect(result.deck.cards[0]?.front).toEqual({
      blocks: [{ type: "text", text: "New question" }],
    });
    expect(api.getDeck).not.toHaveBeenCalled();
  });

  it("does not rewrite an unchanged card", async () => {
    const api = {
      updateDeck: vi.fn(async () => ({ ...deck(), version: 4 })),
      updateCard: vi.fn(),
      createCard: vi.fn(),
      getDeck: vi.fn(),
    };

    const result = await saveDeckWithPendingCard(api, deck(), deckInput, {
      editing: deck().cards[0] ?? null,
      front: "Old question",
      back: "Answer",
      frontChanged: false,
      backChanged: false,
    });

    expect(result.cardAction).toBeNull();
    expect(api.updateCard).not.toHaveBeenCalled();
    expect(api.getDeck).not.toHaveBeenCalled();
  });

  it("reports a partial save while preserving an incomplete new card", async () => {
    const api = {
      updateDeck: vi.fn(async () => ({ ...deck(), version: 4 })),
      updateCard: vi.fn(),
      createCard: vi.fn(),
      getDeck: vi.fn(),
    };

    await expect(
      saveDeckWithPendingCard(api, deck(), deckInput, {
        editing: null,
        front: "Question without an answer",
        back: "",
        frontChanged: true,
        backChanged: false,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: CardSaveAfterDeckError.name,
        cause: expect.any(IncompleteCardDraftError),
      }),
    );
    expect(api.createCard).not.toHaveBeenCalled();
  });
});
