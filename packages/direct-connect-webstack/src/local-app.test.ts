import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

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
      schedulerVersion: "ts-fsrs@5.4.1",
      cardId,
      deckId,
    });
    expect(review?.parameters.length).toBeGreaterThan(10);
    expect(await repository.authority.listOutbox()).toHaveLength(6);

    const backup = localAppBackupEnvelopeSchema.parse(
      await repository.exportAll(),
    );
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
});
