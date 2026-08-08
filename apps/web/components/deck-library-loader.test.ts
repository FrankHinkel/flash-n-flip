import { describe, expect, it } from "vitest";

import type { DeckSummary } from "@flashcards/api-client";

import { loadDeckLibraryStaleWhileRevalidate } from "./deck-library-loader";

const summary = (reviewedCardCount: number): DeckSummary => ({
  id: "019fdc89-8972-7f87-9432-c2451869cf5e",
  parentDeckId: null,
  title: "Japanese",
  description: "",
  language: "ja",
  contentLocales: ["ja", "en"],
  defaultContentLocale: "ja",
  sourceLocale: "en",
  targetLocale: "ja",
  protectionMode: "ACCOUNT_BOUND",
  tags: [],
  favorite: false,
  hiddenAt: null,
  archivedAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: "2026-08-08T12:00:00.000Z",
  cardCount: 100,
  reviewedCardCount,
  storageBytes: 10_000,
});

describe("deck library stale-while-revalidate loading", () => {
  it("publishes cached aggregates before the remote refresh finishes", async () => {
    const cached = summary(17);
    const fresh = summary(18);
    const published: DeckSummary[][] = [];
    let confirmCached: (() => void) | undefined;
    const cachedPublished = new Promise<void>((resolve) => {
      confirmCached = resolve;
    });
    let releaseRemote: ((decks: DeckSummary[]) => void) | undefined;
    const remote = new Promise<DeckSummary[]>((resolve) => {
      releaseRemote = resolve;
    });
    let stored = [cached];

    const loading = loadDeckLibraryStaleWhileRevalidate({
      loadCached: async () => stored,
      loadRemote: async () => remote,
      cacheRemote: async (decks) => {
        stored = decks;
      },
      repairCachedHierarchy: async () => false,
      publish: (decks) => {
        published.push(decks);
        if (published.length === 1) confirmCached?.();
      },
    });

    await cachedPublished;
    expect(published).toEqual([[cached]]);

    releaseRemote?.([fresh]);
    await expect(loading).resolves.toEqual({
      remoteAvailable: true,
      hasDecks: true,
    });
    expect(published).toEqual([[cached], [fresh]]);
  });

  it("keeps cached aggregates visible when the remote refresh fails", async () => {
    const cached = summary(17);
    const published: DeckSummary[][] = [];

    await expect(
      loadDeckLibraryStaleWhileRevalidate({
        loadCached: async () => [cached],
        loadRemote: async () => {
          throw new Error("offline");
        },
        cacheRemote: async () => undefined,
        repairCachedHierarchy: async () => false,
        publish: (decks) => published.push(decks),
      }),
    ).resolves.toEqual({ remoteAvailable: false, hasDecks: true });
    expect(published).toEqual([[cached]]);
  });

  it("uses the server result if an unexpectedly empty cache read follows persistence", async () => {
    const fresh = summary(18);
    const published: DeckSummary[][] = [];

    await expect(
      loadDeckLibraryStaleWhileRevalidate({
        loadCached: async () => [],
        loadRemote: async () => [fresh],
        cacheRemote: async () => undefined,
        repairCachedHierarchy: async () => false,
        publish: (decks) => published.push(decks),
      }),
    ).resolves.toEqual({ remoteAvailable: true, hasDecks: true });
    expect(published).toEqual([[fresh]]);
  });

  it("reports an unavailable empty library without publishing a false snapshot", async () => {
    const published: DeckSummary[][] = [];

    await expect(
      loadDeckLibraryStaleWhileRevalidate({
        loadCached: async () => [],
        loadRemote: async () => {
          throw new Error("offline");
        },
        cacheRemote: async () => undefined,
        repairCachedHierarchy: async () => false,
        publish: (decks) => published.push(decks),
      }),
    ).resolves.toEqual({ remoteAvailable: false, hasDecks: false });
    expect(published).toEqual([]);
  });
});
