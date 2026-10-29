import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { curatedCatalogSchema } from "@flashcards/domain/curated-catalog";
import { createId } from "@flashcards/domain";
import { webLocalAuthorityDatabaseName } from "@flashcards/direct-connect-webstack/local-authority-storage";
import {
  getLocalProductDeck,
  installLocalManagedDeckTree,
  localProductRepository,
  recordLocalProductReview,
  stableLocalTemplateUuid,
  updateLocalProductDeck,
  type LocalManagedDeckSeed,
} from "./local-product-repository";
import { updateInstalledLocalFnfHelp } from "./local-curated-catalog";

const catalogBytes = readFileSync(
  new URL("../public/curated/catalog.v2.json", import.meta.url),
);
const signature = readFileSync(
  new URL("../public/curated/catalog.v2.signature.json", import.meta.url),
);
const keys = readFileSync(
  new URL("../public/trusted-webstack-keys.json", import.meta.url),
);
const catalog = curatedCatalogSchema.parse(JSON.parse(catalogBytes.toString()));
const collection = catalog.collections.find(
  (item) => item.id === "fnf-help-library",
)!;
const abcKey = `${collection.rootKey}:abc`;

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function localBundleFetch(tampered = false) {
  return vi.fn(async (url: string) => {
    if (url === "/curated/catalog.v2.json") {
      return new Response(
        new Uint8Array(
          tampered
            ? Buffer.concat([catalogBytes, Buffer.from(" ")])
            : catalogBytes,
        ),
      );
    }
    if (url === "/curated/catalog.v2.signature.json")
      return new Response(new Uint8Array(signature));
    if (url === "/trusted-webstack-keys.json")
      return new Response(new Uint8Array(keys));
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("automatic update of installed Help", () => {
  it("does not fetch or install Help when it is absent", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(updateInstalledLocalFnfHelp()).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(await (await localProductRepository()).listDecks()).toEqual([]);
  });

  it("verifies the local bundle, retries failures, removes retired cards atomically and writes nothing on reopen", async () => {
    const old = await installLocalManagedDeckTree(
      collection.decks.map((deck) => ({
        ...deck,
        visual: deck.visual as LocalManagedDeckSeed["visual"],
        sourceContentSha256: "b".repeat(64),
        sourcePublishedAt: catalog.publishedAt,
        cards:
          deck.key === abcKey
            ? [
                ...deck.cards,
                ...["rondo-alla-turca", "the-entertainer"].map((key) => ({
                  key,
                  front: { blocks: [{ type: "text" as const, text: key }] },
                  back: { blocks: [{ type: "text" as const, text: key }] },
                  usage: "REFERENCE" as const,
                })),
              ]
            : deck.cards,
      })),
    );
    const rootId = old.idsByKey.get(collection.rootKey)!;
    const abcId = old.idsByKey.get(abcKey)!;
    const hiddenAt = "2026-10-01T00:00:00.000Z";
    await updateLocalProductDeck(rootId, { hiddenAt });
    await updateLocalProductDeck(abcId, { archivedAt: hiddenAt });
    const repository = await localProductRepository();
    const personal = await installLocalManagedDeckTree([
      {
        ...collection.decks[0]!,
        key: "personal:test",
        parentKey: null,
        title: "Personal study deck",
        visual: undefined,
        tags: [],
        cards: [
          {
            key: "personal-card",
            front: { blocks: [{ type: "text", text: "Question" }] },
            back: { blocks: [{ type: "text", text: "Answer" }] },
          },
        ],
      },
    ]);
    const personalId = personal.idsByKey.get("personal:test")!;
    const personalCard = (await getLocalProductDeck(personalId))!.cards[0]!;
    await recordLocalProductReview({
      mutationId: createId(),
      cardId: personalCard.id,
      rating: "GOOD",
      reviewedAt: "2026-10-26T10:00:00.000Z",
    });
    const personalBefore = (await repository.listCards()).find(
      (card) => card.id === personalCard.id,
    );
    const retainedIds = (await getLocalProductDeck(abcId))!.cards
      .slice(0, 13)
      .map((card) => card.id);
    const before = await repository.authority.listMutationJournal();

    vi.stubGlobal("fetch", localBundleFetch(true));
    await expect(updateInstalledLocalFnfHelp()).rejects.toThrow();
    expect(await repository.authority.listMutationJournal()).toHaveLength(
      before.length,
    );
    expect((await getLocalProductDeck(abcId))?.cards).toHaveLength(15);

    const fetch = localBundleFetch();
    vi.stubGlobal("fetch", fetch);
    const commit = vi
      .spyOn(repository.authority, "commitLocalMutations")
      .mockRejectedValueOnce(new Error("Interrupted transaction"));
    await expect(updateInstalledLocalFnfHelp()).rejects.toThrow(
      "Interrupted transaction",
    );
    expect(await repository.authority.listMutationJournal()).toHaveLength(
      before.length,
    );
    expect((await getLocalProductDeck(abcId))?.cards).toHaveLength(15);
    commit.mockRestore();
    const changes = vi.fn();
    window.addEventListener("flash-n-flip:decks-changed", changes);
    const first = updateInstalledLocalFnfHelp();
    expect(updateInstalledLocalFnfHelp()).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(changes).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
      "/curated/catalog.v2.json",
      "/curated/catalog.v2.signature.json",
      "/trusted-webstack-keys.json",
    ]);
    const updated = (await getLocalProductDeck(abcId))!;
    expect(updated.cards.map((card) => card.id)).toEqual(retainedIds);
    expect(
      (await repository.listCards()).find(
        (card) => card.id === personalCard.id,
      ),
    ).toEqual(personalBefore);
    const decks = await repository.listDecks();
    expect(decks.find((deck) => deck.id === rootId)?.payload).toMatchObject({
      hiddenAt,
      sourceContentSha256: collection.contentSha256,
    });
    expect(decks.find((deck) => deck.id === abcId)?.payload.archivedAt).toBe(
      hiddenAt,
    );
    const retiredIds = await Promise.all(
      ["rondo-alla-turca", "the-entertainer"].map((key) =>
        stableLocalTemplateUuid(`deck:${abcKey}`, `card:${key}`),
      ),
    );
    const after = await repository.authority.listMutationJournal();
    expect(
      after.filter(
        (mutation) =>
          retiredIds.includes(mutation.entityId) &&
          mutation.operation === "DELETE",
      ),
    ).toHaveLength(2);
    await expect(updateInstalledLocalFnfHelp()).resolves.toBe(false);
    expect(await repository.authority.listMutationJournal()).toHaveLength(
      after.length,
    );

    // Recreate runtime modules as on a new launch; the persisted hashes alone
    // must prevent another write, with no volatile success flag to rely on.
    vi.resetModules();
    const reopened = await import("./local-curated-catalog");
    await expect(reopened.updateInstalledLocalFnfHelp()).resolves.toBe(false);
    expect(await repository.authority.listMutationJournal()).toHaveLength(
      after.length,
    );
  });
});
