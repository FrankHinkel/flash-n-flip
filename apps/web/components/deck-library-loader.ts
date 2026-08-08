import type { DeckSummary } from "@flashcards/api-client";

type DeckLibraryLoader = {
  loadCached: () => Promise<DeckSummary[]>;
  loadRemote: () => Promise<DeckSummary[]>;
  cacheRemote: (decks: DeckSummary[]) => Promise<void>;
  repairCachedHierarchy: () => Promise<unknown>;
  publish: (decks: DeckSummary[]) => void;
};

export type DeckLibraryLoadResult = {
  remoteAvailable: boolean;
  hasDecks: boolean;
};

const safeCachedDecks = async (
  loadCached: DeckLibraryLoader["loadCached"],
): Promise<DeckSummary[]> => loadCached().catch(() => []);

export async function loadDeckLibraryStaleWhileRevalidate({
  loadCached,
  loadRemote,
  cacheRemote,
  repairCachedHierarchy,
  publish,
}: DeckLibraryLoader): Promise<DeckLibraryLoadResult> {
  const cached = await safeCachedDecks(loadCached);
  if (cached.length) publish(cached);

  try {
    const remote = await loadRemote();
    let refreshed = remote;
    try {
      await cacheRemote(remote);
      await repairCachedHierarchy();
      const persisted = await loadCached();
      refreshed = persisted.length || remote.length === 0 ? persisted : remote;
    } catch {
      // A successful server response remains usable even when the local cache
      // is temporarily unavailable. The next refresh retries persistence.
    }
    publish(refreshed);
    return { remoteAvailable: true, hasDecks: refreshed.length > 0 };
  } catch {
    await repairCachedHierarchy().catch(() => undefined);
    const fallback = cached.length ? cached : await safeCachedDecks(loadCached);
    if (!cached.length && fallback.length) publish(fallback);
    return { remoteAvailable: false, hasDecks: fallback.length > 0 };
  }
}
