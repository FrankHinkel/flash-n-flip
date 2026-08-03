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

  it("loads and installs the multilingual conjugation collection", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ installedDeckIds: [], selectedDeckId: "root" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.conjugationTemplate();
    await api.installConjugationCollection();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks/templates/conjugations",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.example.test/decks/templates/conjugations/install",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the confirmed Anki mapping, media selection and languages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          deckIds: [],
          primaryDeckId: "deck-id",
          collectionDeckId: "collection-id",
          collectionTitle: "Spanish",
          importedDecks: 1,
          importedCards: 1,
          importedMedia: 0,
          warnings: [],
          packageVersion: "legacy",
          schedulingImported: false,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.commitAnkiPackage({
      sha256: "a".repeat(64),
      fileName: "spanish.apkg",
      sourceLocale: "es",
      targetLocale: "de",
      mappings: { "100": { Deutsch: "PRIMARY_A", Spanisch: "PRIMARY_B" } },
      subdeckFields: { "100": ["Einheit"] },
      includedSourceDeckIds: ["200", "201"],
      includedMediaGroupIds: ["100:AudioS:audio"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/imports/apkg/commit",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST", body: expect.any(String) }),
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      mappings: {
        "100": { Deutsch: "PRIMARY_A", Spanisch: "PRIMARY_B" },
      },
      subdeckFields: { "100": ["Einheit"] },
      includedSourceDeckIds: ["200", "201"],
    });
  });

  it("reports APKG upload percentage before server-side processing", async () => {
    const progress: Array<
      | { phase: "hashing"; percent: number | null }
      | { phase: "uploading"; percent: number | null }
      | { phase: "processing" }
    > = [];
    class FakeXMLHttpRequest {
      readonly upload: {
        onprogress: ((event: ProgressEvent) => void) | null;
        onload: (() => void) | null;
      } = { onprogress: null, onload: null };
      status = 201;
      responseText = JSON.stringify({
        sha256: "a".repeat(64),
        cached: false,
        fileName: "spanish.apkg",
        collectionTitle: "Spanish",
        deckCount: 1,
        cardCount: 15_000,
        noteCount: 7_500,
        noteTypes: [],
        mediaGroups: [],
        coverCandidates: [],
        omittedExecutableAssets: true,
        warnings: [],
        packageVersion: "legacy",
      });
      withCredentials = false;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 42,
          total: 100,
        } as ProgressEvent);
        this.upload.onload?.();
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    vi.stubGlobal("fetch", vi.fn());
    const api = new FlashAndFlipApi("https://api.example.test");

    await api.uploadAnkiPackagePreview(
      new Blob(["PK\u0003\u0004"]),
      "spanish.apkg",
      "a".repeat(64),
      (nextProgress) => progress.push(nextProgress),
    );

    expect(progress).toEqual([
      { phase: "uploading", percent: 0 },
      { phase: "uploading", percent: 42 },
      { phase: "processing" },
    ]);
    expect(fetch).not.toHaveBeenCalled();
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

  it("loads and installs developer reference templates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "git",
              title: "Git Developer Reference",
              description: "Reference",
              deckCount: 3,
              cardCount: 30,
              installedDeckId: null,
              entryDeckId: null,
            },
          ]),
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

    await expect(api.developerReferenceTemplates()).resolves.toEqual([
      expect.objectContaining({ id: "git", cardCount: 30 }),
    ]);
    await expect(
      api.installDeveloperReferenceDeck("git"),
    ).resolves.toMatchObject({ selectedDeckId: "collection-id" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks/templates/developer-references",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.example.test/decks/templates/developer-references/git/install",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("loads and installs the combined developer reference library", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "Developer Reference Library",
            description: "Reference library",
            categoryCount: 8,
            technologyCount: 21,
            deckCount: 104,
            cardCount: 545,
            installedDeckId: null,
            migrationAvailable: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            installedDeckIds: ["library-id", "category-id", "deck-id"],
            selectedDeckId: "deck-id",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new FlashAndFlipApi("https://api.example.test");

    await expect(
      api.developerReferenceLibraryTemplate(),
    ).resolves.toMatchObject({
      technologyCount: 21,
      cardCount: 545,
      migrationAvailable: true,
    });
    await expect(api.installDeveloperReferenceLibrary()).resolves.toMatchObject(
      { selectedDeckId: "deck-id" },
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/decks/templates/developer-reference-library",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.example.test/decks/templates/developer-reference-library/install",
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
