import "fake-indexeddb/auto";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createId } from "@flashcards/domain";
import type { LocalAppBackupPart } from "@flashcards/domain/local-app-data";

import { LocalAppRepository } from "./local-app";
import {
  IndexedDbLocalAuthorityStorage,
  NativeSqliteLocalAuthorityStorage,
  webLocalAuthorityDatabaseName,
} from "./local-authority-storage";
import { NativeSqliteLocalMediaStorage } from "./media-storage";

// The bridge is replaced; SQL, constraints and file durability are real SQLite.
// This does not substitute for Capacitor/iOS force-quit acceptance on hardware.
type Plugin = NonNullable<
  ConstructorParameters<typeof NativeSqliteLocalAuthorityStorage>[0]
>;
const disposables: Array<() => void> = [];
const deviceId = "00000000-0000-4000-8000-000000000901";
const reviewedAt = new Date("2026-10-02T08:00:00.000Z");

function databaseFixture() {
  const directory = mkdtempSync(join(tmpdir(), "fnf-real-sqlite-"));
  disposables.push(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "local.sqlite");
  const name = createId();
  const connect = () => {
    const database = new DatabaseSync(path);
    database.exec("PRAGMA foreign_keys = ON");
    let active = false;
    let wroteInTransaction = false;
    let closed = false;
    let failOutboxOnce = false;
    let loseCommitReplyOnce = false;
    const close = () => {
      if (!closed) database.close();
      closed = true;
    };
    disposables.push(close);
    const plugin: Plugin = {
      async createConnection() {},
      async isDBOpen() {
        return { result: !closed };
      },
      async open() {},
      async execute({ statements, transaction }) {
        if (transaction) {
          database.exec("BEGIN");
          active = true;
        }
        try {
          database.exec(statements!);
          if (transaction) {
            database.exec("COMMIT");
            active = false;
          }
          return { changes: { changes: 0 } };
        } catch (cause) {
          if (active) {
            database.exec("ROLLBACK");
            active = false;
          }
          throw cause;
        }
      },
      async beginTransaction() {
        database.exec("BEGIN");
        active = true;
        wroteInTransaction = false;
        return { changes: { changes: 0 } };
      },
      async commitTransaction() {
        database.exec("COMMIT");
        active = false;
        if (loseCommitReplyOnce && wroteInTransaction) {
          loseCommitReplyOnce = false;
          throw new Error("Bridge reply lost after durable COMMIT");
        }
        return { changes: { changes: 0 } };
      },
      async rollbackTransaction() {
        database.exec("ROLLBACK");
        active = false;
        return { changes: { changes: 0 } };
      },
      async isTransactionActive() {
        return { result: active };
      },
      async run({ statement, values }) {
        if (
          failOutboxOnce &&
          statement!.includes("INSERT OR IGNORE INTO local_authority_outbox")
        ) {
          failOutboxOnce = false;
          throw new Error("Injected outbox write failure");
        }
        const result = database
          .prepare(statement!)
          .run(...((values ?? []) as SQLInputValue[]));
        if (active) wroteInTransaction = true;
        return {
          changes: {
            changes: Number(result.changes),
            lastId: Number(result.lastInsertRowid),
          },
        };
      },
      async query({ statement, values }) {
        const rows = database
          .prepare(statement!)
          .all(...((values ?? []) as SQLInputValue[]));
        return {
          values: [{ ios_columns: Object.keys(rows[0] ?? {}) }, ...rows],
        };
      },
    };
    const storage = new NativeSqliteLocalAuthorityStorage(plugin, name);
    const media = new NativeSqliteLocalMediaStorage(plugin, name);
    return {
      storage,
      media,
      close,
      repository: new LocalAppRepository(deviceId, media, storage),
      failOutbox() {
        failOutboxOnce = true;
      },
      loseCommitReply() {
        loseCommitReplyOnce = true;
      },
    };
  };
  return { connect };
}

async function learningFixture(repository: LocalAppRepository) {
  const deckId = await repository.saveDeck({ title: "Real SQLite" });
  const cardId = await repository.saveCard({
    deckId,
    front: "Question",
    back: "Answer",
  });
  return { deckId, cardId, reviewId: createId() };
}

afterEach(async () => {
  while (disposables.length) disposables.pop()!();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("native adapters against file-backed SQLite", () => {
  it("does not play an audio derivative from a previous source revision", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId } = await learningFixture(source.repository);
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    const quality = {
      durationSeconds: 1,
      integratedLufs: -16,
      truePeakDb: -2,
      sampleRate: 24000,
      channels: 1,
    };
    const oldDerivative = await source.repository.installMediaDerivative({
      sourceMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: new Uint8Array([4, 5, 6]),
      engine: "test",
      engineVersion: "1",
      inputMeasurement: quality,
      outputMeasurement: quality,
    });
    const reference = (await source.repository.listMedia()).find(
      (m) => m.id === mediaId,
    )!;
    const replacement = new Uint8Array([7, 8, 9]);
    await source.repository.installLocalPackage({
      mutations: [],
      media: [
        {
          id: mediaId,
          deckId,
          cardId: null,
          fileName: "updated.wav",
          mimeType: "audio/wav",
          bytes: replacement,
          baseVersion: reference.version,
        },
      ],
    });
    source.close();
    const restarted = fixture.connect();
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(replacement);
    const updatedDerivative = await restarted.repository.installMediaDerivative(
      {
        sourceMediaId: mediaId,
        mimeType: "audio/mp4",
        bytes: new Uint8Array([10, 11]),
        engine: "test",
        engineVersion: "1",
        inputMeasurement: quality,
        outputMeasurement: quality,
      },
    );
    expect(updatedDerivative.outputMediaId).not.toBe(
      oldDerivative.outputMediaId,
    );
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(new Uint8Array([10, 11]));
  });
  it("retains an activated audio derivative after a lost durable COMMIT reply", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId } = await learningFixture(source.repository);
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    const quality = {
      durationSeconds: 1,
      integratedLufs: -16,
      truePeakDb: -2,
      sampleRate: 24000,
      channels: 1,
    };
    const input = {
      sourceMediaId: mediaId,
      mimeType: "audio/mp4" as const,
      bytes: new Uint8Array([4, 5, 6]),
      engine: "test",
      engineVersion: "1",
      inputMeasurement: quality,
      outputMeasurement: quality,
    };
    source.loseCommitReply();
    await expect(
      source.repository.installMediaDerivative(input),
    ).rejects.toThrow("Bridge reply lost");
    source.close();
    const restarted = fixture.connect();
    const derivative = (
      await restarted.repository.listAudioDerivatives(mediaId)
    )[0]!;
    expect(derivative).toBeDefined();
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(input.bytes);
    const outbox = await restarted.repository.authority.listOutbox();
    expect(await restarted.repository.installMediaDerivative(input)).toEqual({
      derivativeId: derivative.id,
      outputMediaId: derivative.payload.outputMediaId,
    });
    expect(await restarted.repository.authority.listOutbox()).toEqual(outbox);
    expect(
      (await restarted.repository.exportAll()).media.map((m) => m.dataBase64),
    ).toEqual(["BAUG"]);
  });
  it("retains newly added media after a lost durable COMMIT reply", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId } = await learningFixture(source.repository);
    const mediaId = createId();
    source.loseCommitReply();
    await expect(
      source.repository.addMedia({
        id: mediaId,
        deckId,
        fileName: "original.wav",
        mimeType: "audio/wav",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow("Bridge reply lost");
    source.close();
    const restarted = fixture.connect();
    expect((await restarted.repository.listMedia()).map((m) => m.id)).toEqual([
      mediaId,
    ]);
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect((await restarted.repository.exportAll()).media[0]?.dataBase64).toBe(
      "AQID",
    );
  });
  it("serializes concurrent reads and cleanup with media publication", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId } = await learningFixture(source.repository);
    const original = new Uint8Array([1, 2, 3]);
    const replacement = new Uint8Array([4, 5, 6]);
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: original,
    });
    const reference = (await source.repository.listMedia())[0]!;
    const put = source.media.put.bind(source.media);
    let staged!: () => void;
    const staging = new Promise<void>((resolve) => {
      staged = resolve;
    });
    let publish!: () => void;
    const publication = new Promise<void>((resolve) => {
      publish = resolve;
    });
    vi.spyOn(source.media, "put").mockImplementation(async (media) => {
      await put(media);
      if (
        media.mediaId === mediaId &&
        media.sha256 !== reference.payload.sha256
      ) {
        staged();
        await publication;
      }
    });
    const installation = source.repository.installLocalPackage({
      mutations: [],
      media: [
        {
          id: mediaId,
          deckId,
          cardId: null,
          fileName: "replacement.wav",
          mimeType: "audio/wav",
          bytes: replacement,
          baseVersion: reference.version,
        },
      ],
    });
    await staging;
    let readSettled = false;
    let cleanupSettled = false;
    const reading = source.repository.getMedia(mediaId).then((value) => {
      readSettled = true;
      return value;
    });
    const cleaning = source.repository
      .discardAllUnreferencedMedia()
      .then((value) => {
        cleanupSettled = true;
        return value;
      });
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      expect(readSettled).toBe(false);
      expect(cleanupSettled).toBe(false);
    } finally {
      publish();
    }
    await installation;
    expect((await reading)?.bytes).toEqual(replacement);
    await cleaning;
    source.close();
    const restarted = fixture.connect();
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(replacement);
    await restarted.repository.discardAllUnreferencedMedia();
    expect(
      (await restarted.repository.exportAll()).media.map((m) => m.dataBase64),
    ).toEqual(["BAUG"]);
  });
  it("recovers the old media after interruption between replacement staging and metadata publication", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId } = await learningFixture(source.repository);
    const original = new Uint8Array([1, 2, 3]);
    const replacement = new Uint8Array([4, 5, 6]);
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes: original,
    });
    const reference = (await source.repository.listMedia())[0]!;
    const put = source.media.put.bind(source.media);
    vi.spyOn(source.media, "put").mockImplementation(async (media) => {
      await put(media);
      if (media.mediaId === mediaId) {
        source.close();
        throw new Error("Process ended after replacement staging");
      }
    });
    await expect(
      source.repository.installLocalPackage({
        mutations: [],
        media: [
          {
            id: mediaId,
            deckId,
            cardId: null,
            fileName: "replacement.wav",
            mimeType: "audio/wav",
            bytes: replacement,
            baseVersion: reference.version,
          },
        ],
      }),
    ).rejects.toThrow("Process ended");
    const restarted = fixture.connect();
    expect(
      (await restarted.repository.getPlayableMedia(mediaId))?.bytes,
    ).toEqual(original);
    expect((await restarted.repository.exportAll()).media[0]?.dataBase64).toBe(
      "AQID",
    );
    await restarted.repository.discardAllUnreferencedMedia();
    expect((await restarted.repository.getMedia(mediaId))?.bytes).toEqual(
      original,
    );
  });
  it.each(["lost reply", "outbox rollback"])(
    "keeps the winning bytes when an existing media update encounters %s",
    async (failure) => {
      const fixture = databaseFixture();
      const source = fixture.connect();
      const { deckId } = await learningFixture(source.repository);
      const original = new Uint8Array([1, 2, 3]);
      const replacement = new Uint8Array([4, 5, 6]);
      const mediaId = await source.repository.addMedia({
        deckId,
        fileName: "original.wav",
        mimeType: "audio/wav",
        bytes: original,
      });
      const reference = (await source.repository.listMedia())[0]!;
      if (failure === "lost reply") source.loseCommitReply();
      else source.failOutbox();
      await expect(
        source.repository.installLocalPackage({
          mutations: [],
          media: [
            {
              id: mediaId,
              deckId,
              cardId: null,
              fileName: "replacement.wav",
              mimeType: "audio/wav",
              bytes: replacement,
              baseVersion: reference.version,
            },
          ],
        }),
      ).rejects.toThrow(
        failure === "lost reply" ? "reply lost" : "outbox write failure",
      );
      source.close();
      const restarted = fixture.connect();
      expect((await restarted.repository.getMedia(mediaId))?.bytes).toEqual(
        failure === "lost reply" ? replacement : original,
      );
    },
  );
  it.each(["lost reply", "outbox rollback"])(
    "resumes an atomic package after %s and reopening without duplicate mutations",
    async (failure) => {
      const fixture = databaseFixture();
      const source = fixture.connect();
      const { deckId } = await learningFixture(source.repository);
      const deck = (await source.repository.listDecks())[0]!;
      const mediaId = createId();
      const bytes = new Uint8Array([1, 2, 3, 255]);
      const input = {
        idempotency: { key: createId(), requestHash: "a".repeat(64) },
        mutations: [
          {
            entityId: deckId,
            entityType: "DECK",
            operation: "UPSERT",
            baseVersion: deck.version,
            payload: deck.payload,
          },
        ],
        media: [
          {
            id: mediaId,
            deckId,
            cardId: null,
            fileName: "test.wav",
            mimeType: "audio/wav",
            bytes,
          },
        ],
      } as Parameters<LocalAppRepository["installLocalPackage"]>[0];
      if (failure === "lost reply") source.loseCommitReply();
      else source.failOutbox();
      await expect(
        source.repository.installLocalPackage(input),
      ).rejects.toThrow(
        failure === "lost reply" ? "reply lost" : "outbox write failure",
      );
      source.close();
      const restarted = fixture.connect();
      expect(
        await restarted.repository.authority.hasCommitReceipt(
          input.idempotency!.key,
          input.idempotency!.requestHash,
        ),
      ).toBe(failure === "lost reply");
      const journalBefore =
        await restarted.repository.authority.listMutationJournal();
      await restarted.repository.installLocalPackage(input);
      expect((await restarted.repository.getMedia(mediaId))?.bytes).toEqual(
        bytes,
      );
      const journal =
        await restarted.repository.authority.listMutationJournal();
      expect(journal.length).toBe(
        journalBefore.length + (failure === "lost reply" ? 0 : 2),
      );
      const outbox = await restarted.repository.authority.listOutbox();
      await restarted.repository.installLocalPackage(input);
      expect(
        await restarted.repository.authority.listMutationJournal(),
      ).toEqual(journal);
      expect(await restarted.repository.authority.listOutbox()).toEqual(outbox);
      await expect(
        restarted.repository.installLocalPackage({
          ...input,
          idempotency: { ...input.idempotency!, requestHash: "b".repeat(64) },
        }),
      ).rejects.toThrow("different request");
    },
  );
  it("retains verified staging after a publication rollback and safely resumes after reopening", async () => {
    const source = databaseFixture().connect();
    const { deckId } = await learningFixture(source.repository);
    const bytes = new Uint8Array([1, 2, 3, 255]);
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "original.wav",
      mimeType: "audio/wav",
      bytes,
    });
    const backup = await source.repository.exportAll();
    source.close();
    const fixture = databaseFixture();
    const target = fixture.connect();
    target.failOutbox();
    await expect(target.repository.restoreAll(backup)).rejects.toThrow(
      "outbox write failure",
    );
    target.close();
    const restarted = fixture.connect();
    expect(await restarted.repository.listDecks()).toEqual([]);
    expect(await restarted.repository.authority.listMutationJournal()).toEqual(
      [],
    );
    expect((await restarted.media.get(mediaId))?.bytes).toEqual(bytes);
    await restarted.repository.restoreAll(backup);
    expect((await restarted.repository.listDecks())[0]?.id).toBe(deckId);
    expect((await restarted.media.get(mediaId))?.bytes).toEqual(bytes);
  });

  it.each(["object", "stream"] as const)(
    "preserves restored media if publication commits but its bridge reply is lost (%s)",
    async (mode) => {
      const source = databaseFixture().connect();
      const { deckId, cardId, reviewId } = await learningFixture(
        source.repository,
      );
      const bytes = new Uint8Array([0, 1, 255, 17]);
      const mediaId = await source.repository.addMedia({
        deckId,
        fileName: "original.wav",
        mimeType: "audio/wav",
        bytes,
      });
      await source.repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId);
      const backup = await source.repository.exportAll();
      const card = await source.repository.getCard(cardId);
      source.close();
      const fixture = databaseFixture();
      const target = fixture.connect();
      async function* parts(): AsyncGenerator<LocalAppBackupPart> {
        const { media, ...header } = backup;
        for (const [key, value] of Object.entries(header))
          yield { kind: "field", key, value };
        for (const value of media) yield { kind: "media", value };
      }
      target.loseCommitReply();
      await expect(
        mode === "stream"
          ? target.repository.restoreAllFromStream(parts())
          : target.repository.restoreAll(backup),
      ).rejects.toThrow("reply lost");
      target.close();
      const restarted = fixture.connect();
      expect(await restarted.repository.getCard(cardId)).toEqual(card);
      expect(await restarted.repository.listReviews(deckId)).toHaveLength(1);
      expect((await restarted.media.get(mediaId))?.bytes).toEqual(bytes);
      expect(await restarted.repository.authority.listOutbox()).toHaveLength(
        backup.authority.payload.outboxMutationIds.length,
      );
    },
  );

  it("retains scheduler state, append-only reviews, outbox and media after closing and reopening the connection", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { deckId, cardId, reviewId } = await learningFixture(
      source.repository,
    );
    const mediaId = await source.repository.addMedia({
      deckId,
      fileName: "recording.wav",
      mimeType: "audio/wav",
      bytes: new Uint8Array([0, 1, 255, 17]),
    });
    await source.repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId);
    const card = await source.repository.getCard(cardId);
    const outbox = await source.repository.authority.listOutbox();
    const originalMedia = await source.media.get(mediaId);
    source.close();
    const restarted = fixture.connect();
    expect(await restarted.repository.getCard(cardId)).toEqual(card);
    expect(await restarted.repository.listReviews(deckId)).toHaveLength(1);
    expect(await restarted.repository.authority.listOutbox()).toEqual(outbox);
    expect(await restarted.media.get(mediaId)).toEqual(originalMedia);
    await expect(
      restarted.repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId),
    ).rejects.toThrow("already exists");
    expect(await restarted.repository.getCard(cardId)).toEqual(card);
  });

  it("rolls back progress, review, origin sequence and journal if the durable outbox write fails", async () => {
    const { repository, storage, failOutbox } = databaseFixture().connect();
    const { cardId, reviewId, deckId } = await learningFixture(repository);
    const before = await repository.exportAll();
    const beforeCard = await repository.getCard(cardId);
    const metadata = await storage.transaction("readonly", (tx) =>
      tx.getMetadata(),
    );
    failOutbox();
    await expect(
      repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId),
    ).rejects.toThrow("outbox write failure");
    expect(await repository.getCard(cardId)).toEqual(beforeCard);
    expect(await repository.listReviews(deckId)).toEqual([]);
    expect(await repository.authority.listMutationJournal()).toEqual(
      before.authority.payload.mutationJournal,
    );
    expect(await repository.authority.listOutbox()).toHaveLength(
      before.authority.payload.outboxMutationIds.length,
    );
    expect(
      await storage.transaction("readonly", (tx) => tx.getMetadata()),
    ).toEqual(metadata);
    await repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId);
    expect(await repository.listReviews(deckId)).toHaveLength(1);
  });

  it("preserves exactly one review when COMMIT succeeds but its bridge response is lost", async () => {
    const fixture = databaseFixture();
    const source = fixture.connect();
    const { cardId, reviewId, deckId } = await learningFixture(
      source.repository,
    );
    source.loseCommitReply();
    await expect(
      source.repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId),
    ).rejects.toThrow("reply lost");
    source.close();
    const { repository } = fixture.connect();
    const card = await repository.getCard(cardId);
    const outbox = await repository.authority.listOutbox();
    await expect(
      repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId),
    ).rejects.toThrow("already exists");
    expect(await repository.listReviews(deckId)).toHaveLength(1);
    expect(await repository.getCard(cardId)).toEqual(card);
    expect(await repository.authority.listOutbox()).toEqual(outbox);
  });

  it("enforces real foreign keys and unique origin sequences without partially changing metadata", async () => {
    const { repository, storage } = databaseFixture().connect();
    await learningFixture(repository);
    const before = await storage.transaction("readonly", (tx) =>
      tx.getMetadata(),
    );
    await expect(
      storage.transaction("readwrite", async (tx) => {
        await tx.putMetadata({ ...before!, nextOriginSequence: 999 });
        await tx.putOutboxMutationId(createId());
      }),
    ).rejects.toThrow(/FOREIGN KEY/i);
    const mutation = (await repository.authority.listMutationJournal())[0]!;
    await expect(
      storage.transaction("readwrite", async (tx) => {
        await tx.putMetadata({ ...before!, nextOriginSequence: 999 });
        await tx.putMutation({ ...mutation, mutationId: createId() });
      }),
    ).rejects.toThrow(/UNIQUE/i);
    expect(
      await storage.transaction("readonly", (tx) => tx.getMetadata()),
    ).toEqual(before);
  });

  it("keeps native SQL study queries and IndexedDB counts aligned, including repeated deck IDs", async () => {
    const { repository, storage } = databaseFixture().connect();
    const { deckId, cardId, reviewId } = await learningFixture(repository);
    await repository.reviewCard(cardId, "GOOD", reviewedAt, reviewId);
    const availableId = await repository.saveCard({
      deckId,
      front: "New",
      back: "Answer",
    });
    await repository.saveCard({
      deckId,
      front: "Suspended",
      back: "Answer",
      suspended: true,
    });
    const otherDeck = await repository.saveDeck({ title: "Other" });
    await repository.saveCard({
      deckId: otherDeck,
      front: "Other",
      back: "Answer",
    });
    const browserStorage = new IndexedDbLocalAuthorityStorage();
    const browser = new LocalAppRepository(deviceId, undefined, browserStorage);
    const backup = await repository.exportAll();
    await browser.restoreAll(backup);
    const query = {
      deckIds: [deckId],
      newDeckIds: [deckId],
      dueBefore: reviewedAt.toISOString(),
      introducedAfter: "2026-10-02T00:00:00.000Z",
      newLimit: 50,
      reviewLimit: 50,
      includeFutureReviews: true,
    };
    const expected = {
      dueReviews: 0,
      availableNew: 1,
      introducedToday: 1,
      introducedNoteIds: [(await repository.getCard(cardId))!.payload.noteId],
    };
    expect(await storage.countStudyCards(query)).toEqual(expected);
    expect(await browserStorage.countStudyCards(query)).toEqual(expected);
    const repeated = {
      ...query,
      deckIds: [deckId, deckId],
      newDeckIds: [deckId, deckId],
    };
    expect(await storage.countStudyCards(repeated)).toEqual(expected);
    expect(await browserStorage.countStudyCards(repeated)).toEqual(expected);
    for (const adapter of [storage, browserStorage]) {
      expect(
        (await adapter.listStudyCardEntities(repeated)).map(
          (entity) => entity.winningMutation.entityId,
        ),
      ).toEqual([cardId, availableId]);
      expect(
        await adapter.countStudyCards({
          ...repeated,
          dueBefore: "2030-01-01T00:00:00.000Z",
        }),
      ).toEqual({ ...expected, dueReviews: 1 });
    }
  });
});
