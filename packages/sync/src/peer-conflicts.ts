import type { PeerMutation } from "@flashcards/domain/device-sync";

export function latestMutableMutation(
  left: PeerMutation,
  right: PeerMutation,
): PeerMutation {
  if (left.entityId !== right.entityId) {
    throw new Error("Cannot resolve mutations for different entities");
  }
  if (left.entityType === "REVIEW" || right.entityType === "REVIEW") {
    throw new Error("Review events are merged by identity, not overwritten");
  }
  const timestampComparison = left.modifiedAt.localeCompare(right.modifiedAt);
  if (timestampComparison !== 0) return timestampComparison > 0 ? left : right;
  return left.mutationId.localeCompare(right.mutationId) >= 0 ? left : right;
}

export function mergeReviewMutations(
  local: readonly PeerMutation[],
  remote: readonly PeerMutation[],
): PeerMutation[] {
  const merged = new Map<string, PeerMutation>();
  for (const mutation of [...local, ...remote]) {
    if (mutation.entityType !== "REVIEW") {
      throw new Error("Only review mutations can be merged as review events");
    }
    merged.set(mutation.mutationId, mutation);
  }
  return [...merged.values()].sort(
    (left, right) =>
      left.modifiedAt.localeCompare(right.modifiedAt) ||
      left.mutationId.localeCompare(right.mutationId),
  );
}
