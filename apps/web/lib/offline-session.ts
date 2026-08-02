import { ApiError, type AuthTokens } from "@flashcards/api-client";

export const canUseCachedSession = (
  cause: unknown,
  tokens: AuthTokens | null,
): boolean =>
  Boolean(tokens) && (!(cause instanceof ApiError) || cause.status !== 401);
