import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { createId, deckDescendantIds } from "@flashcards/domain";
import { webLocalAuthorityDatabaseName } from "@flashcards/direct-connect-webstack/local-authority-storage";

import {
  commitLocalDeckEditor,
  createLocalProductDeck,
  exportLocalProductData,
  getLocalProductDeck,
  getLocalProductSettings,
  installLocalNumberCollection,
  listLocalProductDecks,
  localNumberCollectionTemplate,
  localAuthorityJournal,
  localDueCards,
  permanentlyDeleteLocalProductDeck,
  recordLocalProductReview,
  restoreLocalProductData,
  saveLocalProductSettings,
} from "./local-product-repository";
import { closeOfflineDatabase } from "./offline";

const deleteAuthorityDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

afterEach(async () => {
  await deleteAuthorityDatabase();
  await closeOfflineDatabase();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("flash-n-flip-offline-v2");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

describe("original Web UI local product repository", () => {
  it("persists create, atomic editor save, learning and settings without the API", async () => {
    const deck = await createLocalProductDeck({
      title: "Original UI",
      description: "Local first",
      language: "de",
    });
    const cardId = createId();
    const noteId = createId();
    const saved = await commitLocalDeckEditor(deck.id, {
      mutationId: createId(),
      version: deck.version,
      deck: { title: "Original UI gespeichert" },
      createdCards: [
        {
          id: cardId,
          noteId,
          front: {
            blocks: [{ type: "markdown", revealMode: "ALL", source: "Frage" }],
          },
          back: {
            blocks: [
              { type: "markdown", revealMode: "ALL", source: "Antwort" },
            ],
          },
          kind: "QUESTION",
          linkedToPrevious: false,
        },
      ],
      updatedCards: [],
      deletedCards: [],
      cardOrder: {
        cardIds: [cardId],
        cardPage: 1,
        cardPageSize: 100,
      },
    });

    expect(saved.title).toBe("Original UI gespeichert");
    expect(saved.cards).toHaveLength(1);
    expect((await listLocalProductDecks())[0]).toMatchObject({
      title: "Original UI gespeichert",
      cardCount: 1,
    });
    expect(await localDueCards(deck.id, true)).toHaveLength(1);

    const updated = await commitLocalDeckEditor(deck.id, {
      mutationId: createId(),
      version: saved.version,
      deck: {},
      createdCards: [],
      updatedCards: [
        {
          id: cardId,
          front: saved.cards[0]!.front,
          back: {
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "Neue Antwort",
              },
            ],
          },
          kind: "QUESTION",
          linkedToPrevious: false,
          version: saved.cards[0]!.version,
        },
      ],
      deletedCards: [],
      cardOrder: {
        cardIds: [cardId],
        cardPage: 1,
        cardPageSize: 100,
      },
    });
    expect(updated.cards[0]?.back.blocks[0]).toMatchObject({
      source: "Neue Antwort",
    });

    const reviewId = createId();
    await recordLocalProductReview({
      mutationId: reviewId,
      cardId,
      rating: "HARD",
      reviewedAt: "2026-08-09T20:00:00.000Z",
    });
    expect((await localAuthorityJournal()).at(-1)).toMatchObject({
      entityId: reviewId,
      entityType: "REVIEW",
    });
    expect((await getLocalProductDeck(deck.id))?.cards[0]?.version).toBe(3);

    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: "de",
      dailyGoal: 20,
      pagePinchZoom: true,
      textToSpeechMode: "sentence",
      showQuestionWithAnswer: false,
    });
    expect(await getLocalProductSettings()).toMatchObject({
      pagePinchZoom: true,
      textToSpeechMode: "sentence",
      showQuestionWithAnswer: false,
    });
  });

  it("restores the complete product backup after a fresh-install boundary", async () => {
    await createLocalProductDeck({ title: "Sicherung", language: "de" });
    const backup = await exportLocalProductData();
    await deleteAuthorityDatabase();

    await restoreLocalProductData(backup);
    expect((await listLocalProductDecks())[0]?.title).toBe("Sicherung");
  });

  it("installs, renders, deletes and reinstalls number collections locally", async () => {
    const installed = await installLocalNumberCollection({
      sourceLocale: "de-DE",
      targetLocale: "en-US",
      maximum: 100,
      uiLocale: "de",
    });
    expect((await localNumberCollectionTemplate()).installedDeckId).toBe(
      installed.selectedDeckId,
    );

    const firstQueue = await localDueCards(installed.pairDeckId, true);
    expect(firstQueue).toHaveLength(19);
    expect(firstQueue[0]?.card.front.blocks[0]).toEqual({
      type: "text",
      text: "(0)",
    });
    expect(firstQueue[0]?.card.back.blocks[0]).toEqual({
      type: "text",
      text: "(0)",
    });

    await recordLocalProductReview({
      mutationId: createId(),
      cardId: firstQueue[0]!.card.id,
      rating: "GOOD",
      reviewedAt: "2026-08-09T20:00:00.000Z",
    });
    expect(
      (await localDueCards(installed.pairDeckId, true))[0]?.card.front
        .blocks[0],
    ).toEqual({ type: "text", text: "(1)" });

    const tree = await listLocalProductDecks(true, true);
    const deletedIds = deckDescendantIds(tree, installed.selectedDeckId);
    for (const deckId of [...deletedIds].reverse()) {
      await permanentlyDeleteLocalProductDeck(deckId);
    }
    expect((await localNumberCollectionTemplate()).installedDeckId).toBeNull();

    const reinstalled = await installLocalNumberCollection({
      sourceLocale: "de-DE",
      targetLocale: "en-US",
      maximum: 10,
      uiLocale: "de",
    });
    expect(reinstalled.selectedDeckId).toBe(installed.selectedDeckId);
    expect(await localDueCards(reinstalled.pairDeckId, true)).toHaveLength(5);
  });
});
