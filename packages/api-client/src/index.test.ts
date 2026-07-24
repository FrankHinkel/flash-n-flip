import { afterEach, describe, expect, it, vi } from "vitest";

import { FlashCardsApi } from "./index.js";

afterEach(() => vi.unstubAllGlobals());

describe("FlashCardsApi", () => {
  it("adds an access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashCardsApi("https://api.example.test", {
      get: () => ({ accessToken: "access", refreshToken: "refresh" }),
      set: () => undefined,
    });
    await api.listDecks();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("authorization")).toBe(
      "Bearer access",
    );
  });

  it("surfaces server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "No access" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(
      new FlashCardsApi("https://api.example.test").listDecks(),
    ).rejects.toEqual(expect.objectContaining({ status: 403 }));
  });
});
