import { ApiError } from "@flashcards/api-client";

export type StudySyncStatus = "offline" | "problem" | null;

const isConnectivityFailure = (cause: unknown): boolean =>
  (cause instanceof ApiError && cause.status === 0) ||
  cause instanceof TypeError;

export function studySyncStatusForFailures(
  failures: readonly unknown[],
): StudySyncStatus {
  if (failures.length === 0) return null;
  return failures.every(isConnectivityFailure) ? "offline" : "problem";
}

export function studySyncStatusAfterSuccess(
  pendingReviewCount: number,
): StudySyncStatus {
  return pendingReviewCount > 0 ? "problem" : null;
}
