import type {
  CardState,
  PublicationStatus,
  ReviewRating,
  Role,
  SyncMutation,
} from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
};

export type AuthResponse = AuthTokens & { user: AuthUser };

export type DeckSummary = {
  id: string;
  title: string;
  description: string;
  language: string;
  tags: string[];
  version: number;
  updatedAt: string;
  cardCount: number;
};

export type Card = {
  id: string;
  deckId: string;
  noteId: string;
  front: CardContent;
  back: CardContent;
  version: number;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeckDetail = Omit<DeckSummary, "cardCount"> & {
  cards: Card[];
};

export type DueCard = {
  card: Card;
  state: CardState;
  preview: Record<ReviewRating, CardState>;
};

export type CommunityDeck = {
  id: string;
  slug: string;
  category: string;
  publishedAt: string | null;
  revisionId: string;
  title: string;
  description: string;
  language: string;
  tags: string[];
  authorName: string;
};

export type ModerationItem = {
  publication: {
    id: string;
    slug: string;
    category: string;
    status: PublicationStatus;
    revisionId: string;
    updatedAt: string;
  };
  revision: {
    id: string;
    number: number;
    title: string;
    description: string;
    sourceDeclarations: Array<{
      label: string;
      url?: string;
      license: string;
    }>;
    snapshot: {
      schemaVersion: number;
      cards: Array<{ id: string; front: CardContent; back: CardContent }>;
    };
  };
  authorName: string;
};

export type AnkiImportResult = {
  deckIds: string[];
  primaryDeckId: string;
  importedDecks: number;
  importedCards: number;
  importedMedia: number;
  warnings: string[];
  packageVersion: "legacy" | "latest";
  schedulingImported: false;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type TokenStore = {
  get(): AuthTokens | null | Promise<AuthTokens | null>;
  set(tokens: AuthTokens | null): void | Promise<void>;
};

export class FlashCardsApi {
  constructor(
    readonly baseUrl: string,
    private readonly tokenStore?: TokenStore,
  ) {}

  private async requestResponse(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<Response> {
    const tokens = await this.tokenStore?.get();
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
    if (tokens?.accessToken) {
      headers.set("authorization", `Bearer ${tokens.accessToken}`);
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (response.status === 401 && retry && tokens?.refreshToken) {
      const refreshed = await this.refresh(tokens.refreshToken).catch(
        () => null,
      );
      if (refreshed) {
        await this.tokenStore?.set(refreshed);
        return this.requestResponse(path, init, false);
      }
    }
    if (!response.ok) {
      const details = await response.json().catch(() => undefined);
      const message =
        details && typeof details === "object" && "message" in details
          ? String(details.message)
          : `Request failed (${response.status})`;
      throw new ApiError(message, response.status, details);
    }
    return response;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const response = await this.requestResponse(path, init, retry);
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    locale: "de" | "en";
    deviceName: string;
    termsVersion: string;
    privacyVersion: string;
  }): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await this.tokenStore?.set(result);
    return result;
  }

  async login(email: string, password: string, deviceName: string) {
    const result = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, deviceName }),
    });
    await this.tokenStore?.set(result);
    return result;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      },
      false,
    );
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" }).catch(
      () => {},
    );
    await this.tokenStore?.set(null);
  }

  async deleteAccount(): Promise<void> {
    await this.request<void>("/auth/account", { method: "DELETE" });
    await this.tokenStore?.set(null);
  }

  me() {
    return this.request<{
      id: string;
      email: string;
      displayName: string;
      locale: "de" | "en";
      roles: Role[];
      createdAt: string;
    }>("/auth/me");
  }

  updateProfile(input: { displayName?: string; locale?: "de" | "en" }) {
    return this.request<{
      id: string;
      email: string;
      displayName: string;
      locale: "de" | "en";
    }>("/auth/me", { method: "PATCH", body: JSON.stringify(input) });
  }

  listDecks() {
    return this.request<DeckSummary[]>("/decks");
  }

  getDeck(deckId: string) {
    return this.request<DeckDetail>(`/decks/${deckId}`);
  }

  createDeck(input: {
    title: string;
    description?: string;
    language?: string;
    tags?: string[];
  }) {
    return this.request<DeckDetail>("/decks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateDeck(
    deckId: string,
    input: Partial<DeckSummary> & { version: number },
  ) {
    return this.request<DeckDetail>(`/decks/${deckId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteDeck(deckId: string) {
    return this.request<void>(`/decks/${deckId}`, { method: "DELETE" });
  }

  importCards(input: {
    title: string;
    description?: string;
    language?: string;
    format: "CSV" | "ANKI_TSV";
    content: string;
  }) {
    return this.request<{ deckId: string; importedCards: number }>("/imports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  importAnkiPackage(file: Blob, fileName: string) {
    const body = new FormData();
    body.append("file", file, fileName);
    return this.request<AnkiImportResult>("/imports/apkg", {
      method: "POST",
      body,
    });
  }

  createCard(
    deckId: string,
    input: { front: CardContent; back: CardContent; tags?: string[] },
  ) {
    return this.request<Card>(`/decks/${deckId}/cards`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateCard(
    deckId: string,
    cardId: string,
    input: {
      front: CardContent;
      back: CardContent;
      tags?: string[];
      version: number;
    },
  ) {
    return this.request<Card>(`/decks/${deckId}/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteCard(deckId: string, cardId: string) {
    return this.request<void>(`/decks/${deckId}/cards/${cardId}`, {
      method: "DELETE",
    });
  }

  uploadMedia(file: Blob, fileName: string) {
    const body = new FormData();
    body.append("file", file, fileName);
    return this.request<{
      id: string;
      mimeType: string;
      byteSize: number;
    }>("/media", { method: "POST", body });
  }

  async downloadMedia(mediaId: string): Promise<Blob> {
    const response = await this.requestResponse(
      `/media/${encodeURIComponent(mediaId)}`,
    );
    return response.blob();
  }

  async authenticatedMediaSource(mediaId: string): Promise<{
    uri: string;
    headers: Record<string, string>;
  }> {
    const tokens = await this.tokenStore?.get();
    return {
      uri: `${this.baseUrl}/media/${encodeURIComponent(mediaId)}`,
      headers: tokens?.accessToken
        ? { Authorization: `Bearer ${tokens.accessToken}` }
        : {},
    };
  }

  due(deckId?: string) {
    const query = deckId ? `?deckId=${encodeURIComponent(deckId)}` : "";
    return this.request<DueCard[]>(`/study/due${query}`);
  }

  review(input: {
    mutationId: string;
    cardId: string;
    rating: ReviewRating;
    reviewedAt: string;
    timezone: string;
  }) {
    return this.request<{ duplicate: boolean }>("/study/review", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  community(q = "", category = "") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const query = params.size ? `?${params}` : "";
    return this.request<CommunityDeck[]>(`/community/decks${query}`);
  }

  communityDeck(slug: string) {
    return this.request<{
      id: string;
      slug: string;
      category: string;
      authorName: string;
      revision: ModerationItem["revision"];
    }>(`/community/decks/${encodeURIComponent(slug)}`);
  }

  submitDeck(
    deckId: string,
    input: {
      category: string;
      sources: Array<{ label: string; url?: string; license: string }>;
    },
  ) {
    return this.request<{
      publicationId: string;
      revisionId: string;
      number: number;
    }>(`/decks/${deckId}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  moderationQueue() {
    return this.request<ModerationItem[]>("/moderation/queue");
  }

  moderate(
    publicationId: string,
    nextStatus: PublicationStatus,
    reason: string,
  ) {
    return this.request<void>(`/moderation/${publicationId}/transition`, {
      method: "POST",
      body: JSON.stringify({ nextStatus, reason }),
    });
  }

  subscribe(publicationId: string) {
    return this.request<void>(`/community/${publicationId}/subscribe`, {
      method: "POST",
    });
  }

  report(
    publicationId: string,
    input: {
      cardId?: string;
      category: "INCORRECT" | "COPYRIGHT" | "HARMFUL" | "SPAM" | "OTHER";
      details: string;
    },
  ) {
    return this.request<{ id: string }>(`/community/${publicationId}/reports`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  syncPush(mutations: SyncMutation[]) {
    return this.request<{ acknowledged: string[] }>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ mutations }),
    });
  }

  syncPull(cursor?: number) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request<{
      cursor: number;
      changes: Array<{ cursor: number; mutation: SyncMutation }>;
    }>(`/sync/pull${query}`);
  }
}
