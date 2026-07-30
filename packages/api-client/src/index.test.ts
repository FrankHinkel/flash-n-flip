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

  it("requests hidden decks only for library management", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.listDecks(true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks?includeHidden=true",
    );
  });

  it("requests archived decks only for trash management", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.listDecks(true, true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks?includeHidden=true&includeArchived=true",
    );
  });

  it("loads and installs the KaTeX reference template", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "KaTeX Developer Reference",
            description: "Reference",
            deckCount: 15,
            cardCount: 45,
            installedDeckId: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            installedDeckIds: ["collection-id", "deck-id"],
            selectedDeckId: "collection-id",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await expect(api.katexReferenceTemplate()).resolves.toMatchObject({
      deckCount: 15,
      cardCount: 45,
    });
    await expect(api.installKatexReferenceDeck()).resolves.toMatchObject({
      selectedDeckId: "collection-id",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks/templates/katex-reference",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.example.test/decks/templates/katex-reference/install",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updates deck visibility without deleting content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "019f0000-0000-7000-8000-000000000001",
          hiddenAt: "2026-07-26T00:00:00.000Z",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.setDeckHidden("019f0000-0000-7000-8000-000000000001", true);

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/visibility");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      hidden: true,
    });
  });

  it("moves a deck to trash through the authenticated DELETE transport", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.deleteDeck("019f0000-0000-7000-8000-000000000001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/decks/019f0000-0000-7000-8000-000000000001",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("restores a deck from trash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ restoredDeckIds: ["deck-id"] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.restoreDeck("deck-id");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/decks/deck-id/restore",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("permanently deletes a trashed deck through an explicit endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.permanentlyDeleteDeck("deck-id");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/decks/deck-id/permanent",
      expect.objectContaining({ method: "DELETE" }),
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
