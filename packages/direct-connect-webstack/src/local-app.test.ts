import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { localAppBackupEnvelopeSchema } from "@flashcards/domain/local-app-data";
import { createId } from "@flashcards/domain";

import { LocalAppRepository } from "./local-app";
import { webLocalAuthorityDatabaseName } from "./local-authority-storage";
import { IndexedDbLocalMediaStorage } from "./media-storage";

const deviceA = "00000000-0000-4000-8000-000000000301";
const deviceB = "00000000-0000-4000-8000-000000000302";

const deleteDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

afterEach(deleteDatabase);

describe("local-first application repository", () => {
  it("queries a bounded fair study window through the local card index", async () => {
    const repository = new LocalAppRepository(deviceA);
    const firstDeckId = await repository.saveDeck({
      title: "Erstes Deck",
      learningEnabled: true,
    });
    const secondDeckId = await repository.saveDeck({
      title: "Zweites Deck",
      learningEnabled: true,
    });
    const firstCardIds = await Promise.all(
      ["A1", "A2", "A3"].map((front) =>
        repository.saveCard({ deckId: firstDeckId, front, back: front }),
      ),
    );
    await Promise.all(
      ["B1", "B2", "B3"].map((front) =>
        repository.saveCard({ deckId: secondDeckId, front, back: front }),
      ),
    );

    const initial = await repository.listStudyCards({
      deckIds: [firstDeckId, secondDeckId],
      dueBefore: new Date().toISOString(),
      introducedAfter: "2026-08-15T00:00:00.000Z",
      reviewLimit: 10,
      newDeckIds: [firstDeckId, secondDeckId],
      newLimit: 4,
    });
    expect(initial).toHaveLength(4);
    expect(new Set(initial.map((card) => card.payload.deckId))).toEqual(
      new Set([firstDeckId, secondDeckId]),
    );
    const nextWindow = await repository.listStudyCards({
      deckIds: [firstDeckId, secondDeckId],
      dueBefore: new Date().toISOString(),
      introducedAfter: "2026-08-15T00:00:00.000Z",
      excludedCardIds: initial.map((card) => card.id),
      reviewLimit: 10,
      newDeckIds: [firstDeckId, secondDeckId],
      newLimit: 4,
    });
    expect(nextWindow).toHaveLength(2);
    expect(
      nextWindow.every(
        (card) => !initial.some((candidate) => candidate.id === card.id),
      ),
    ).toBe(true);

    await repository.reviewCard(
      firstCardIds[0]!,
      "GOOD",
      new Date("2020-01-01T12:00:00.000Z"),
    );
    await repository.reviewCard(
      firstCardIds[0]!,
      "HARD",
      new Date("2020-01-02T12:00:00.000Z"),
    );
    await expect(
      repository.latestReviewRatings([firstCardIds[0]!, firstCardIds[1]!]),
    ).resolves.toEqual(new Map([[firstCardIds[0]!, "HARD"]]));
    await expect(
      repository.countStudyCards({
        deckIds: [firstDeckId, secondDeckId],
        dueBefore: new Date().toISOString(),
        introducedAfter: "2026-08-15T00:00:00.000Z",
        newDeckIds: [secondDeckId],
        newLimit: 2,
      }),
    ).resolves.toEqual({
      dueReviews: 1,
      availableNew: 2,
      introducedToday: 0,
      introducedNoteIds: [],
    });
  });

  it("saves a review by reading only its card and reads images without scanning audio derivatives", async () => {
    const repository = new LocalAppRepository(deviceA);
    const deckId = await repository.saveDeck({ title: "Sparsames Lernen" });
    const cardId = await repository.saveCard({
      deckId,
      front: "Frage",
      back: "Antwort",
    });
    const imageId = await repository.addMedia({
      deckId,
      cardId,
      fileName: "karte.png",
      mimeType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
    const listCards = vi.spyOn(repository, "listCards");
    const listAudioDerivatives = vi.spyOn(repository, "listAudioDerivatives");

    await repository.reviewCard(cardId, "GOOD");
    await expect(repository.getPlayableMedia(imageId)).resolves.toMatchObject({
      bytes: new Uint8Array([137, 80, 78, 71]),
    });

    expect(listCards).not.toHaveBeenCalled();
    expect(listAudioDerivatives).not.toHaveBeenCalled();
  });

  it("persists the learning step across card reloads and graduates the card", async () => {
    const repository = new LocalAppRepository(deviceA);
    const deckId = await repository.saveDeck({ title: "Lernschritte" });
    const cardId = await repository.saveCard({
      deckId,
      front: "Frage",
      back: "Antwort",
    });
    const firstReviewAt = new Date("2026-08-17T08:00:00.000Z");

    await repository.reviewCard(cardId, "GOOD", firstReviewAt);
    const learning = (await repository.getCard(cardId))!.payload.state;
    expect(learning).toMatchObject({
      learningState: "LEARNING",
      learningSteps: 1,
    });

    const restarted = new LocalAppRepository(deviceA);
    await restarted.reviewCard(cardId, "GOOD", new Date(learning.due));
    expect((await restarted.getCard(cardId))!.payload.state).toMatchObject({
      learningState: "REVIEW",
      learningSteps: 0,
    });
  });

  it("persists all critical flows, scheduler history, media and a complete restore", async () => {
    const repository = new LocalAppRepository(deviceA);
    const deckId = await repository.saveDeck({
      title: "Offline lernen",
      description: "Bleibt lokal",
      language: "de",
    });
    const cardId = await repository.saveCard({
      deckId,
      front: "Frage",
      back: "Antwort",
    });
    await repository.reviewCard(
      cardId,
      "GOOD",
      new Date("2026-08-09T17:00:00.000Z"),
    );
    await repository.saveSettings({
      theme: "DARK",
      locale: "de",
      dailyGoal: 25,
    });
    await repository.addMedia({
      deckId,
      cardId,
      fileName: "wort.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    expect(await repository.listDecks()).toHaveLength(1);
    expect((await repository.listCards())[0]?.payload.front).toEqual({
      blocks: [{ type: "markdown", revealMode: "ALL", source: "Frage" }],
    });
    expect((await repository.listCards())[0]?.payload.state.reps).toBe(1);
    const review = (await repository.listReviews())[0]?.payload;
    expect(review).toMatchObject({
      rating: "GOOD",
      schedulerVersion: "flash-n-flip-fsrs@2/ts-fsrs@5.4.1",
      cardId,
      deckId,
    });
    expect(review?.parameters.length).toBeGreaterThan(10);
    expect(await repository.authority.listOutbox()).toHaveLength(6);

    const backup = localAppBackupEnvelopeSchema.parse(
      await repository.exportAll(),
    );
    expect(backup.version).toBe(3);
    expect(backup.media).toEqual([
      expect.objectContaining({
        byteSize: 4,
        dataBase64: "AQIDBA==",
      }),
    ]);

    await deleteDatabase();
    const restored = new LocalAppRepository(deviceB);
    await restored.restoreAll(backup);
    expect((await restored.listDecks())[0]?.payload.title).toBe(
      "Offline lernen",
    );
    expect((await restored.listReviews())[0]?.payload.after.reps).toBe(1);
    expect((await restored.listMedia())[0]?.payload.fileName).toBe("wort.wav");
    expect(await restored.authority.listOutbox()).toHaveLength(6);

    const deck = (await restored.listDecks())[0]!;
    await restored.deleteDeck(deck);
    expect(await restored.listDecks()).toHaveLength(0);
    expect(await restored.listCards()).toHaveLength(0);
    expect(await restored.listMedia()).toHaveLength(0);
    expect(await restored.listReviews()).toHaveLength(1);
    const tombstones = await restored.authority.listEntities({
      includeDeleted: true,
    });
    expect(
      tombstones.filter(
        (entry) => entry.winningMutation.operation === "DELETE",
      ),
    ).toHaveLength(3);

    const restartedAfterDelete = new LocalAppRepository(deviceB);
    expect(await restartedAfterDelete.listDecks()).toHaveLength(0);
    expect(await restartedAfterDelete.listCards()).toHaveLength(0);
    expect(
      (
        await restartedAfterDelete.authority.listEntities({
          includeDeleted: true,
        })
      ).filter((entry) => entry.winningMutation.operation === "DELETE"),
    ).toHaveLength(3);
  });

  it("refuses to overwrite an existing local authority during restore", async () => {
    const source = new LocalAppRepository(deviceA);
    await source.saveDeck({ title: "Quelle" });
    const backup = await source.exportAll();
    await expect(source.restoreAll(backup)).rejects.toThrow(/empty/i);
    expect((await source.listDecks())[0]?.payload.title).toBe("Quelle");
  });

  it("refuses incomplete or corrupt media backups", async () => {
    const source = new LocalAppRepository(deviceA);
    const deckId = await source.saveDeck({ title: "Medienintegrität" });
    const mediaId = await source.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3]),
    });
    const complete = await source.exportAll();

    await new IndexedDbLocalMediaStorage().put({
      mediaId,
      mimeType: "audio/wav",
      sha256: complete.media[0]!.sha256,
      bytes: new Uint8Array([9, 9, 9]),
    });
    await expect(source.exportAll()).rejects.toThrow(/corrupt media/i);

    await deleteDatabase();
    const target = new LocalAppRepository(deviceB);
    await expect(target.restoreAll({ ...complete, media: [] })).rejects.toThrow(
      /missing or mismatches media/i,
    );
    expect(await target.listDecks()).toHaveLength(0);
  });

  it("preserves shared original media when its first card is deleted", async () => {
    const repository = new LocalAppRepository(deviceA);
    const deckId = await repository.saveDeck({ title: "Geteilte Medien" });
    const mediaId = createId();
    const mediaFront = {
      blocks: [
        {
          type: "image" as const,
          mediaId,
          alt: "Geteiltes Bild",
          decorative: false,
        },
      ],
    };
    const firstCardId = await repository.saveCard({
      deckId,
      front: mediaFront,
      back: "Erste Antwort",
    });
    const secondCardId = await repository.saveCard({
      deckId,
      front: mediaFront,
      back: "Zweite Antwort",
    });
    await repository.addMedia({
      id: mediaId,
      deckId,
      cardId: firstCardId,
      fileName: "original.png",
      mimeType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });

    const first = (await repository.listCards()).find(
      (card) => card.id === firstCardId,
    )!;
    await repository.deleteCard(first);

    expect(await repository.getMedia(mediaId)).not.toBeNull();
    expect((await repository.listMedia())[0]?.payload.cardId).toBe(
      secondCardId,
    );
    expect((await repository.exportAll()).media).toHaveLength(1);
  });

  it("activates a verified audio derivative and removes the replaced original bytes", async () => {
    const storage = new IndexedDbLocalMediaStorage();
    const repository = new LocalAppRepository(deviceA, storage);
    const deckId = await repository.saveDeck({ title: "Optimiertes Audio" });
    const mediaId = createId();
    const cardId = await repository.saveCard({
      deckId,
      front: {
        blocks: [
          {
            type: "audio",
            mediaId,
            label: "Beispiel",
            transcript: "",
          },
        ],
      },
      back: "Antwort",
    });
    await repository.addMedia({
      id: mediaId,
      deckId,
      cardId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    const quality = {
      durationSeconds: 1,
      integratedLufs: -16,
      truePeakDb: -2,
      sampleRate: 24_000,
      channels: 1,
    };

    const installed = await repository.installMediaDerivative({
      sourceMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([7, 8, 9]),
      engine: "test",
      engineVersion: "2",
      inputMeasurement: quality,
      outputMeasurement: quality,
    });

    expect((await repository.listCards())[0]?.payload.front).toMatchObject({
      blocks: [expect.objectContaining({ mediaId })],
    });
    expect(await repository.getMedia(mediaId)).toBeNull();
    expect((await repository.getPlayableMedia(mediaId))?.bytes).toEqual(
      new Uint8Array([7, 8, 9]),
    );
    expect(await repository.listAudioDerivatives(mediaId)).toHaveLength(1);
    expect(
      (await repository.listMedia()).map((media) => media.id).sort(),
    ).toEqual([mediaId, installed.outputMediaId].sort());
    const original = (
      await repository.authority.listEntities({ includeDeleted: true })
    ).find((entity) => entity.winningMutation.entityId === mediaId);
    expect(original?.winningMutation.operation).toBe("UPSERT");
    expect(await repository.cleanupActivatedAudioOriginals()).toBe(0);
    expect(await storage.get(mediaId)).toBeNull();

    await repository.installMediaDerivative({
      sourceMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([7, 8, 9]),
      engine: "test",
      engineVersion: "2",
      inputMeasurement: quality,
      outputMeasurement: quality,
    });
    expect(await repository.listAudioDerivatives(mediaId)).toHaveLength(1);

    const journal = await repository.authority.listMutationJournal();
    const transfers = await Promise.all(
      (await repository.peerMediaInventory(24 * 1024)).map(
        async (descriptor) => ({
          descriptor,
          source: await repository.peerMediaBytes(descriptor.mediaId),
        }),
      ),
    );
    await deleteDatabase();
    const peer = new LocalAppRepository(
      deviceB,
      new IndexedDbLocalMediaStorage(),
    );
    await peer.authority.applyRemoteMutations(journal);
    for (const { descriptor, source } of transfers) {
      expect(source).not.toBeNull();
      expect(
        await peer.acceptPeerMediaChunk({
          ...descriptor,
          index: 0,
          bytes: source!.bytes,
        }),
      ).toBe(true);
    }
    expect(await peer.getMedia(mediaId)).toBeNull();
    expect((await peer.getPlayableMedia(mediaId))?.bytes).toEqual(
      new Uint8Array([7, 8, 9]),
    );

    const backup = await peer.exportAll();
    expect(backup.media.map((entry) => entry.mediaId)).toEqual([
      installed.outputMediaId,
    ]);
    await deleteDatabase();
    const restored = new LocalAppRepository(deviceA);
    await restored.restoreAll(backup);
    expect(await restored.getMedia(mediaId)).toBeNull();
    expect((await restored.getPlayableMedia(mediaId))?.bytes).toEqual(
      new Uint8Array([7, 8, 9]),
    );
  });

  it("keeps original audio when the optimized replacement is not intact", async () => {
    const storage = new IndexedDbLocalMediaStorage();
    const repository = new LocalAppRepository(deviceA, storage);
    const deckId = await repository.saveDeck({ title: "Audiointegrität" });
    const mediaId = await repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    const original = (await storage.get(mediaId))!;
    const quality = {
      durationSeconds: 1,
      integratedLufs: -16,
      truePeakDb: -2,
      sampleRate: 24_000,
      channels: 1,
    };
    const installed = await repository.installMediaDerivative({
      sourceMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([7, 8, 9]),
      engine: "test",
      engineVersion: "2",
      inputMeasurement: quality,
      outputMeasurement: quality,
    });
    await storage.put(original);
    await storage.put({
      mediaId: installed.outputMediaId,
      mimeType: "audio/mp4",
      sha256: "0".repeat(64),
      bytes: new Uint8Array([9, 9, 9]),
    });

    expect(await repository.cleanupActivatedAudioOriginals()).toBe(0);
    expect((await storage.get(mediaId))?.bytes).toEqual(original.bytes);
  });

  it("permanently deletes an audio derivative together with its deck", async () => {
    const storage = new IndexedDbLocalMediaStorage();
    const repository = new LocalAppRepository(deviceA, storage);
    const deckId = await repository.saveDeck({ title: "Audio löschen" });
    const mediaId = createId();
    const cardId = await repository.saveCard({
      deckId,
      front: {
        blocks: [
          {
            type: "audio",
            mediaId,
            label: "Beispiel",
            transcript: "",
          },
        ],
      },
      back: "Antwort",
    });
    await repository.addMedia({
      id: mediaId,
      deckId,
      cardId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    const installed = await repository.installMediaDerivative({
      sourceMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([7, 8, 9]),
      engine: "test",
      engineVersion: "4",
      inputMeasurement: {
        durationSeconds: 1,
        integratedLufs: -16,
        truePeakDb: -2,
        sampleRate: 24_000,
        channels: 1,
      },
      outputMeasurement: {
        durationSeconds: 1,
        integratedLufs: -16,
        truePeakDb: -2,
        sampleRate: 24_000,
        channels: 1,
      },
    });

    await repository.deleteDeck((await repository.listDecks())[0]!);
    await repository.discardAllUnreferencedMedia();

    expect(await repository.listMedia()).toHaveLength(0);
    expect(await repository.listAudioDerivatives()).toHaveLength(0);
    expect(await storage.get(mediaId)).toBeNull();
    expect(await storage.get(installed.outputMediaId)).toBeNull();
    const restarted = new LocalAppRepository(deviceA, storage);
    expect(await restarted.listMedia()).toHaveLength(0);
    expect(await restarted.listAudioDerivatives()).toHaveLength(0);
  });

  it("resumes an interrupted peer media transfer after a repository restart", async () => {
    const storage = new IndexedDbLocalMediaStorage();
    const repository = new LocalAppRepository(deviceA, storage);
    const deckId = await repository.saveDeck({ title: "Fortsetzbares Audio" });
    const bytes = Uint8Array.from(
      { length: 24 * 1024 + 7 },
      (_value, index) => index % 251,
    );
    const mediaId = await repository.addMedia({
      deckId,
      fileName: "lang.wav",
      mimeType: "audio/wav",
      bytes,
    });
    const reference = (await repository.listMedia())[0]!;
    await storage.delete(mediaId);

    const descriptor = {
      mediaId,
      mimeType: reference.payload.mimeType,
      sha256: reference.payload.sha256,
      byteSize: reference.payload.byteSize,
      chunkCount: 2,
    };
    expect(
      await repository.acceptPeerMediaChunk({
        ...descriptor,
        index: 0,
        bytes: bytes.subarray(0, 24 * 1024),
      }),
    ).toBe(false);

    const restarted = new LocalAppRepository(deviceB, storage);
    expect(await restarted.peerMediaMissingChunks(descriptor)).toEqual([1]);
    expect(
      await restarted.acceptPeerMediaChunk({
        ...descriptor,
        index: 1,
        bytes: bytes.subarray(24 * 1024),
      }),
    ).toBe(true);
    expect((await restarted.getMedia(mediaId))?.bytes).toEqual(bytes);
    expect(await storage.listChunks(mediaId)).toEqual([]);
  });

  it("merges concurrent settings patches without losing either change", async () => {
    const repository = new LocalAppRepository(deviceA);
    const fallback = {
      theme: "SYSTEM" as const,
      locale: "de",
      dailyGoal: 20,
      pagePinchZoom: false,
      textToSpeechMode: "sentence-and-choices" as const,
      showQuestionWithAnswer: true,
    };

    await Promise.all([
      repository.patchSettings({ theme: "DARK" }, fallback),
      repository.patchSettings({ locale: "en" }, fallback),
      repository.patchSettings({ pagePinchZoom: true }, fallback),
    ]);

    expect((await repository.settings())?.payload).toMatchObject({
      theme: "DARK",
      locale: "en",
      pagePinchZoom: true,
    });

    const journalSize = (await repository.authority.listMutationJournal())
      .length;
    await Promise.all(
      Array.from({ length: 20 }, () =>
        repository.patchSettings({ locale: "en" }, fallback),
      ),
    );
    expect(await repository.authority.listMutationJournal()).toHaveLength(
      journalSize,
    );
  });

  it("persists Anki correction profiles as independent synced settings with tombstones", async () => {
    const repository = new LocalAppRepository(deviceA);
    const now = "2026-08-13T20:00:00.000Z";
    const profile = {
      schemaVersion: 2 as const,
      id: "00000000-0000-4000-8000-000000000390",
      name: "Rare correction",
      description: "Only for an exceptional note type",
      createdAt: now,
      updatedAt: now,
      rules: [
        {
          id: "rule",
          noteTypeName: "Exceptional",
          requiredFields: ["Question", "Answer"],
          noteTypeSignature: null,
          sourceDeckPath: null,
          sourceTemplate: null,
          outputs: [
            {
              id: "card",
              name: "Question to answer",
              frontTemplate: "[[Question]]",
              backTemplate: "[[Answer]]",
              frontSections: [],
              backSections: [],
              requiredNonEmptyFields: ["Question", "Answer"],
              direction: "SOURCE_TO_TARGET" as const,
              linkedToPrevious: false,
              targetDeckPath: null,
            },
          ],
        },
      ],
    };

    await repository.saveAnkiImportProfile(profile);
    await repository.saveAnkiImportProfile(profile);
    expect(await repository.listAnkiImportProfiles()).toEqual([
      expect.objectContaining({
        id: profile.id,
        version: 1,
        payload: { kind: "ANKI_IMPORT_PROFILE", profile },
      }),
    ]);
    expect(await repository.authority.listOutbox()).toHaveLength(1);

    const journal = await repository.authority.listMutationJournal();
    await deleteDatabase();
    const peer = new LocalAppRepository(deviceB);
    await peer.authority.applyRemoteMutations(journal);
    await peer.authority.applyRemoteMutations(journal);
    expect((await peer.listAnkiImportProfiles())[0]?.payload.profile.name).toBe(
      "Rare correction",
    );

    await peer.deleteAnkiImportProfile(profile.id);
    expect(await peer.listAnkiImportProfiles()).toEqual([]);
    expect(
      (await peer.authority.listEntities({ includeDeleted: true })).find(
        (entity) => entity.winningMutation.entityId === profile.id,
      )?.winningMutation.operation,
    ).toBe("DELETE");
  });
});
