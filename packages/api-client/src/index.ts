import type {
  CardKind,
  CardState,
  DeckStudyOrder,
  GeographyMapId,
  PublicationStatus,
  ReviewEvent,
  ReviewRating,
  Role,
  SyncMutation,
} from "@flashcards/domain";
import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
  passwordChangeRequired: boolean;
};

export type AuthResponse = AuthTokens & { user: AuthUser };

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  locale: "de" | "en";
  passwordChangeRequired: boolean;
  createdAt: string;
};

export type DeckSummary = {
  id: string;
  parentDeckId: string | null;
  title: string;
  description: string;
  language: string;
  contentLocales: string[];
  defaultContentLocale: string;
  sourceLocale: string;
  targetLocale: string;
  studyOrder?: DeckStudyOrder;
  protectionMode: "STANDARD" | "ACCOUNT_BOUND";
  tags: string[];
  favorite: boolean;
  hiddenAt: string | null;
  archivedAt: string | null;
  visual:
    | { kind: "GLOBE"; value: "world" }
    | {
        kind: "MAP";
        value: GeographyMapId;
      }
    | { kind: "FLAG"; value: string }
    | null;
  sourceTemplateKey: string | null;
  version: number;
  updatedAt: string;
  cardCount: number;
  reviewedCardCount: number;
  storageBytes: number;
};

export type GeographyTemplate = {
  id: GeographyMapId;
  parentId: GeographyMapId | null;
  titles: Record<"en" | "de" | "es" | "fr", string>;
  descriptions: Record<"en" | "de" | "es" | "fr", string>;
  visual: NonNullable<DeckSummary["visual"]>;
  regionCount: number;
  installedDeckId: string | null;
};

export type GermanVerbTemplate = {
  title: string;
  description: string;
  verbCount: number;
  cardCount: number;
  installedDeckId: string | null;
};

export type CoreLanguageTemplate = {
  title: string;
  description: string;
  conceptCount: number;
  cardCount: number;
  locales: Array<"en" | "de" | "fr" | "es">;
  installedDeckId: string | null;
};

export type KatexReferenceTemplate = {
  title: string;
  description: string;
  deckCount: number;
  cardCount: number;
  installedDeckId: string | null;
};

export type DeveloperReferenceLibraryTemplate = {
  title: string;
  description: string;
  categoryCount: number;
  technologyCount: number;
  deckCount: number;
  cardCount: number;
  installedDeckId: string | null;
  migrationAvailable: boolean;
};

export type DeveloperReferenceTemplate = {
  id:
    | "git"
    | "docker"
    | "kubernetes"
    | "cmd"
    | "powershell"
    | "bash-zsh"
    | "pip3"
    | "composer"
    | "xpath"
    | "jsonpath"
    | "http-curl"
    | "sql"
    | "regex"
    | "jq"
    | "yaml"
    | "ssh-tools"
    | "node-package-managers"
    | "linux-toolbox"
    | "github-actions"
    | "postgresql";
  title: string;
  description: string;
  deckCount: number;
  cardCount: number;
  installedDeckId: string | null;
  entryDeckId: string | null;
};

export type Card = {
  id: string;
  deckId: string;
  noteId: string;
  front: CardContent;
  back: CardContent;
  questionLocale?: string | null;
  answerLocale?: string | null;
  translations: LocalizedCardContents;
  kind?: CardKind;
  position?: number;
  linkedToPrevious?: boolean;
  version: number;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeckDetail = Omit<
  DeckSummary,
  "cardCount" | "reviewedCardCount" | "storageBytes"
> & {
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
      sourceLocale?: string;
      targetLocale?: string;
      cards: Array<{
        id: string;
        front: CardContent;
        back: CardContent;
        questionLocale?: string | null;
        answerLocale?: string | null;
      }>;
    };
  };
  authorName: string;
};

export type AnkiImportResult = {
  deckIds: string[];
  primaryDeckId: string;
  collectionDeckId: string;
  collectionTitle: string;
  importedDecks: number;
  importedCards: number;
  importedMedia: number;
  detectedLanguageCards: number;
  removedLanguageMarkers: number;
  detectedDirections: Record<string, number>;
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

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export const resolveBrowserApiUrl = (
  configuredUrl: string,
  browserHostname?: string,
): string => {
  if (!browserHostname || loopbackHosts.has(browserHostname)) {
    return configuredUrl;
  }
  try {
    return loopbackHosts.has(new URL(configuredUrl).hostname)
      ? "/api"
      : configuredUrl;
  } catch {
    return configuredUrl;
  }
};

export type TokenStore = {
  get(): AuthTokens | null | Promise<AuthTokens | null>;
  set(tokens: AuthTokens | null): void | Promise<void>;
};

export class FlashAndFlipApi {
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
    if (response.status === 401 && tokens) {
      await this.tokenStore?.set(null);
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

  changeRequiredPassword(input: {
    newPassword: string;
    termsAccepted: true;
    privacyAcknowledged: true;
    locale: "de" | "en";
  }) {
    return this.request<void>("/auth/password/change-required", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async adminAccess(accessPassword: string, deviceName: string) {
    const result = await this.request<AuthResponse>("/auth/admin-access", {
      method: "POST",
      body: JSON.stringify({ accessPassword, deviceName }),
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
      passwordChangeRequired: boolean;
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

  listDecks(includeHidden = false, includeArchived = false) {
    const query = new URLSearchParams();
    if (includeHidden) query.set("includeHidden", "true");
    if (includeArchived) query.set("includeArchived", "true");
    return this.request<DeckSummary[]>(
      `/decks${query.size ? `?${query}` : ""}`,
    );
  }

  getDeck(deckId: string) {
    return this.request<DeckDetail>(`/decks/${deckId}`);
  }

  createDeck(input: {
    parentDeckId?: string | null;
    title: string;
    description?: string;
    language?: string;
    contentLocales?: string[];
    defaultContentLocale?: string;
    sourceLocale?: string;
    targetLocale?: string;
    studyOrder?: DeckStudyOrder;
    protectionMode?: "STANDARD" | "ACCOUNT_BOUND";
    tags?: string[];
    visual?: DeckSummary["visual"];
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
    return this.request<void>(`/decks/${encodeURIComponent(deckId)}`, {
      method: "DELETE",
    });
  }

  restoreDeck(deckId: string) {
    return this.request<{ restoredDeckIds: string[] }>(
      `/decks/${encodeURIComponent(deckId)}/restore`,
      { method: "POST" },
    );
  }

  permanentlyDeleteDeck(deckId: string) {
    return this.request<void>(
      `/decks/${encodeURIComponent(deckId)}/permanent`,
      { method: "DELETE" },
    );
  }

  importCards(input: {
    title: string;
    description?: string;
    language?: string;
    sourceLocale?: string;
    targetLocale?: string;
    format: "CSV" | "ANKI_TSV";
    content: string;
  }) {
    return this.request<{ deckId: string; importedCards: number }>("/imports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  importAnkiPackage(
    file: Blob,
    fileName: string,
    languageDirection: { sourceLocale: string; targetLocale?: string },
  ) {
    const body = new FormData();
    body.append("file", file, fileName);
    const query = new URLSearchParams({
      sourceLocale: languageDirection.sourceLocale,
      targetLocale:
        languageDirection.targetLocale || languageDirection.sourceLocale,
    });
    return this.request<AnkiImportResult>(`/imports/apkg?${query.toString()}`, {
      method: "POST",
      body,
    });
  }

  createEuropeDeck() {
    return this.request<DeckDetail>("/decks/templates/europe", {
      method: "POST",
    });
  }

  geographyTemplates() {
    return this.request<GeographyTemplate[]>("/decks/templates/geography");
  }

  germanVerbTemplate() {
    return this.request<GermanVerbTemplate>(
      "/decks/templates/german-irregular-verbs",
    );
  }

  installGermanVerbDeck() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/german-irregular-verbs/install", {
      method: "POST",
    });
  }

  coreLanguageTemplate() {
    return this.request<CoreLanguageTemplate>(
      "/decks/templates/core-languages",
    );
  }

  installCoreLanguageDeck() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/core-languages/install", {
      method: "POST",
    });
  }

  katexReferenceTemplate() {
    return this.request<KatexReferenceTemplate>(
      "/decks/templates/katex-reference",
    );
  }

  developerReferenceLibraryTemplate() {
    return this.request<DeveloperReferenceLibraryTemplate>(
      "/decks/templates/developer-reference-library",
    );
  }

  installDeveloperReferenceLibrary() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/developer-reference-library/install", {
      method: "POST",
    });
  }

  installKatexReferenceDeck() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/katex-reference/install", {
      method: "POST",
    });
  }

  developerReferenceTemplates() {
    return this.request<DeveloperReferenceTemplate[]>(
      "/decks/templates/developer-references",
    );
  }

  installDeveloperReferenceDeck(templateId: DeveloperReferenceTemplate["id"]) {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>(
      `/decks/templates/developer-references/${encodeURIComponent(templateId)}/install`,
      { method: "POST" },
    );
  }

  installGeographyDeck(
    templateId: GeographyTemplate["id"],
    includeChildren = false,
  ) {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>(`/decks/templates/geography/${encodeURIComponent(templateId)}/install`, {
      method: "POST",
      body: JSON.stringify({ includeChildren }),
    });
  }

  setDeckFavorite(deckId: string, favorite: boolean) {
    return this.request<{ id: string; favorite: boolean }>(
      `/decks/${encodeURIComponent(deckId)}/favorite`,
      { method: "PATCH", body: JSON.stringify({ favorite }) },
    );
  }

  setDeckHidden(deckId: string, hidden: boolean) {
    return this.request<{ id: string; hiddenAt: string | null }>(
      `/decks/${encodeURIComponent(deckId)}/visibility`,
      { method: "PATCH", body: JSON.stringify({ hidden }) },
    );
  }

  async exportFlashNFlipDeck(deckId: string): Promise<Blob> {
    const response = await this.requestResponse(
      `/decks/${encodeURIComponent(deckId)}/export/fnf`,
      { method: "POST" },
    );
    return response.blob();
  }

  importFlashNFlipDeck(file: Blob, fileName: string) {
    const body = new FormData();
    body.append("file", file, fileName);
    return this.request<{
      deckId: string;
      importedCards: number;
      importedMedia: number;
      formatVersion: 1;
    }>("/imports/fnf", { method: "POST", body });
  }

  createCard(
    deckId: string,
    input: {
      front: CardContent;
      back: CardContent;
      questionLocale?: string | null;
      answerLocale?: string | null;
      translations?: LocalizedCardContents;
      kind?: CardKind;
      linkedToPrevious?: boolean;
      tags?: string[];
    },
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
      questionLocale?: string | null;
      answerLocale?: string | null;
      translations?: LocalizedCardContents;
      kind: CardKind;
      linkedToPrevious?: boolean;
      tags?: string[];
      version: number;
    },
  ) {
    return this.request<Card>(`/decks/${deckId}/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  reorderCards(deckId: string, input: { cardIds: string[]; version: number }) {
    return this.request<DeckDetail>(`/decks/${deckId}/cards/order`, {
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

  async downloadMediaText(mediaId: string): Promise<string> {
    const response = await this.requestResponse(
      `/media/${encodeURIComponent(mediaId)}`,
    );
    return response.text();
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

  due(deckId?: string, includeAll = false) {
    const params = new URLSearchParams();
    if (deckId) params.set("deckId", deckId);
    if (includeAll) params.set("includeAll", "true");
    const query = params.size ? `?${params}` : "";
    return this.request<DueCard[]>(`/study/due${query}`);
  }

  studyConfidence(deckId: string) {
    return this.request<{ securelyRecognizedCardIds: string[] }>(
      `/study/confidence?deckId=${encodeURIComponent(deckId)}`,
    );
  }

  review(input: {
    mutationId: string;
    cardId: string;
    rating: ReviewRating;
    reviewedAt: string;
    timezone: string;
  }) {
    return this.request<{ duplicate: boolean; event: ReviewEvent }>(
      "/study/review",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  resetDeckProgress(input: {
    mutationId: string;
    deckId: string;
    includeDescendants: boolean;
  }) {
    return this.request<{
      duplicate: boolean;
      resetCardCount: number;
      resetAt: string;
    }>("/study/reset", {
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

  adminUsers() {
    return this.request<AdminUser[]>("/admin/users");
  }

  createAdminUser(input: {
    email: string;
    displayName: string;
    locale: "de" | "en";
    temporaryPassword: string;
  }) {
    return this.request<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  resetAdminUserPassword(input: { email: string; temporaryPassword: string }) {
    return this.request<AdminUser>("/admin/users/password-reset", {
      method: "POST",
      body: JSON.stringify(input),
    });
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

/** @deprecated Use FlashAndFlipApi. Kept for source compatibility. */
export const FlashCardsApi = FlashAndFlipApi;
