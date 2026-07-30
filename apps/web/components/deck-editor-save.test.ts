import { describe, expect, it, vi } from "vitest";

import type { Card, DeckDetail } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";

import {
  CardSaveAfterDeckError,
  defaultLinkForNewCard,
  IncompleteCardDraftError,
  markdownEditorKey,
  saveCardDraft,
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

describe("card structure", () => {
  const empty = content("");
  const cloze: CardContent = {
    blocks: [
      {
        type: "richText",
        revealMode: "ALL",
        document: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "cloze",
                  attrs: {
                    id: "verb",
                    answer: "sind",
                    choices: ["sind", "bist", "bin"],
                    order: 1,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  it("saves a linked cloze question without a separate back", async () => {
    const created = {
      ...card("Question", ""),
      kind: "QUESTION" as const,
      linkedToPrevious: true,
    };
    const api = {
      createCard: vi.fn(async () => created),
      updateCard: vi.fn(),
      updateDeck: vi.fn(),
      getDeck: vi.fn(),
    };

    await expect(
      saveCardDraft(api, "deck-1", {
        editing: null,
        front: cloze,
        back: empty,
        frontChanged: true,
        backChanged: false,
        linkedToPrevious: true,
      }),
    ).resolves.toMatchObject({ action: "created", card: created });
    expect(api.createCard).toHaveBeenCalledWith(
      "deck-1",
      expect.objectContaining({
        kind: "QUESTION",
        linkedToPrevious: true,
      }),
    );
  });

  it("saves answer-only content as an explanation", async () => {
    const created = {
      ...card("", "Context"),
      kind: "EXPLANATION" as const,
    };
    const api = {
      createCard: vi.fn(async () => created),
      updateCard: vi.fn(),
      updateDeck: vi.fn(),
      getDeck: vi.fn(),
    };

    await saveCardDraft(api, "deck-1", {
      editing: null,
      front: empty,
      back: content("Context"),
      frontChanged: false,
      backChanged: true,
    });

    expect(api.createCard).toHaveBeenCalledWith(
      "deck-1",
      expect.objectContaining({ kind: "EXPLANATION" }),
    );
  });

  it("defaults the next new card to linked after an explanation", () => {
    expect(
      defaultLinkForNewCard([{ ...card("", "Context"), kind: "EXPLANATION" }]),
    ).toBe(true);
    expect(defaultLinkForNewCard([card("Question", "Answer")])).toBe(false);
  });

  it("changes editor identity after reset so stale Markdown is removed", () => {
    expect(markdownEditorKey("back", null, "de", 0)).not.toBe(
      markdownEditorKey("back", null, "de", 1),
    );
  });
});
const content = (text: string): CardContent => ({
  blocks: [{ type: "text", text }],
});

const deck = (question = "Old question"): DeckDetail => ({
  id: "deck-1",
  parentDeckId: null,
  title: "Test deck",
  description: "",
  language: "en",
  contentLocales: ["en"],
  defaultContentLocale: "en",
  sourceLocale: "en",
  targetLocale: "en",
  protectionMode: "ACCOUNT_BOUND",
  tags: [],
  favorite: false,
  hiddenAt: null,
  archivedAt: null,
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
  sourceLocale: "en",
  targetLocale: "en",
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
      front: content("New question"),
      back: content("Answer"),
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
      front: content("Old question"),
      back: content("Answer"),
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
        front: content("Question without an answer"),
        back: content(""),
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
