import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createId, deckDescendantIds, geographyMaps } from "@flashcards/domain";
import { curatedCatalogSchema } from "@flashcards/domain/curated-catalog";
import { defaultContentStyles } from "@flashcards/domain/content-style";
import { localCardPayloadSchema } from "@flashcards/domain/local-app-data";
import { webLocalAuthorityDatabaseName } from "@flashcards/direct-connect-webstack/local-authority-storage";

import {
  commitLocalDeckEditor,
  createLocalProductDeck,
  assertLocalManagedDeckMutationLimit,
  exportLocalProductDeckPackage,
  exportLocalProductData,
  getLocalProductAudioComparison,
  getLocalProductDeck,
  getLocalProductMedia,
  getLocalProductSettings,
  installLocalManagedDeckTree,
  installOptimizedLocalAudio,
  importLocalFilePackage,
  importLocalTextDeck,
  installLocalNumberCollection,
  listLocalProductDeckMetadata,
  listLocalProductDecks,
  localProductRepository,
  localNumberCollectionTemplate,
  localAuthorityJournal,
  localAnkiImportStatus,
  localDueCards,
  localStudyPlanSummary,
  permanentlyDeleteLocalProductDecks,
  pendingPermanentDeleteDeckIds,
  recordLocalProductReview,
  resumePendingPermanentDeckDeletes,
  restoreLocalProductData,
  saveLocalProductSettings,
  schedulePermanentLocalProductDeckDelete,
  updateLocalProductDeck,
  updateLocalProductLearningPlan,
  type LocalManagedDeckSeed,
} from "./local-product-repository";
import {
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
} from "./local-file-import";
import { closeOfflineDatabase } from "./offline";
import { parseLocalDelimitedCards } from "./local-text-import";

const deleteAuthorityDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

const localStorageValues = new Map<string, string>();

beforeEach(() => {
  localStorageValues.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageValues.get(key) ?? null,
      setItem: (key: string, value: string) =>
        localStorageValues.set(key, value),
      removeItem: (key: string) => localStorageValues.delete(key),
    },
  });
});

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
  it("migrates a favorite hierarchy once into the learning plan", async () => {
    const parent = await createLocalProductDeck({ title: "Favorit" });
    const child = await createLocalProductDeck({
      title: "Unterdeck",
      parentDeckId: parent.id,
    });
    await updateLocalProductDeck(parent.id, { favorite: true });

    const migrated = await listLocalProductDeckMetadata(true, true);
    expect(
      migrated
        .filter((deck) => deck.id === parent.id || deck.id === child.id)
        .map((deck) => ({
          id: deck.id,
          favorite: deck.favorite,
          learningEnabled: deck.learningEnabled,
        })),
    ).toEqual([
      { id: parent.id, favorite: false, learningEnabled: true },
      { id: child.id, favorite: false, learningEnabled: true },
    ]);

    const before = (await localAuthorityJournal()).length;
    await listLocalProductDeckMetadata(true, true);
    expect(await localAuthorityJournal()).toHaveLength(before);
  });

  it("limits new cards to the learning plan but keeps learned reviews due", async () => {
    const parent = await createLocalProductDeck({ title: "Lernplan" });
    const first = await createLocalProductDeck({
      title: "A",
      parentDeckId: parent.id,
    });
    const second = await createLocalProductDeck({
      title: "B",
      parentDeckId: parent.id,
    });
    const firstCardId = createId();
    const secondCardId = createId();
    for (const [deck, cardId, label] of [
      [first, firstCardId, "A"],
      [second, secondCardId, "B"],
    ] as const) {
      await commitLocalDeckEditor(deck.id, {
        mutationId: createId(),
        version: deck.version,
        deck: {},
        createdCards: [
          {
            id: cardId,
            noteId: createId(),
            front: { blocks: [{ type: "text", text: `Frage ${label}` }] },
            back: { blocks: [{ type: "text", text: `Antwort ${label}` }] },
            kind: "QUESTION",
            linkedToPrevious: false,
          },
        ],
        updatedCards: [],
        deletedCards: [],
        cardOrder: { cardIds: [cardId], cardPage: 1, cardPageSize: 100 },
      });
    }
    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: "de",
      dailyGoal: 2,
      pagePinchZoom: false,
      textToSpeechMode: "sentence-and-choices",
      showQuestionWithAnswer: true,
    });

    expect(await localDueCards(undefined, false)).toEqual([]);
    await updateLocalProductLearningPlan(parent.id, true);
    expect(await localDueCards(undefined, false)).toEqual([]);
    const learningStates = (await listLocalProductDeckMetadata(true, true))
      .filter((deck) => [parent.id, first.id, second.id].includes(deck.id))
      .map((deck) => [deck.id, deck.learningEnabled]);
    expect(learningStates).toHaveLength(3);
    expect(learningStates).toEqual(
      expect.arrayContaining([
        [parent.id, true],
        [first.id, false],
        [second.id, false],
      ]),
    );

    await updateLocalProductLearningPlan(first.id, true);
    await updateLocalProductLearningPlan(second.id, true);
    const newCards = await localDueCards(undefined, false);
    expect(newCards).toHaveLength(2);
    expect(new Set(newCards.map((due) => due.card.deckId))).toEqual(
      new Set([first.id, second.id]),
    );

    await recordLocalProductReview({
      mutationId: createId(),
      cardId: firstCardId,
      rating: "GOOD",
      reviewedAt: "2020-01-01T12:00:00.000Z",
    });
    await updateLocalProductLearningPlan(first.id, false);
    await updateLocalProductLearningPlan(second.id, false);
    const maintenance = await localDueCards(undefined, false);
    expect(maintenance).toHaveLength(1);
    expect(maintenance[0]).toMatchObject({
      card: { id: firstCardId },
      state: { reps: 1 },
    });
    expect((await localDueCards(first.id, true))[0]).toMatchObject({
      card: { id: firstCardId },
      lastRating: "GOOD",
    });
    await expect(localDueCards(undefined, true, true)).resolves.toEqual([]);
    await expect(localStudyPlanSummary()).resolves.toEqual({
      dueReviews: 1,
      newCards: 0,
      total: 1,
      estimatedMinutes: 1,
    });
  });

  it("keeps the new-card limit after the queue is loaded again", async () => {
    const deck = await createLocalProductDeck({ title: "Tageslimit" });
    const cardIds = [createId(), createId(), createId()];
    await commitLocalDeckEditor(deck.id, {
      mutationId: createId(),
      version: deck.version,
      deck: {},
      createdCards: cardIds.map((id, index) => ({
        id,
        noteId: createId(),
        front: { blocks: [{ type: "text", text: `Frage ${index + 1}` }] },
        back: { blocks: [{ type: "text", text: `Antwort ${index + 1}` }] },
        kind: "QUESTION" as const,
        linkedToPrevious: false,
      })),
      updatedCards: [],
      deletedCards: [],
      cardOrder: { cardIds, cardPage: 1, cardPageSize: 100 },
    });
    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: "de",
      dailyGoal: 2,
      pagePinchZoom: false,
      textToSpeechMode: "sentence-and-choices",
      showQuestionWithAnswer: true,
    });
    await updateLocalProductLearningPlan(deck.id, true);

    const firstLoad = await localDueCards(undefined, false);
    expect(firstLoad).toHaveLength(2);
    const nextWindow = await localDueCards(
      undefined,
      false,
      false,
      new Set([firstLoad[0]!.card.id]),
    );
    expect(nextWindow).toHaveLength(2);
    expect(nextWindow.map((due) => due.card.id)).not.toContain(
      firstLoad[0]!.card.id,
    );
    await recordLocalProductReview({
      mutationId: createId(),
      cardId: firstLoad[0]!.card.id,
      rating: "GOOD",
      reviewedAt: new Date().toISOString(),
    });

    const reloaded = await localDueCards(undefined, false);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]!.state.reps).toBe(0);
  });

  it("introduces reverse siblings from the same note on different days", async () => {
    const deck = await createLocalProductDeck({ title: "Richtungspaar" });
    const noteId = createId();
    const cardIds = [createId(), createId()];
    await commitLocalDeckEditor(deck.id, {
      mutationId: createId(),
      version: deck.version,
      deck: {},
      createdCards: cardIds.map((id, index) => ({
        id,
        noteId,
        front: {
          blocks: [
            { type: "text", text: index === 0 ? "Willkommen" : "Hello" },
          ],
        },
        back: {
          blocks: [
            { type: "text", text: index === 0 ? "Hello" : "Willkommen" },
          ],
        },
        kind: "QUESTION" as const,
        linkedToPrevious: false,
      })),
      updatedCards: [],
      deletedCards: [],
      cardOrder: { cardIds, cardPage: 1, cardPageSize: 100 },
    });
    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: "de",
      dailyGoal: 2,
      pagePinchZoom: false,
      textToSpeechMode: "sentence-and-choices",
      showQuestionWithAnswer: true,
    });
    await updateLocalProductLearningPlan(deck.id, true);

    const firstDay = await localDueCards(undefined, false);
    expect(firstDay).toHaveLength(1);
    await recordLocalProductReview({
      mutationId: createId(),
      cardId: firstDay[0]!.card.id,
      rating: "GOOD",
      reviewedAt: new Date().toISOString(),
    });

    const sameDay = await localDueCards(undefined, false);
    expect(sameDay.every((due) => due.card.noteId !== noteId)).toBe(true);
  });

  it("offers an audio comparison only when a verified derivative differs from its original", async () => {
    const deck = await createLocalProductDeck({ title: "Audiovergleich" });
    const mediaId = await (
      await localProductRepository()
    ).addMedia({
      deckId: deck.id,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    expect(await getLocalProductAudioComparison(mediaId)).toBeNull();

    await installOptimizedLocalAudio({
      originalMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([7, 8, 9]),
      engine: "test-denoise",
      engineVersion: "4",
      inputMeasurement: {
        durationSeconds: 1,
        integratedLufs: -26,
        truePeakDb: -6,
        sampleRate: 44_100,
        channels: 2,
      },
      outputMeasurement: {
        durationSeconds: 1,
        integratedLufs: -16,
        truePeakDb: -2,
        sampleRate: 24_000,
        channels: 1,
      },
    });

    const comparison = await getLocalProductAudioComparison(mediaId);
    expect(new Uint8Array(await comparison!.original.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    );
    expect(new Uint8Array(await comparison!.optimized.arrayBuffer())).toEqual(
      new Uint8Array([7, 8, 9]),
    );
  });

  it("archives a complete hierarchy with one durable root mutation", async () => {
    const collection = await createLocalProductDeck({
      title: "Collection",
      language: "de",
    });
    const child = await createLocalProductDeck({
      title: "Child",
      language: "de",
      parentDeckId: collection.id,
    });
    const cardId = createId();
    await commitLocalDeckEditor(child.id, {
      mutationId: createId(),
      version: child.version,
      deck: {},
      createdCards: [
        {
          id: cardId,
          noteId: createId(),
          front: {
            blocks: [{ type: "text", text: "Question" }],
          },
          back: {
            blocks: [{ type: "text", text: "Answer" }],
          },
          kind: "QUESTION",
          linkedToPrevious: false,
        },
      ],
      updatedCards: [],
      deletedCards: [],
      cardOrder: { cardIds: [cardId], cardPage: 1, cardPageSize: 100 },
    });
    expect(await localDueCards(child.id, true)).toHaveLength(1);
    await recordLocalProductReview({
      mutationId: createId(),
      cardId,
      rating: "GOOD",
      reviewedAt: new Date().toISOString(),
    });
    const before = await localAuthorityJournal();

    await updateLocalProductDeck(collection.id, {
      archivedAt: "2026-08-11T18:00:00.000Z",
    });

    const added = (await localAuthorityJournal()).slice(before.length);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      entityId: collection.id,
      entityType: "DECK",
      operation: "UPSERT",
    });
    expect(await listLocalProductDeckMetadata()).toEqual([]);
    expect(await localDueCards(child.id, true)).toEqual([]);
    expect(
      (await listLocalProductDeckMetadata(true, true)).find(
        (deck) => deck.id === child.id,
      )?.archivedAt,
    ).toBeNull();
  });

  it("publishes deck metadata before rebuilding derived metrics", async () => {
    const deck = await createLocalProductDeck({
      title: "Fast metadata",
      language: "de",
    });
    expect((await listLocalProductDeckMetadata())[0]).toMatchObject({
      id: deck.id,
      metricsPending: true,
    });

    await listLocalProductDecks();

    expect((await listLocalProductDeckMetadata())[0]).toMatchObject({
      id: deck.id,
      metricsPending: false,
    });
  });

  it("persists a permanent-delete job before processing its tombstones", async () => {
    const deck = await createLocalProductDeck({
      title: "Queued deletion",
      language: "de",
    });
    schedulePermanentLocalProductDeckDelete(new Set([deck.id]));
    expect(pendingPermanentDeleteDeckIds()).toEqual(new Set([deck.id]));
    expect(await listLocalProductDeckMetadata(true, true)).toEqual([]);

    await resumePendingPermanentDeckDeletes();

    expect(pendingPermanentDeleteDeckIds()).toEqual(new Set());
    expect(await listLocalProductDeckMetadata(true, true)).toEqual([]);
    expect(
      (await localAuthorityJournal()).some(
        (mutation) =>
          mutation.entityId === deck.id && mutation.operation === "DELETE",
      ),
    ).toBe(true);
  });

  it("reports the 100,000-change collection limit before writing", () => {
    expect(() => assertLocalManagedDeckMutationLimit(100_000)).not.toThrow();
    expect(() => assertLocalManagedDeckMutationLimit(100_001)).toThrow(
      "Collection exceeds the local limit of 100,000 changes.",
    );
  });

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

  it("exports a portable FNF package that the local importer accepts", async () => {
    const deck = await createLocalProductDeck({
      title: "Portables Deck",
      language: "de",
      tags: ["portable"],
    });
    const cardId = createId();
    await commitLocalDeckEditor(deck.id, {
      mutationId: createId(),
      version: deck.version,
      deck: {},
      createdCards: [
        {
          id: cardId,
          noteId: createId(),
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
      cardOrder: { cardIds: [cardId], cardPage: 1, cardPageSize: 100 },
    });

    const blob = await exportLocalProductDeckPackage(deck.id);
    const parsed = await parseLocalFlashNFlipPackage(
      new File([blob], "portable.fnf", { type: blob.type }),
    );

    expect(parsed.title).toBe("Portables Deck");
    expect(parsed.decks[0]?.tags).toEqual(["portable"]);
    expect(parsed.decks[0]?.cards[0]).toMatchObject({
      sourceId: cardId,
      tags: [],
    });
  });

  it("imports quoted CSV and Anki TSV atomically with cleaned content and card tags", async () => {
    const csv = readFileSync(
      new URL(
        "../../../scripts/quality/fixtures/general-csv.csv",
        import.meta.url,
      ),
      "utf8",
    );
    const tsv = readFileSync(
      new URL(
        "../../../scripts/quality/fixtures/general-anki.tsv",
        import.meta.url,
      ),
      "utf8",
    );
    const csvCards = parseLocalDelimitedCards(csv, "CSV");
    const tsvCards = parseLocalDelimitedCards(tsv, "ANKI_TSV");
    expect(csvCards[0]).toEqual({
      front: "Question, with comma",
      back: "Answer with\nreal line break",
      tags: ["tag-one", "tag-two"],
    });
    expect(tsvCards[0]).toEqual({
      front: "Question\nline two",
      back: "Answer",
      tags: ["anki", "safe"],
    });

    const imported = await importLocalTextDeck({
      title: "Delimited",
      sourceLocale: "en",
      targetLocale: "de",
      cards: [...csvCards, ...tsvCards],
    });
    expect((await getLocalProductDeck(imported.id))?.cards).toHaveLength(3);
    const cardPayloads = (await localAuthorityJournal())
      .filter((mutation) => mutation.entityType === "CARD")
      .map((mutation) => localCardPayloadSchema.parse(mutation.payload));
    expect(cardPayloads.map((payload) => payload.tags)).toEqual([
      ["tag-one", "tag-two"],
      ["safe"],
      ["anki", "safe"],
    ]);
  });

  it("round-trips an FNF hierarchy and keeps UUID-backed image and audio references valid", async () => {
    const source = readFileSync(
      new URL(
        "../../../scripts/quality/fixtures/general-media.fnf",
        import.meta.url,
      ),
    );
    const parsed = await parseLocalFlashNFlipPackage(
      new File([source], "general-media.fnf"),
    );
    const installed = await importLocalFilePackage({
      parsed,
      sourceLocale: "en",
      targetLocale: "de",
    });
    const installedDecks = await listLocalProductDecks(true, true);
    const installedCards = await Promise.all(
      installedDecks.map((deck) => getLocalProductDeck(deck.id)),
    );
    const importedCard = installedCards
      .flatMap((deck) => deck?.cards ?? [])
      .find((card) =>
        card.front.blocks.some((block) => block.type === "image"),
      );
    const importedImage = importedCard?.front.blocks.find(
      (block) => block.type === "image",
    );
    const importedAudio = importedCard?.back.blocks.find(
      (block) => block.type === "audio",
    );
    expect(importedImage?.type).toBe("image");
    expect(importedAudio?.type).toBe("audio");
    if (importedImage?.type !== "image" || importedAudio?.type !== "audio") {
      throw new Error("Das FNF-Fixture enthält keine Bild-/Audioreferenz.");
    }
    expect(await getLocalProductMedia(importedImage.mediaId)).not.toBeNull();
    expect(await getLocalProductMedia(importedAudio.mediaId)).not.toBeNull();

    const firstExport = await exportLocalProductDeckPackage(installed.deckId);
    const firstParsed = await parseLocalFlashNFlipPackage(
      new File([firstExport], "roundtrip.fnf"),
    );
    expect(firstParsed.media).toHaveLength(2);
    expect(
      firstParsed.decks
        .find((deck) => deck.path.length === 1)
        ?.contentStyles?.map((style) => style.name),
    ).toEqual(["hint", "accent"]);
    expect(
      firstParsed.decks.flatMap((deck) => deck.cards)[0]?.front.blocks,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image",
          mediaId: importedImage.mediaId,
        }),
      ]),
    );

    const tree = await listLocalProductDecks(true, true);
    await permanentlyDeleteLocalProductDecks(
      deckDescendantIds(tree, installed.deckId),
    );
    const restored = await importLocalFilePackage({
      parsed: firstParsed,
      sourceLocale: "en",
      targetLocale: "de",
    });
    expect(
      (await listLocalProductDecks()).some(
        (deck) => deck.id === restored.deckId,
      ),
    ).toBe(true);
    const restoredTree = await listLocalProductDecks(true, true);
    const restoredCards = await Promise.all(
      restoredTree.map((deck) => getLocalProductDeck(deck.id)),
    );
    const restoredAudio = restoredCards
      .flatMap((deck) => deck?.cards ?? [])
      .flatMap((card) => card.back.blocks)
      .find((block) => block.type === "audio");
    expect(restoredAudio?.type).toBe("audio");
    if (restoredAudio?.type === "audio") {
      expect(await getLocalProductMedia(restoredAudio.mediaId)).not.toBeNull();
    }
  });

  it("reimports a deleted Anki package with new IDs while retaining tombstones", async () => {
    const parsed = {
      title: "Deleted Anki reimport",
      decks: [
        {
          sourceId: "deleted-reimport-deck",
          path: ["Deleted Anki reimport"],
          cards: [
            {
              sourceId: "deleted-reimport-card",
              sourceNoteId: "deleted-reimport-note",
              sourceNoteGuid: "deleted-reimport-guid",
              front: { blocks: [{ type: "text" as const, text: "Question" }] },
              back: { blocks: [{ type: "text" as const, text: "Answer" }] },
              tags: [],
            },
          ],
        },
      ],
      media: [],
      warnings: [],
      format: "APKG" as const,
      sourceCollectionKey: "deleted-anki-reimport",
      packageSha256: "c".repeat(64),
    };
    const first = await importLocalFilePackage({
      parsed,
      sourceLocale: "en",
      targetLocale: "de",
    });
    const firstCardId = (await getLocalProductDeck(first.deckId))?.cards[0]?.id;
    expect(firstCardId).toBeDefined();

    await permanentlyDeleteLocalProductDecks(new Set([first.deckId]));
    const deletedEntities = await (
      await localProductRepository()
    ).authority.listEntities({ includeDeleted: true });
    expect(
      deletedEntities.find(
        (entity) => entity.winningMutation.entityId === first.deckId,
      )?.winningMutation.operation,
    ).toBe("DELETE");

    const second = await importLocalFilePackage({
      parsed,
      sourceLocale: "en",
      targetLocale: "de",
    });
    const secondCardId = (await getLocalProductDeck(second.deckId))?.cards[0]
      ?.id;

    expect(second.deckId).not.toBe(first.deckId);
    expect(secondCardId).toBeDefined();
    expect(secondCardId).not.toBe(firstCardId);
    expect(
      (
        await (
          await localProductRepository()
        ).authority.getEntity(first.deckId, { includeDeleted: true })
      )?.winningMutation.operation,
    ).toBe("DELETE");
  });

  it("persists custom-profile audio as a playable local reference instead of [[AUDIO]] text", async () => {
    const installed = await importLocalFilePackage({
      parsed: {
        title: "Profile audio",
        decks: [
          {
            sourceId: "audio-deck",
            path: ["Profile audio"],
            cards: [
              {
                sourceId: "audio-card",
                sourceNoteId: "audio-note",
                sourceNoteGuid: "audio-guid",
                profileRuleId: "audio-rule",
                profileOutputId: "audio-output",
                front: {
                  blocks: [{ type: "text", text: "Listen" }],
                },
                back: {
                  blocks: [
                    {
                      type: "importAudio" as never,
                      sourceName: "voice.mp3",
                      label: "Imported audio",
                    } as never,
                  ],
                },
                tags: [],
              },
            ],
          },
        ],
        media: [
          {
            sourceName: "voice.mp3",
            mimeType: "audio/mpeg",
            bytes: Uint8Array.from([0x49, 0x44, 0x33, 1, 2, 3]),
            kind: "audio",
          },
        ],
        warnings: [],
        format: "APKG",
        sourceCollectionKey: "profile-audio",
        packageSha256: "a".repeat(64),
        profileId: "019ffb67-ff04-7591-a849-a234c0ff9c7d",
        profileVersion: 2,
      },
      sourceLocale: "de",
      targetLocale: "en",
    });
    const deck = await getLocalProductDeck(installed.deckId);
    const audio = deck?.cards[0]?.back.blocks.find(
      (block) => block.type === "audio",
    );

    expect(audio?.type).toBe("audio");
    expect(JSON.stringify(deck?.cards[0])).not.toContain("[[AUDIO]]");
    if (audio?.type === "audio") {
      expect(await getLocalProductMedia(audio.mediaId)).not.toBeNull();
    }
  });

  it("stores defaults on the import root and cascades child style overrides to due cards", async () => {
    const childAccent = {
      ...defaultContentStyles[1]!,
      bright: {
        ...defaultContentStyles[1]!.bright,
        color: "#000000",
        backgroundColor: "#ffffff",
      },
    };
    const installed = await importLocalFilePackage({
      parsed: {
        title: "Styled",
        decks: [
          {
            sourceId: "styled-child",
            path: ["Styled", "Child"],
            contentStyles: [childAccent],
            cards: [
              {
                sourceId: "styled-card",
                sourceNoteId: "styled-note",
                front: {
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
                                type: "text",
                                text: "Styled",
                                marks: [
                                  {
                                    type: "contentStyle",
                                    attrs: { name: "accent" },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
                back: { blocks: [{ type: "text", text: "Answer" }] },
                tags: [],
              },
            ],
          },
        ],
        media: [],
        warnings: [],
        format: "APKG",
        sourceCollectionKey: "styled-collection",
        packageSha256: "b".repeat(64),
      },
      sourceLocale: "de",
      targetLocale: "en",
    });
    const decks = await listLocalProductDecks(true, true);
    const child = decks.find((deck) => deck.title === "Child")!;
    const root = await getLocalProductDeck(installed.deckId);
    const childDetail = await getLocalProductDeck(child.id);
    const due = (await localDueCards(child.id, true))[0]!;

    expect(root?.contentStyles?.map((style) => style.name)).toEqual([
      "hint",
      "accent",
    ]);
    expect(childDetail?.contentStyles?.map((style) => style.name)).toEqual([
      "accent",
    ]);
    expect(
      childDetail?.resolvedContentStyles?.map((style) => style.name),
    ).toEqual(["hint", "accent"]);
    expect(
      due.contentStyles?.find((style) => style.name === "accent")?.bright,
    ).toEqual(childAccent.bright);
  });

  it("inherits an edited import-root language direction without rewriting child cards", async () => {
    const installed = await importLocalFilePackage({
      parsed: {
        title: "Languages",
        decks: [
          {
            sourceId: "language-child",
            path: ["Languages", "Child"],
            cards: [
              {
                sourceId: "language-card",
                sourceNoteId: "language-note",
                front: { blocks: [{ type: "text", text: "Question" }] },
                back: { blocks: [{ type: "text", text: "Antwort" }] },
                tags: [],
              },
            ],
          },
        ],
        media: [],
        warnings: [],
        format: "APKG",
        suggestedSourceLocale: "it",
        suggestedTargetLocale: "pt",
        sourceCollectionKey: "language-collection",
        packageSha256: "c".repeat(64),
      },
      sourceLocale: "en",
      targetLocale: "de",
    });
    const before = await listLocalProductDecks(true, true);
    const child = before.find((deck) => deck.title === "Child")!;
    expect(child).toMatchObject({
      languageDirectionMode: "INHERIT",
      sourceLocale: "en",
      targetLocale: "de",
    });

    await updateLocalProductDeck(installed.deckId, {
      sourceLocaleOverride: "fr",
      targetLocaleOverride: "es",
    });

    const inherited = (await listLocalProductDecks(true, true)).find(
      (deck) => deck.id === child.id,
    );
    const due = (await localDueCards(child.id, true))[0]!;
    expect(inherited).toMatchObject({ sourceLocale: "fr", targetLocale: "es" });
    expect(due.card).toMatchObject({
      questionLocale: "fr",
      answerLocale: "es",
    });
  });

  it("persists the Xefjord profile without losing notes, provenance or hierarchy", async () => {
    const bytes = readFileSync(
      new URL(
        "../../../scripts/quality/fixtures/xefjord-german-parity.apkg",
        import.meta.url,
      ),
    );
    const parsed = await parseLocalAnkiPackage(
      new File([bytes], "xefjord-german-parity.apkg"),
      { sourceLocale: "en", targetLocale: "de" },
      {
        profileSelection: {
          kind: "BUILT_IN",
          profileId: "builtin.xefjord-complete.v1",
        },
      },
    );

    expect(parsed.decks).toHaveLength(1);
    expect(parsed.decks[0]?.path).toEqual(["Xefjord's Complete German"]);
    await importLocalFilePackage({
      parsed,
      sourceLocale: "en",
      targetLocale: "de",
    });

    const decks = await listLocalProductDecks(true, true);
    const collection = decks.find(
      (deck) => deck.sourceTemplateKey === "xefjord-complete-collection",
    );
    const languageDeck = decks.find(
      (deck) => deck.title === "Xefjord's Complete German",
    );
    expect(collection).toMatchObject({
      title: "Xefjord's Complete",
      parentDeckId: null,
      tags: ["Anki Import", "Xefjord", "Collection"],
    });
    expect(languageDeck).toMatchObject({
      parentDeckId: collection?.id,
      cardCount: 2,
      tags: ["Anki Import", "Xefjord"],
    });

    const cardMutations = (await localAuthorityJournal()).filter(
      (mutation) => mutation.entityType === "CARD",
    );
    const cardPayloads = cardMutations.map((mutation) =>
      localCardPayloadSchema.parse(mutation.payload),
    );
    expect(new Set(cardPayloads.map((payload) => payload.noteId)).size).toBe(1);
    expect(cardPayloads[0]).toMatchObject({
      tags: ["parity"],
      importSource: {
        kind: "ANKI",
        sourceNoteId: "300",
        sourceNoteTypeId: "100",
        sourceState: { queue: 0 },
      },
    });

    const backup = JSON.parse(await (await exportLocalProductData()).text());
    expect(
      backup.authority.payload.entities.filter(
        (entity: { winningMutation: { entityType: string } }) =>
          entity.winningMutation.entityType === "CARD",
      ),
    ).toHaveLength(2);
  });

  it("updates the same Anki lineage without duplicating cards or resetting progress", async () => {
    const bytes = readFileSync(
      new URL(
        "../../../scripts/quality/fixtures/xefjord-german-parity.apkg",
        import.meta.url,
      ),
    );
    const parse = () =>
      parseLocalAnkiPackage(
        new File([bytes], "xefjord-german-parity.apkg"),
        { sourceLocale: "en", targetLocale: "de" },
        {
          profileSelection: {
            kind: "BUILT_IN",
            profileId: "builtin.xefjord-complete.v1",
          },
        },
      );
    const firstParsed = await parse();
    const firstImport = await importLocalFilePackage({
      parsed: firstParsed,
      sourceLocale: "en",
      targetLocale: "de",
      reimportMode: "UPDATE",
    });
    const firstDeckId = (await listLocalProductDecks(true, true)).find(
      (deck) => deck.title === "Xefjord's Complete German",
    )?.id;
    expect(firstDeckId).toBeDefined();
    const firstDeck = await getLocalProductDeck(firstDeckId!);
    const firstCard = firstDeck?.cards[0];
    expect(firstCard).toBeDefined();
    await recordLocalProductReview({
      mutationId: createId(),
      cardId: firstCard!.id,
      rating: "GOOD",
      reviewedAt: "2026-08-13T10:00:00.000Z",
    });
    const reviewed = (await getLocalProductDeck(firstDeckId!))?.cards[0];

    const secondParsed = await parse();
    expect(secondParsed.sourceCollectionKey).toBe(
      firstParsed.sourceCollectionKey,
    );
    expect(
      await localAnkiImportStatus(firstParsed.sourceCollectionKey!),
    ).toMatchObject({ exists: true, cardCount: 2 });
    const update = await importLocalFilePackage({
      parsed: secondParsed,
      sourceLocale: "en",
      targetLocale: "de",
      reimportMode: "UPDATE",
    });
    const updated = await getLocalProductDeck(firstDeckId!);
    expect(updated?.cards.map((card) => card.id)).toEqual(
      firstDeck?.cards.map((card) => card.id),
    );
    expect(updated?.cards[0]?.version).toBe(reviewed?.version);
    expect(update).toMatchObject({
      unchangedCardCount: 2,
      updatedCardCount: 0,
      retainedObsoleteCardCount: 0,
    });

    const copy = await importLocalFilePackage({
      parsed: await parse(),
      sourceLocale: "en",
      targetLocale: "de",
      reimportMode: "COPY",
    });
    expect(copy.deckId).not.toBe(firstImport.deckId);
    expect(
      (await localAnkiImportStatus(firstParsed.sourceCollectionKey!)).cardCount,
    ).toBe(4);
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
    await permanentlyDeleteLocalProductDecks(deletedIds);
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

  it("updates curated content without resetting progress or deleting a retracted local copy", async () => {
    const seed = {
      key: "curated:test:v1",
      parentKey: null,
      title: "Kuratierter Test",
      language: "de",
      contentLocales: ["de"],
      defaultContentLocale: "de",
      sourceLocale: "de",
      targetLocale: "de",
      cards: [
        {
          key: "card-1",
          front: {
            blocks: [
              {
                type: "markdown" as const,
                revealMode: "ALL" as const,
                source: "Alt",
              },
            ],
          },
          back: {
            blocks: [
              {
                type: "markdown" as const,
                revealMode: "ALL" as const,
                source: "Antwort",
              },
            ],
          },
        },
      ],
    };
    const installed = await installLocalManagedDeckTree([seed]);
    const deckId = installed.idsByKey.get(seed.key)!;
    const card = (await getLocalProductDeck(deckId))!.cards[0]!;
    await recordLocalProductReview({
      mutationId: createId(),
      cardId: card.id,
      rating: "GOOD",
      reviewedAt: "2026-08-10T12:00:00.000Z",
    });

    await installLocalManagedDeckTree([
      {
        ...seed,
        cards: [
          {
            ...seed.cards[0]!,
            front: {
              blocks: [
                {
                  type: "markdown" as const,
                  revealMode: "ALL" as const,
                  source: "Aktualisiert",
                },
              ],
            },
          },
        ],
      },
    ]);
    expect((await localDueCards(deckId, true))[0]?.state.reps).toBe(1);
    expect(
      (await getLocalProductDeck(deckId))?.cards[0]?.front.blocks[0],
    ).toMatchObject({
      source: "Aktualisiert",
    });

    // A signed catalog may later stop offering the package. No destructive
    // local install call is made, so the existing learned copy remains.
    expect(
      (await listLocalProductDecks()).some((deck) => deck.id === deckId),
    ).toBe(true);
  });

  it("installs an all-maps-sized managed tree beyond the interactive edit limit", async () => {
    const cards = Array.from({ length: 1_000 }, (_, index) => ({
      key: `region-${index}`,
      front: {
        blocks: [
          {
            type: "text" as const,
            text: `Region ${index}`,
          },
        ],
      },
      back: {
        blocks: [
          {
            type: "text" as const,
            text: `Antwort ${index}`,
          },
        ],
      },
    }));
    const installed = await installLocalManagedDeckTree([
      {
        key: "curated:geography:large",
        parentKey: null,
        title: "Alle Karten",
        language: "de",
        contentLocales: ["de"],
        defaultContentLocale: "de",
        sourceLocale: "de",
        targetLocale: "de",
        cards,
      },
    ]);
    const deckId = installed.idsByKey.get("curated:geography:large")!;

    const deck = await getLocalProductDeck(deckId);
    expect(deck?.id).toBe(deckId);
    expect(deck?.cards).toHaveLength(1_000);

    await permanentlyDeleteLocalProductDecks(new Set([deckId]));
    expect(await getLocalProductDeck(deckId)).toBeNull();
    expect(await listLocalProductDecks(true, true)).toHaveLength(0);
    expect(
      (await localAuthorityJournal()).filter(
        (mutation) => mutation.operation === "DELETE",
      ),
    ).toHaveLength(1_001);
  }, 30_000);

  it("installs the actual curated geography tree atomically", async () => {
    const catalog = curatedCatalogSchema.parse(
      JSON.parse(
        readFileSync(
          new URL("../public/curated/catalog.v2.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const geography = catalog.collections.find(
      (collection) => collection.id === "geography",
    )!;
    const seeds = geography.decks.map((deck): LocalManagedDeckSeed => {
      if (deck.visual?.kind !== "MAP") {
        return {
          ...deck,
          visual: deck.visual as LocalManagedDeckSeed["visual"],
        };
      }
      if (!(deck.visual.value in geographyMaps)) {
        throw new Error(`Unknown curated map: ${deck.visual.value}`);
      }
      return {
        ...deck,
        visual: {
          ...deck.visual,
          value: deck.visual.value as keyof typeof geographyMaps,
        },
      };
    });
    const installed = await installLocalManagedDeckTree(seeds);

    expect(installed.installedDeckIds).toHaveLength(100);
    expect(await listLocalProductDecks(true, true)).toHaveLength(100);
    const rootId = installed.idsByKey.get(geography.rootKey)!;
    const root = await getLocalProductDeck(rootId);
    expect(root?.cards).toHaveLength(7);
    expect(root?.cards[0]?.front.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "geographyMap", mapId: "world" }),
      ]),
    );
  }, 30_000);
});
