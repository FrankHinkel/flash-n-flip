import type {
  AccountShareSession,
  CardKind,
  CardState,
  ChangePasswordInput,
  ConfirmPairingSession,
  CreateAccountShareSession,
  CreateAccountShareSignal,
  CreateAutomaticConnectionSession,
  CreatePairingSession,
  CreatePairingSignal,
  DeckStudyOrder,
  Device,
  GeographyMapId,
  JoinAccountShareSession,
  PublicationStatus,
  RegisterDevice,
  ReviewEvent,
  ReviewRating,
  Role,
  ResetPasswordInput,
  SyncMutation,
  UpdateDevice,
} from "@flashcards/domain";
import type { AnkiImportProfileSelection } from "@flashcards/domain/anki-import-profile";
export type {
  AnkiImportProfile,
  AnkiImportProfileSelection,
  AnkiProfileOutput,
  AnkiProfileRule,
} from "@flashcards/domain/anki-import-profile";
import type {
  JoinPairingSession,
  PairingSessionState,
  PairingSessionMode,
  PairingSignal,
} from "@flashcards/domain/device-sync";
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

export type DevicePairing = {
  id: string;
  deviceAId: string;
  deviceBId: string;
  createdAt: string;
  confirmedAt: string;
  revokedAt: string | null;
};

export type PairingSessionDetails = {
  id: string;
  initiatorDeviceId: string;
  joiningDeviceId: string | null;
  state: PairingSessionState;
  mode: PairingSessionMode;
  initiatorEphemeralPublicKey: string;
  initiatorFingerprintProof: string;
  joiningEphemeralPublicKey: string | null;
  joiningFingerprintProof: string | null;
  initiatorConfirmed: boolean;
  joiningConfirmed: boolean;
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
};

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
    | { kind: "IMAGE"; value: string }
    | null;
  sourceTemplateKey: string | null;
  version: number;
  updatedAt: string;
  cardCount: number;
  reviewedCardCount: number;
  progressUnits?: {
    kind: "CATEGORY";
    total: number;
    reviewed: number;
  };
  cardDirections?: Record<
    string,
    { cardCount: number; reviewedCardCount: number }
  >;
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

export type NumberCollectionTemplate = {
  title: string;
  description: string;
  languageCount: number;
  categoryCount: number;
  ranges: readonly [10, 100, 1_000, 1_000_000];
  installedDeckId: string | null;
};

export type GermanVerbTemplate = {
  title: string;
  description: string;
  verbCount: number;
  cardCount: number;
  installedDeckId: string | null;
};

export type ConjugationTemplate = {
  title: string;
  description: string;
  languageCount: number;
  verbCount: number;
  cardCount: number;
  deckCount: number;
  locales: Array<"de" | "es" | "en" | "fr">;
  languages: Array<{
    locale: "de" | "es" | "en" | "fr";
    code: "DE" | "ES" | "EN" | "FR";
    title: string;
    verbCount: number;
  }>;
  installedDeckId: string | null;
};

export type IrregularVerbTemplate = ConjugationTemplate;

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

export type DeckCardPage = DeckDetail & {
  cardPage: {
    page: number;
    pageSize: number;
    totalCards: number;
    totalPages: number;
  };
};

export type DeckEditorCommitInput = {
  mutationId: string;
  version: number;
  deck: {
    parentDeckId?: string | null;
    title?: string;
    description?: string;
    language?: string;
    sourceLocale?: string;
    targetLocale?: string;
    studyOrder?: DeckStudyOrder;
    tags?: string[];
    visual?: DeckSummary["visual"];
  };
  createdCards: Array<{
    id: string;
    noteId: string;
    front: CardContent;
    back: CardContent;
    kind: CardKind;
    linkedToPrevious: boolean;
  }>;
  updatedCards: Array<{
    id: string;
    front: CardContent;
    back: CardContent;
    kind: CardKind;
    linkedToPrevious: boolean;
    version: number;
  }>;
  deletedCards: Array<{ id: string; version: number }>;
  cardOrder: {
    cardIds: string[];
    cardPage: number;
    cardPageSize: number;
    cardSearch?: string;
  };
};

export type DueCard = {
  card: Card;
  virtualCard?: XefjordCrossLanguageCardRef;
  virtualContent?: XefjordCrossLanguagePresentation;
  studyMode: "LEARNING" | "REFERENCE";
  lastRating: ReviewRating | null;
  state: CardState;
  preview: Record<ReviewRating, CardState>;
};

export type XefjordCrossLanguagePresentation = {
  questionEnglish?: CardContent;
  answerEnglish?: CardContent;
};

export type XefjordCrossLanguageMode =
  "SOURCE_TO_TARGET" | "TARGET_TO_SOURCE" | "MIXED";

export type XefjordCrossLanguageCardRef = {
  kind: "XEFJORD_CROSS_LANGUAGE_V1";
  questionDeckId: string;
  answerDeckId: string;
  matchKey: string;
};

export type XefjordCrossLanguageDeck = {
  id: string;
  collectionDeckId: string;
  title: string;
  locale: string;
};

export type XefjordCrossLanguagePair = {
  source: XefjordCrossLanguageDeck;
  target: XefjordCrossLanguageDeck;
  views: {
    sourceToTarget: XefjordCrossLanguageView;
    targetToSource: XefjordCrossLanguageView;
    mixed: XefjordCrossLanguageView;
  };
};

export type XefjordCrossLanguageView = {
  mode: XefjordCrossLanguageMode;
  cardCount: number;
  reviewedCardCount: number;
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
  audioOptimization: {
    normalized: number;
    transcoded: number;
    originalFallbacks: number;
    invalidSkipped: number;
    bytesSaved: number;
  };
  packageVersion: "legacy" | "latest";
  schedulingImported: false;
};

export type AnkiFieldRole =
  | "PRIMARY_A"
  | "PRIMARY_B"
  | "MEDIA_A"
  | "MEDIA_B"
  | "HINT"
  | "HINT_MEDIA"
  | "CATEGORY"
  | "ORDER"
  | "SOURCE_ID"
  | "IGNORE";

export type AnkiImportPreview = {
  sha256: string;
  cached: boolean;
  fileName: string;
  collectionTitle: string;
  packageVersion: "legacy" | "latest";
  deckCount: number;
  cardCount: number;
  noteCount: number;
  sourceHierarchy: {
    detected: boolean;
    maximumDepth: number;
    decks: Array<{
      sourceDeckId: string;
      path: string[];
      cardCount: number;
    }>;
    paths: Array<{
      path: string[];
      cardCount: number;
    }>;
    hiddenPathCount: number;
  };
  noteTypes: Array<{
    sourceNoteTypeId: string;
    name: string;
    isCloze: boolean;
    cardCount: number;
    fields: Array<{
      name: string;
      sample: string;
      sampleValues: string[];
      distinctValueCount: number;
      mediaKinds: Array<"image" | "audio">;
      mediaCount: number;
      suggestedRole: AnkiFieldRole;
    }>;
    templates: Array<{
      ord: number;
      name: string;
      questionFields: string[];
      answerFields: string[];
    }>;
  }>;
  mediaGroups: Array<{
    id: string;
    sourceNoteTypeId: string;
    fieldName: string;
    kind: "image" | "audio";
    fileCount: number;
    byteSize: number;
    defaultIncluded: boolean;
  }>;
  coverCandidates: Array<{ sourceName: string; byteSize: number }>;
  omittedExecutableAssets: true;
  xefjordPreset: {
    detected: boolean;
    directImportAvailable: boolean;
    suggestedSourceLocale: string | null;
    suggestedTargetLocale: string | null;
  };
  warnings: string[];
};

export type AnkiImportProgress =
  | { phase: "hashing"; percent: number | null }
  | { phase: "uploading"; percent: number | null }
  | { phase: "processing" };

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

  private async uploadFormData<T>(
    path: string,
    body: FormData,
    onProgress: (progress: AnkiImportProgress) => void,
    retry = true,
  ): Promise<T> {
    const tokens = await this.tokenStore?.get();
    return new Promise<T>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `${this.baseUrl}${path}`);
      request.withCredentials = true;
      if (tokens?.accessToken) {
        request.setRequestHeader(
          "authorization",
          `Bearer ${tokens.accessToken}`,
        );
      }
      request.upload.onprogress = (event) => {
        onProgress({
          phase: "uploading",
          percent: event.lengthComputable
            ? Math.min(100, Math.round((event.loaded / event.total) * 100))
            : null,
        });
      };
      request.upload.onload = () => onProgress({ phase: "processing" });
      request.onerror = () => reject(new ApiError("Network request failed", 0));
      request.onabort = () => reject(new ApiError("Request aborted", 0));
      request.onload = async () => {
        let details: unknown;
        try {
          details = request.responseText
            ? (JSON.parse(request.responseText) as unknown)
            : undefined;
        } catch {
          details = undefined;
        }
        if (request.status === 401 && retry && tokens?.refreshToken) {
          const refreshed = await this.refresh(tokens.refreshToken).catch(
            () => null,
          );
          if (refreshed) {
            await this.tokenStore?.set(refreshed);
            this.uploadFormData<T>(path, body, onProgress, false).then(
              resolve,
              reject,
            );
            return;
          }
        }
        if (request.status === 401 && tokens) {
          await this.tokenStore?.set(null);
        }
        if (request.status < 200 || request.status >= 300) {
          const message =
            details && typeof details === "object" && "message" in details
              ? String(details.message)
              : `Request failed (${request.status})`;
          reject(new ApiError(message, request.status, details));
          return;
        }
        resolve(details as T);
      };
      onProgress({ phase: "uploading", percent: 0 });
      request.send(body);
    });
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

  changePassword(input: ChangePasswordInput) {
    return this.request<void>("/auth/password/change", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createPasswordRecoveryCode() {
    return this.request<{ recoveryCode: string; expiresAt: string }>(
      "/auth/password/recovery-code",
      { method: "POST" },
    );
  }

  async resetPassword(input: ResetPasswordInput) {
    const result = await this.request<AuthResponse>("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await this.tokenStore?.set(result);
    return result;
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

  getDeckCardPage(
    deckId: string,
    page: number,
    pageSize = 1_000,
    search?: string,
  ) {
    const query = new URLSearchParams({
      cardPage: String(page),
      cardPageSize: String(pageSize),
    });
    if (search?.trim()) query.set("cardSearch", search.trim());
    return this.request<DeckCardPage>(
      `/decks/${encodeURIComponent(deckId)}?${query.toString()}`,
    );
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

  commitDeckEditor(deckId: string, input: DeckEditorCommitInput) {
    return this.request<DeckCardPage>(
      `/decks/${encodeURIComponent(deckId)}/editor-commit`,
      { method: "POST", body: JSON.stringify(input) },
    );
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

  checkAnkiPackageCache(sha256: string) {
    return this.request<{ cached: boolean }>(
      `/imports/apkg/cache/${encodeURIComponent(sha256)}`,
    );
  }

  previewCachedAnkiPackage(sha256: string, fileName: string) {
    const query = new URLSearchParams({ fileName });
    return this.request<AnkiImportPreview>(
      `/imports/apkg/preview/${encodeURIComponent(sha256)}?${query.toString()}`,
    );
  }

  uploadAnkiPackagePreview(
    file: Blob,
    fileName: string,
    sha256: string,
    onProgress?: (progress: AnkiImportProgress) => void,
  ) {
    const body = new FormData();
    body.append("file", file, fileName);
    const query = new URLSearchParams({ sha256 });
    const path = `/imports/apkg/preview?${query.toString()}`;
    if (onProgress && typeof XMLHttpRequest !== "undefined") {
      return this.uploadFormData<AnkiImportPreview>(path, body, onProgress);
    }
    return this.request<AnkiImportPreview>(path, {
      method: "POST",
      body,
    });
  }

  commitAnkiPackage(input: {
    sha256: string;
    fileName: string;
    sourceLocale: string;
    targetLocale?: string;
    mappings: Record<string, Record<string, AnkiFieldRole>>;
    subdeckFields: Record<string, string[]>;
    includedSourceDeckIds: string[];
    includedMediaGroupIds: string[];
    coverSourceName?: string;
    profileSelection?: AnkiImportProfileSelection;
  }) {
    return this.request<AnkiImportResult>("/imports/apkg/commit", {
      method: "POST",
      body: JSON.stringify(input),
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

  conjugationTemplate() {
    return this.request<ConjugationTemplate>("/decks/templates/conjugations");
  }

  installConjugationCollection() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/conjugations/install", {
      method: "POST",
    });
  }

  irregularVerbTemplate() {
    return this.request<IrregularVerbTemplate>(
      "/decks/templates/irregular-verbs",
    );
  }

  installIrregularVerbCollection() {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
    }>("/decks/templates/irregular-verbs/install", {
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

  numberCollectionTemplate() {
    return this.request<NumberCollectionTemplate>("/decks/templates/numbers");
  }

  installNumberCollection(input: {
    sourceLocale: string;
    targetLocale: string;
    maximum: 10 | 100 | 1_000 | 1_000_000;
    uiLocale: "en" | "de";
  }) {
    return this.request<{
      installedDeckIds: string[];
      selectedDeckId: string;
      pairDeckId: string;
    }>("/decks/templates/numbers/install", {
      method: "POST",
      body: JSON.stringify(input),
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

  async exportFlashNFlipPackage(deckId: string): Promise<Blob> {
    const response = await this.requestResponse(
      `/decks/${encodeURIComponent(deckId)}/export/fnf`,
      { method: "POST" },
    );
    return response.blob();
  }

  importFlashNFlipPackage(file: Blob, fileName: string) {
    const body = new FormData();
    body.append("file", file, fileName);
    return this.request<{
      deckId: string;
      importedDecks: number;
      importedCards: number;
      importedMedia: number;
      formatVersion: 2;
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

  reorderCardPage(
    deckId: string,
    input: {
      cardIds: string[];
      version: number;
      cardPage: number;
      cardPageSize?: number;
    },
  ) {
    return this.request<DeckCardPage>(`/decks/${deckId}/cards/order`, {
      method: "PATCH",
      body: JSON.stringify({ cardPageSize: 1_000, ...input }),
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

  due(deckId?: string, includeAll = false, includeNew = true) {
    const params = new URLSearchParams();
    if (deckId) params.set("deckId", deckId);
    if (includeAll) params.set("includeAll", "true");
    if (!includeNew) params.set("includeNew", "false");
    const query = params.size ? `?${params}` : "";
    return this.request<DueCard[]>(`/study/due${query}`);
  }

  xefjordCrossLanguageDecks() {
    return this.request<{ languages: XefjordCrossLanguageDeck[] }>(
      "/study/xefjord/languages",
    );
  }

  xefjordCrossLanguagePair(sourceDeckId: string, targetDeckId: string) {
    const params = new URLSearchParams({ sourceDeckId, targetDeckId });
    return this.request<XefjordCrossLanguagePair>(
      `/study/xefjord/pair?${params}`,
    );
  }

  xefjordCrossLanguageDue(
    input: {
      sourceDeckId: string;
      targetDeckId: string;
      mode: XefjordCrossLanguageMode;
      questionEnglish?: boolean;
      answerEnglish?: boolean;
    },
    includeAll = false,
  ) {
    const params = new URLSearchParams({
      xefjordSourceDeckId: input.sourceDeckId,
      xefjordTargetDeckId: input.targetDeckId,
      xefjordMode: input.mode,
    });
    if (input.questionEnglish) params.set("xefjordQuestionEnglish", "true");
    if (input.answerEnglish) params.set("xefjordAnswerEnglish", "true");
    if (includeAll) params.set("includeAll", "true");
    return this.request<DueCard[]>(`/study/due?${params}`);
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
    virtualCard?: XefjordCrossLanguageCardRef;
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

  registerDevice(input: RegisterDevice) {
    return this.request<Device>("/devices", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listDevices() {
    return this.request<{ devices: Device[]; pairings: DevicePairing[] }>(
      "/devices",
    );
  }

  updateDevice(deviceId: string, input: UpdateDevice) {
    return this.request<Device>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  revokeDevice(deviceId: string) {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
  }

  createPairingSession(input: CreatePairingSession) {
    return this.request<PairingSessionDetails>("/pairing/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createAutomaticConnectionSession(input: CreateAutomaticConnectionSession) {
    return this.request<PairingSessionDetails>("/device-connections/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getPendingAutomaticConnectionSession(deviceId: string) {
    return this.request<{ session: PairingSessionDetails | null }>(
      `/device-connections/sessions/pending?deviceId=${encodeURIComponent(deviceId)}`,
    );
  }

  getPairingSession(sessionId: string, deviceId: string) {
    return this.request<PairingSessionDetails>(
      `/pairing/sessions/${encodeURIComponent(
        sessionId,
      )}?deviceId=${encodeURIComponent(deviceId)}`,
    );
  }

  joinPairingSession(sessionId: string, input: JoinPairingSession) {
    return this.request<PairingSessionDetails>(
      `/pairing/sessions/${encodeURIComponent(sessionId)}/join`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  confirmPairingSession(sessionId: string, input: ConfirmPairingSession) {
    return this.request<PairingSessionDetails>(
      `/pairing/sessions/${encodeURIComponent(sessionId)}/confirm`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  cancelPairingSession(sessionId: string, deviceId: string) {
    return this.request<void>(
      `/pairing/sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: "POST", body: JSON.stringify({ deviceId }) },
    );
  }

  sendPairingSignal(sessionId: string, input: CreatePairingSignal) {
    return this.request<PairingSignal>(
      `/pairing/sessions/${encodeURIComponent(sessionId)}/signals`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  listPairingSignals(sessionId: string, deviceId: string, afterSequence = 0) {
    const query = new URLSearchParams({
      deviceId,
      afterSequence: String(afterSequence),
    });
    return this.request<{ afterSequence: number; signals: PairingSignal[] }>(
      `/pairing/sessions/${encodeURIComponent(sessionId)}/signals?${query}`,
    );
  }

  createAccountShare(input: CreateAccountShareSession) {
    return this.request<AccountShareSession>("/account-shares", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  joinAccountShare(sessionId: string, input: JoinAccountShareSession) {
    return this.request<AccountShareSession>(
      `/account-shares/${encodeURIComponent(sessionId)}/join`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  getAccountShare(sessionId: string, deviceId: string) {
    return this.request<AccountShareSession>(
      `/account-shares/${encodeURIComponent(
        sessionId,
      )}?deviceId=${encodeURIComponent(deviceId)}`,
    );
  }

  confirmAccountShare(sessionId: string, senderDeviceId: string) {
    return this.request<AccountShareSession>(
      `/account-shares/${encodeURIComponent(sessionId)}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ senderDeviceId }),
      },
    );
  }

  completeAccountShare(sessionId: string, recipientDeviceId: string) {
    return this.request<AccountShareSession>(
      `/account-shares/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ recipientDeviceId }),
      },
    );
  }

  cancelAccountShare(sessionId: string, deviceId: string) {
    return this.request<void>(
      `/account-shares/${encodeURIComponent(sessionId)}/cancel`,
      { method: "POST", body: JSON.stringify({ deviceId }) },
    );
  }

  sendAccountShareSignal(sessionId: string, input: CreateAccountShareSignal) {
    return this.request<PairingSignal>(
      `/account-shares/${encodeURIComponent(sessionId)}/signals`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  listAccountShareSignals(
    sessionId: string,
    deviceId: string,
    afterSequence = 0,
  ) {
    const query = new URLSearchParams({
      deviceId,
      afterSequence: String(afterSequence),
    });
    return this.request<{ afterSequence: number; signals: PairingSignal[] }>(
      `/account-shares/${encodeURIComponent(sessionId)}/signals?${query}`,
    );
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
