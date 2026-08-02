import { describe, expect, it } from "vitest";

import { ApiError, type AuthTokens } from "@flashcards/api-client";

import { canUseCachedSession } from "./offline-session";

const tokens: AuthTokens = { accessToken: "access", refreshToken: "refresh" };

describe("offline session fallback", () => {
  it("keeps a locally authenticated learner signed in after a network failure", () => {
    expect(canUseCachedSession(new TypeError("Failed to fetch"), tokens)).toBe(
      true,
    );
    expect(canUseCachedSession(new ApiError("Offline", 0), tokens)).toBe(true);
  });

  it("does not bypass an explicit unauthorized response or missing tokens", () => {
    expect(canUseCachedSession(new ApiError("Unauthorized", 401), tokens)).toBe(
      false,
    );
    expect(canUseCachedSession(new TypeError("Failed to fetch"), null)).toBe(
      false,
    );
  });
});
