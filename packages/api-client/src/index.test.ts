import { afterEach, describe, expect, it, vi } from "vitest";

import { FlashAndFlipApi, resolveBrowserApiUrl } from "./index.js";

afterEach(() => vi.unstubAllGlobals());

describe("FlashAndFlipApi", () => {
  it("adds an access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test", {
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
      new FlashAndFlipApi("https://api.example.test").listDecks(),
    ).rejects.toEqual(expect.objectContaining({ status: 403 }));
  });

  it("clears an invalid session after refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expired access token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Session expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );
    const set = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test", {
      get: () => ({ accessToken: "expired", refreshToken: "expired-refresh" }),
      set,
    });

    await expect(api.me()).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    expect(set).toHaveBeenCalledWith(null);
  });

  it("keeps the session after a successful refresh", async () => {
    const refreshed = {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expired access token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(refreshed), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "user-id",
            email: "user@example.test",
            displayName: "Test User",
            locale: "de",
            roles: ["LEARNER"],
            createdAt: "2026-07-24T00:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    const set = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test", {
      get: () => ({ accessToken: "expired", refreshToken: "refresh" }),
      set,
    });

    await expect(api.me()).resolves.toEqual(
      expect.objectContaining({ displayName: "Test User" }),
    );
    expect(set).toHaveBeenCalledWith(refreshed);
    expect(set).not.toHaveBeenCalledWith(null);
  });

  it("requests every card explicitly for non-scheduling practice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.due("deck id", true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/study/due?deckId=deck+id&includeAll=true",
    );
  });

  it("sends an idempotent descendant reset mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          duplicate: false,
          resetCardCount: 12,
          resetAt: "2026-07-26T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.resetDeckProgress({
      mutationId: "019f0000-0000-7000-8000-000000000001",
      deckId: "019f0000-0000-7000-8000-000000000002",
      includeDescendants: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/study/reset",
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({ includeDescendants: true });
  });
});

describe("resolveBrowserApiUrl", () => {
  it("uses the same-origin proxy when a LAN browser inherits a loopback URL", () => {
    expect(resolveBrowserApiUrl("http://127.0.0.1:4000", "192.168.1.42")).toBe(
      "/api",
    );
  });

  it("keeps loopback development traffic direct on the host machine", () => {
    expect(resolveBrowserApiUrl("http://127.0.0.1:4000", "localhost")).toBe(
      "http://127.0.0.1:4000",
    );
  });

  it("keeps an explicitly configured remote API URL", () => {
    expect(
      resolveBrowserApiUrl("https://api.flash-n-flip.com", "flash-n-flip.com"),
    ).toBe("https://api.flash-n-flip.com");
  });
});
