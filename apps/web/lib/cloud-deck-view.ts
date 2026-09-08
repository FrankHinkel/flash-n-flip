import type { CloudDeckSyncResult } from "@flashcards/direct-connect-webstack/cloud-library-runtime";

const deckToken = (deck: CloudDeckSyncResult): string =>
  `${deck.title.normalize("NFKD").toLowerCase()}\u0000${deck.deckId}`;

export function sortCloudDeckResults(
  candidates: readonly CloudDeckSyncResult[],
): CloudDeckSyncResult[] {
  const byId = new Map<string, CloudDeckSyncResult>();
  for (const candidate of candidates) byId.set(candidate.deckId, candidate);
  const paths = new Map<string, readonly string[]>();
  const pathFor = (
    deck: CloudDeckSyncResult,
    visiting = new Set<string>(),
  ): readonly string[] => {
    const cached = paths.get(deck.deckId);
    if (cached) return cached;
    const token = deckToken(deck);
    if (visiting.has(deck.deckId)) return [token];
    const nextVisiting = new Set(visiting).add(deck.deckId);
    const parent = deck.parentDeckId ? byId.get(deck.parentDeckId) : undefined;
    const path = parent ? [...pathFor(parent, nextVisiting), token] : [token];
    paths.set(deck.deckId, path);
    return path;
  };
  return [...byId.values()].sort((left, right) => {
    const leftPath = pathFor(left);
    const rightPath = pathFor(right);
    const length = Math.min(leftPath.length, rightPath.length);
    for (let index = 0; index < length; index += 1) {
      if (leftPath[index]! < rightPath[index]!) return -1;
      if (leftPath[index]! > rightPath[index]!) return 1;
    }
    return leftPath.length - rightPath.length;
  });
}

export function upsertCloudDeckResult(
  current: readonly CloudDeckSyncResult[],
  update: CloudDeckSyncResult,
): CloudDeckSyncResult[] {
  const index = current.findIndex((deck) => deck.deckId === update.deckId);
  if (index < 0) return [...current, update];
  const next = [...current];
  next[index] = update;
  return next;
}
