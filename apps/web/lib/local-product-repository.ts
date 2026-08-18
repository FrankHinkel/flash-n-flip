"use client";

import type {
  Card,
  DeckCardPage,
  DeckDetail,
  DeckEditorCommitInput,
  DeckSummary,
  DueCard,
  XefjordCrossLanguageCardRef,
} from "@flashcards/api-client";
import { LocalAppRepository } from "@flashcards/direct-connect-webstack/local-app";
import { getOrCreateDeviceIdentity } from "@flashcards/direct-connect-webstack/identity";
import {
  archivedDeckIds,
  createId,
  defaultStudyStrategy,
  deckDescendantIds,
  hasDeveloperReferenceTag,
  resolveCardLanguageDirection,
  projectStudyPace,
  requiredNewCardsPerStudyDay,
  studyStrategyConfigSchema,
  visibleDeckIds,
  type PeerMutation,
  type ReplicaWatermarks,
  type CardState,
  type ReviewRating,
  type StudyBadgePlan,
  type StudyPaceProjection,
  type StudyStrategyConfig,
} from "@flashcards/domain";
import {
  createNumberCollectionDeckSeeds,
  numberCollectionPairKey,
  numberCollectionSequenceFromTags,
  numberCollectionTemplate,
  numberCollectionTemplateKey,
  renderNumberExerciseCard,
} from "@flashcards/domain/number-collection";
import type {
  NumberLocale,
  NumberPracticeMaximum,
} from "@flashcards/domain/numbers";
import {
  localCardContentPlainText,
  localCardPayloadSchema,
  localDeckPayloadSchema,
  type LocalCardPayload,
  type LocalDeckPayload,
  type LocalNamedStudyPlanPayload,
  type LocalSettingsPayload,
} from "@flashcards/domain/local-app-data";
import type { LocalMutationInput } from "@flashcards/domain/local-authority";
import { automaticAnkiTemplateProfileId } from "@flashcards/domain/anki-import-profile";
import {
  selectPreferredAudioDerivative,
  type AudioQualityMeasurement,
  type LocalAudioDerivativePayload,
} from "@flashcards/domain/audio-optimization";
import {
  cardContentSchema,
  type CardContent,
} from "@flashcards/domain/content";
import {
  defaultContentStyles,
  mergeContentStyles,
  resolveContentStyles,
} from "@flashcards/domain/content-style";
import {
  buildStudyQueue,
  emptyCardState,
  previewRatings,
} from "@flashcards/scheduler";
import { maximumLocalMutationBatchSize } from "@flashcards/sync/local-authority";

import type { LocalFileImport } from "./local-file-import";
import {
  xefjordCollectionTemplateKey,
  xefjordCollectionTitle,
} from "./xefjord-deck";

let repositoryPromise: Promise<LocalAppRepository> | null = null;
let learningPlanMigrationPromise: Promise<void> | null = null;
const defaultNamedStudyPlanId = "00000000-0000-4000-8000-000000000002";
const activeNamedStudyPlanKey = "flash-n-flip.active-named-study-plan.v1";
const reverseCardMigrationKey = "flash-n-flip.reverse-card-opt-in.v1";
const incompleteLocalImportMediaKey =
  "flash-n-flip.incomplete-local-import-media.v1";
const localDeckMetricsCacheKey = "flash-n-flip.local-deck-metrics.v1";
const pendingPermanentDeckDeletesKey =
  "flash-n-flip.pending-permanent-deck-deletes.v1";
const studyResponsePaceKey = "flash-n-flip.study-response-pace.v1";
export const studyBadgeInvalidatedEvent =
  "flash-n-flip:study-badge-invalidated";

const invalidateStudyBadge = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(studyBadgeInvalidatedEvent));
};

const localDayStart = (now: Date): string => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const studySecondsPerCard = (): number => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(studyResponsePaceKey) ?? "null",
    ) as { seconds?: unknown } | null;
    return typeof stored?.seconds === "number" &&
      Number.isFinite(stored.seconds) &&
      stored.seconds >= 1 &&
      stored.seconds <= 300
      ? stored.seconds
      : 20;
  } catch {
    return 20;
  }
};

const rememberStudyResponseTime = (responseTimeMs?: number): void => {
  if (
    responseTimeMs === undefined ||
    !Number.isFinite(responseTimeMs) ||
    responseTimeMs < 1_000 ||
    responseTimeMs > 300_000
  ) {
    return;
  }
  const seconds = responseTimeMs / 1_000;
  const previous = studySecondsPerCard();
  try {
    localStorage.setItem(
      studyResponsePaceKey,
      JSON.stringify({ seconds: previous * 0.8 + seconds * 0.2 }),
    );
  } catch {
    // The estimate is derived and may safely fall back to its default.
  }
};

export type LocalDeckSummary = DeckSummary & { metricsPending?: boolean };

type LocalDeckMetrics = Pick<
  DeckSummary,
  "cardCount" | "reviewedCardCount" | "storageBytes"
>;

type PendingPermanentDeckDelete = {
  id: string;
  deckIds: string[];
  createdAt: string;
};

const readPendingPermanentDeckDeletes = (): PendingPermanentDeckDelete[] => {
  try {
    const candidate = JSON.parse(
      localStorage.getItem(pendingPermanentDeckDeletesKey) ?? "[]",
    ) as unknown;
    if (!Array.isArray(candidate)) return [];
    return candidate.filter(
      (entry): entry is PendingPermanentDeckDelete =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PendingPermanentDeckDelete).id === "string" &&
        Array.isArray((entry as PendingPermanentDeckDelete).deckIds) &&
        (entry as PendingPermanentDeckDelete).deckIds.every(
          (deckId) => typeof deckId === "string",
        ) &&
        typeof (entry as PendingPermanentDeckDelete).createdAt === "string",
    );
  } catch {
    return [];
  }
};

const writePendingPermanentDeckDeletes = (
  jobs: readonly PendingPermanentDeckDelete[],
): void => {
  localStorage.setItem(pendingPermanentDeckDeletesKey, JSON.stringify(jobs));
};

export const pendingPermanentDeleteDeckIds = (): ReadonlySet<string> =>
  new Set(readPendingPermanentDeckDeletes().flatMap((job) => job.deckIds));

const readLocalDeckMetrics = (): Map<string, LocalDeckMetrics> => {
  try {
    const candidate = JSON.parse(
      localStorage.getItem(localDeckMetricsCacheKey) ?? "{}",
    ) as Record<string, LocalDeckMetrics>;
    return new Map(
      Object.entries(candidate).filter(
        ([, value]) =>
          Number.isFinite(value.cardCount) &&
          Number.isFinite(value.reviewedCardCount) &&
          Number.isFinite(value.storageBytes),
      ),
    );
  } catch {
    return new Map();
  }
};

const writeLocalDeckMetrics = (
  metrics: ReadonlyMap<string, LocalDeckMetrics>,
): void => {
  try {
    localStorage.setItem(
      localDeckMetricsCacheKey,
      JSON.stringify(Object.fromEntries(metrics)),
    );
  } catch {
    // Derived values may always be rebuilt from authoritative local entities.
  }
};

export type LocalManagedCardSeed = {
  key: string;
  front: CardContent;
  back: CardContent;
  questionLocale?: string | null;
  answerLocale?: string | null;
  translations?: Card["translations"];
  kind?: Card["kind"];
  linkedToPrevious?: boolean;
};

export type LocalManagedDeckSeed = {
  key: string;
  parentKey: string | null;
  title: string;
  description?: string;
  language: string;
  contentLocales: string[];
  defaultContentLocale: string;
  sourceLocale: string;
  targetLocale: string;
  studyOrder?: "SCHEDULED" | "SEQUENTIAL";
  tags?: string[];
  visual?: DeckSummary["visual"];
  cards: LocalManagedCardSeed[];
};

export class LocalManagedDeckInstallLimitError extends Error {
  constructor(readonly maximumMutations: number) {
    super(
      `Collection exceeds the local limit of ${maximumMutations.toLocaleString("en-US")} changes.`,
    );
    this.name = "LocalManagedDeckInstallLimitError";
  }
}

export const assertLocalManagedDeckMutationLimit = (count: number): void => {
  if (count > maximumLocalMutationBatchSize) {
    throw new LocalManagedDeckInstallLimitError(maximumLocalMutationBatchSize);
  }
};

export const localProductRepository = (): Promise<LocalAppRepository> => {
  repositoryPromise ??= getOrCreateDeviceIdentity().then(
    (identity) => new LocalAppRepository(identity.id),
  );
  return repositoryPromise;
};

export const ensureLocalLearningPlanMigration = (): Promise<void> => {
  if (learningPlanMigrationPromise) return learningPlanMigrationPromise;
  let tracked: Promise<void>;
  tracked = (async () => {
    const repository = await localProductRepository();
    let decks = await repository.listDecks();
    const favorites = decks.filter((deck) => deck.payload.favorite);
    let migratedFavoriteIds = new Set<string>();
    const hierarchy = decks.map((deck) => ({
      id: deck.id,
      parentDeckId: deck.payload.parentDeckId,
    }));
    if (favorites.length) {
      const migratedIds = new Set(
        favorites.flatMap((deck) => [...deckDescendantIds(hierarchy, deck.id)]),
      );
      migratedFavoriteIds = migratedIds;
      const targets = decks.filter((deck) => migratedIds.has(deck.id));
      const now = new Date().toISOString();
      await repository.authority.commitLocalMutations(
        targets.map((deck) => ({
          entityId: deck.id,
          entityType: "DECK" as const,
          operation: "UPSERT" as const,
          baseVersion: deck.version,
          payload: localDeckPayloadSchema.parse({
            ...deck.payload,
            favorite: false,
            learningEnabled: true,
            updatedAt: now,
          }),
        })),
        { maximumBatchSize: maximumLocalMutationBatchSize },
      );
      decks = await repository.listDecks();
    }
    let plans = await repository.listNamedStudyPlans();
    if (!plans.length) {
      await repository.saveNamedStudyPlan({
        id: defaultNamedStudyPlanId,
        title: "Mein Lernplan",
        deckIds: [
          ...new Set(
            decks
              .filter((deck) => deck.payload.learningEnabled)
              .flatMap((deck) => [
                ...deckDescendantIds(
                  decks.map((candidate) => ({
                    id: candidate.id,
                    parentDeckId: candidate.payload.parentDeckId,
                  })),
                  deck.id,
                ),
              ]),
          ),
        ],
      });
      plans = await repository.listNamedStudyPlans();
    } else if (migratedFavoriteIds.size) {
      const target = plans[0]!;
      await repository.saveNamedStudyPlan({
        id: target.id,
        version: target.version,
        title: target.payload.title,
        deckIds: [
          ...new Set([...target.payload.deckIds, ...migratedFavoriteIds]),
        ],
        createdAt: target.payload.createdAt,
      });
      plans = await repository.listNamedStudyPlans();
    }
    try {
      const selected = localStorage.getItem(activeNamedStudyPlanKey);
      if (!selected || !plans.some((plan) => plan.id === selected)) {
        localStorage.setItem(activeNamedStudyPlanKey, plans[0]!.id);
      }
    } catch {
      // The deterministic default remains usable when storage is unavailable.
    }
    let reverseMigrationComplete = false;
    try {
      reverseMigrationComplete =
        localStorage.getItem(reverseCardMigrationKey) === "done";
    } catch {
      // Run the idempotent migration when the marker cannot be read.
    }
    if (!reverseMigrationComplete) {
      const cards = await repository.listCards();
      const candidates = cards.filter(
        (card) =>
          card.payload.importSource?.kind === "ANKI" &&
          card.payload.importSource.profileId ===
            automaticAnkiTemplateProfileId &&
          !card.payload.suspended,
      );
      const byNote = new Map<string, typeof candidates>();
      for (const card of candidates) {
        const key = `${card.payload.deckId}:${card.payload.noteId}`;
        const siblings = byNote.get(key) ?? [];
        siblings.push(card);
        byNote.set(key, siblings);
      }
      const toSuspend = [] as typeof candidates;
      for (const siblings of byNote.values()) {
        const ordered = [...siblings].sort(
          (left, right) =>
            (left.payload.importSource?.sourceTemplateOrd ?? 0) -
            (right.payload.importSource?.sourceTemplateOrd ?? 0),
        );
        for (let index = 1; index < ordered.length; index += 1) {
          const candidate = ordered[index]!;
          if (
            ordered
              .slice(0, index)
              .some(
                (previous) =>
                  JSON.stringify(candidate.payload.front) ===
                    JSON.stringify(previous.payload.back) &&
                  JSON.stringify(candidate.payload.back) ===
                    JSON.stringify(previous.payload.front) &&
                  JSON.stringify(candidate.payload.front) !==
                    JSON.stringify(candidate.payload.back),
              )
          ) {
            toSuspend.push(candidate);
          }
        }
      }
      const now = new Date().toISOString();
      for (let offset = 0; offset < toSuspend.length; offset += 1_000) {
        await repository.authority.commitLocalMutations(
          toSuspend.slice(offset, offset + 1_000).map((card) => ({
            entityId: card.id,
            entityType: "CARD" as const,
            operation: "UPSERT" as const,
            baseVersion: card.version,
            payload: localCardPayloadSchema.parse({
              ...card.payload,
              suspended: true,
              updatedAt: now,
            }),
          })),
        );
      }
      try {
        localStorage.setItem(reverseCardMigrationKey, "done");
      } catch {
        // The mutations are idempotent even without the local marker.
      }
    }
  })().finally(() => {
    if (learningPlanMigrationPromise === tracked) {
      learningPlanMigrationPromise = null;
    }
  });
  learningPlanMigrationPromise = tracked;
  return tracked;
};

export type LocalNamedStudyPlan = {
  id: string;
  version: number;
  title: string;
  deckIds: string[];
  strategy: StudyStrategyConfig;
  createdAt: string;
  updatedAt: string;
};

const publicNamedStudyPlan = (plan: {
  id: string;
  version: number;
  payload: LocalNamedStudyPlanPayload;
}): LocalNamedStudyPlan => ({
  id: plan.id,
  version: plan.version,
  title: plan.payload.title,
  deckIds: [...plan.payload.deckIds],
  strategy:
    plan.payload.kind === "NAMED_STUDY_PLAN_V2"
      ? { ...plan.payload.strategy }
      : defaultStudyStrategy(),
  createdAt: plan.payload.createdAt,
  updatedAt: plan.payload.updatedAt,
});

export async function listLocalNamedStudyPlans(): Promise<{
  plans: LocalNamedStudyPlan[];
  activePlanId: string;
}> {
  await ensureLocalLearningPlanMigration();
  const plans = (
    await (await localProductRepository()).listNamedStudyPlans()
  ).map(publicNamedStudyPlan);
  let activePlanId = plans[0]!.id;
  try {
    const selected = localStorage.getItem(activeNamedStudyPlanKey);
    if (selected && plans.some((plan) => plan.id === selected)) {
      activePlanId = selected;
    }
  } catch {
    // Use the deterministic first plan.
  }
  return { plans, activePlanId };
}

export async function setActiveLocalNamedStudyPlan(id: string): Promise<void> {
  const { plans } = await listLocalNamedStudyPlans();
  if (!plans.some((plan) => plan.id === id)) {
    throw new Error("Der Lernplan wurde nicht gefunden.");
  }
  localStorage.setItem(activeNamedStudyPlanKey, id);
  window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
}

export async function createLocalNamedStudyPlan(
  title: string,
): Promise<LocalNamedStudyPlan> {
  await ensureLocalLearningPlanMigration();
  const saved = await (
    await localProductRepository()
  ).saveNamedStudyPlan({
    id: createId(),
    title,
    deckIds: [],
  });
  await setActiveLocalNamedStudyPlan(saved.id);
  return publicNamedStudyPlan(saved);
}

export async function renameLocalNamedStudyPlan(
  id: string,
  title: string,
): Promise<void> {
  const repository = await localProductRepository();
  const existing = (await repository.listNamedStudyPlans()).find(
    (plan) => plan.id === id,
  );
  if (!existing) throw new Error("Der Lernplan wurde nicht gefunden.");
  await repository.saveNamedStudyPlan({
    id,
    version: existing.version,
    title,
    deckIds: existing.payload.deckIds,
    createdAt: existing.payload.createdAt,
  });
  window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
}

export async function updateLocalNamedStudyPlanStrategy(
  id: string,
  strategy: StudyStrategyConfig,
): Promise<void> {
  const repository = await localProductRepository();
  const existing = (await repository.listNamedStudyPlans()).find(
    (plan) => plan.id === id,
  );
  if (!existing) throw new Error("Der Lernplan wurde nicht gefunden.");
  await repository.saveNamedStudyPlan({
    id,
    version: existing.version,
    title: existing.payload.title,
    deckIds: existing.payload.deckIds,
    strategy: studyStrategyConfigSchema.parse(strategy),
    createdAt: existing.payload.createdAt,
  });
  window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
}

export async function deleteLocalNamedStudyPlan(id: string): Promise<void> {
  const repository = await localProductRepository();
  const plans = await repository.listNamedStudyPlans();
  if (plans.length <= 1) {
    throw new Error("Mindestens ein Lernplan muss erhalten bleiben.");
  }
  await repository.deleteNamedStudyPlan(id);
  const remaining = plans.filter((plan) => plan.id !== id);
  try {
    if (localStorage.getItem(activeNamedStudyPlanKey) === id) {
      localStorage.setItem(activeNamedStudyPlanKey, remaining[0]!.id);
    }
  } catch {
    // The remaining plan is selected on the next load.
  }
  window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
}

const activeNamedStudyPlan = async (
  repository: LocalAppRepository,
): Promise<LocalNamedStudyPlan> => {
  const plans = (await repository.listNamedStudyPlans()).map(
    publicNamedStudyPlan,
  );
  let selected = plans[0]!;
  try {
    selected =
      plans.find(
        (plan) => plan.id === localStorage.getItem(activeNamedStudyPlanKey),
      ) ?? selected;
  } catch {
    // Use the first synchronized plan.
  }
  return selected;
};

export async function recoverIncompleteLocalFileImport(): Promise<number> {
  let mediaIds: string[] = [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(incompleteLocalImportMediaKey) ?? "[]",
    ) as unknown;
    if (Array.isArray(parsed)) {
      mediaIds = parsed.filter(
        (value): value is string => typeof value === "string",
      );
    }
  } catch {
    // An invalid marker contains no trusted IDs and can simply be discarded.
  }
  localStorage.removeItem(incompleteLocalImportMediaKey);
  if (!mediaIds.length) return 0;
  return (await localProductRepository()).discardUnreferencedMedia(mediaIds);
}

const stableLocalTemplateUuid = async (
  scope: string,
  key: string,
): Promise<string> => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`flash-n-flip:local-v2:${scope}:${key}`),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const localCard = (
  entity: Awaited<ReturnType<LocalAppRepository["listCards"]>>[number],
  deck?: Awaited<ReturnType<LocalAppRepository["listDecks"]>>[number],
  direction?: { sourceLocale: string; targetLocale: string },
): Card => ({
  id: entity.id,
  deckId: entity.payload.deckId,
  noteId: entity.payload.noteId ?? entity.id,
  front: entity.payload.front,
  back: entity.payload.back,
  ...(() => {
    const resolved = resolveCardLanguageDirection({
      questionLocale: entity.payload.questionLocale,
      answerLocale: entity.payload.answerLocale,
      sourceLocale:
        direction?.sourceLocale ?? deck?.payload.sourceLocale ?? "de",
      targetLocale:
        direction?.targetLocale ?? deck?.payload.targetLocale ?? "de",
      mode: entity.payload.languageDirectionMode,
      baseSourceLocale: deck?.payload.sourceLocale,
      baseTargetLocale: deck?.payload.targetLocale,
    });
    return {
      questionLocale: resolved.questionLocale,
      answerLocale: resolved.answerLocale,
      languageDirectionMode: entity.payload.languageDirectionMode,
    };
  })(),
  translations: entity.payload.translations,
  kind: entity.payload.kind,
  position: entity.payload.position,
  linkedToPrevious: entity.payload.linkedToPrevious,
  version: entity.version,
  suspended: entity.payload.suspended,
  createdAt: entity.payload.createdAt,
  updatedAt: entity.payload.updatedAt,
});

const effectiveDeckDirections = (
  decks: Awaited<ReturnType<LocalAppRepository["listDecks"]>>,
): Map<string, { sourceLocale: string; targetLocale: string }> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const resolved = new Map<
    string,
    { sourceLocale: string; targetLocale: string }
  >();
  const resolving = new Set<string>();
  const visit = (
    id: string,
  ): { sourceLocale: string; targetLocale: string } => {
    const cached = resolved.get(id);
    if (cached) return cached;
    const deck = byId.get(id);
    if (!deck) return { sourceLocale: "de", targetLocale: "de" };
    const own = {
      sourceLocale:
        deck.payload.sourceLocaleOverride ?? deck.payload.sourceLocale,
      targetLocale:
        deck.payload.targetLocaleOverride ?? deck.payload.targetLocale,
    };
    if (
      deck.payload.languageDirectionMode !== "INHERIT" ||
      !deck.payload.parentDeckId ||
      resolving.has(id)
    ) {
      resolved.set(id, own);
      return own;
    }
    resolving.add(id);
    const inherited = visit(deck.payload.parentDeckId);
    resolving.delete(id);
    resolved.set(id, inherited);
    return inherited;
  };
  for (const deck of decks) visit(deck.id);
  return resolved;
};

const deckFields = (
  entity: Awaited<ReturnType<LocalAppRepository["listDecks"]>>[number],
  direction?: { sourceLocale: string; targetLocale: string },
  learningEnabled?: boolean,
) => ({
  id: entity.id,
  parentDeckId: entity.payload.parentDeckId,
  title: entity.payload.title,
  description: entity.payload.description,
  language: entity.payload.language,
  contentLocales: entity.payload.contentLocales,
  defaultContentLocale: entity.payload.defaultContentLocale,
  sourceLocale: direction?.sourceLocale ?? entity.payload.sourceLocale,
  targetLocale: direction?.targetLocale ?? entity.payload.targetLocale,
  languageDirectionMode: entity.payload.languageDirectionMode,
  studyOrder: entity.payload.studyOrder,
  protectionMode: entity.payload.protectionMode,
  tags: entity.payload.tags,
  favorite: entity.payload.favorite,
  learningEnabled:
    learningEnabled ??
    entity.payload.learningEnabled ??
    entity.payload.favorite ??
    false,
  hiddenAt: entity.payload.hiddenAt,
  archivedAt: entity.payload.archivedAt,
  visual: entity.payload.visual,
  sourceTemplateKey: entity.payload.sourceTemplateKey,
  contentStyles: entity.payload.contentStyles,
  version: entity.version,
  updatedAt: entity.payload.updatedAt,
});

const filterLocalDeckSummaries = <T extends DeckSummary>(
  decks: readonly T[],
  includeHidden: boolean,
  includeArchived: boolean,
): T[] => {
  const archived = archivedDeckIds(decks);
  const visible = visibleDeckIds(decks);
  const pendingDeletes = pendingPermanentDeleteDeckIds();
  return decks.filter(
    (deck) =>
      !pendingDeletes.has(deck.id) &&
      (includeHidden || visible.has(deck.id)) &&
      (includeArchived || !archived.has(deck.id)),
  );
};

export async function listLocalProductDeckMetadata(
  includeHidden = false,
  includeArchived = false,
): Promise<LocalDeckSummary[]> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const [decks, plan] = await Promise.all([
    repository.listDecks(),
    activeNamedStudyPlan(repository),
  ]);
  const planDeckIds = new Set(plan.deckIds);
  const directions = effectiveDeckDirections(decks);
  const cached = readLocalDeckMetrics();
  return filterLocalDeckSummaries(
    decks.map((deck) => {
      const metrics = cached.get(deck.id);
      return {
        ...deckFields(deck, directions.get(deck.id), planDeckIds.has(deck.id)),
        cardCount: metrics?.cardCount ?? 0,
        reviewedCardCount: metrics?.reviewedCardCount ?? 0,
        storageBytes: metrics?.storageBytes ?? 0,
        metricsPending: !metrics,
      } satisfies LocalDeckSummary;
    }),
    includeHidden,
    includeArchived,
  ).sort((left, right) => left.title.localeCompare(right.title));
}

export async function listLocalProductDecks(
  includeHidden = false,
  includeArchived = false,
): Promise<LocalDeckSummary[]> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const [decks, cards, reviews, media, plan] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.listReviews(),
    repository.listMedia(),
    activeNamedStudyPlan(repository),
  ]);
  const planDeckIds = new Set(plan.deckIds);
  const reviewedCards = new Set(reviews.map((review) => review.payload.cardId));
  const directions = effectiveDeckDirections(decks);
  const encoder = new TextEncoder();
  const metrics = new Map<string, LocalDeckMetrics>();
  for (const deck of decks) {
    metrics.set(deck.id, {
      cardCount: 0,
      reviewedCardCount: 0,
      storageBytes: encoder.encode(JSON.stringify(deck.payload)).byteLength,
    });
  }
  for (const card of cards) {
    const current = metrics.get(card.payload.deckId);
    if (!current) continue;
    current.cardCount += 1;
    if (reviewedCards.has(card.id)) current.reviewedCardCount += 1;
    current.storageBytes += encoder.encode(
      JSON.stringify(card.payload),
    ).byteLength;
  }
  for (const entry of media) {
    const current = metrics.get(entry.payload.deckId);
    if (current) current.storageBytes += entry.payload.byteSize;
  }
  writeLocalDeckMetrics(metrics);
  return filterLocalDeckSummaries(
    decks.map(
      (deck) =>
        ({
          ...deckFields(
            deck,
            directions.get(deck.id),
            planDeckIds.has(deck.id),
          ),
          ...(metrics.get(deck.id) ?? {
            cardCount: 0,
            reviewedCardCount: 0,
            storageBytes: 0,
          }),
          metricsPending: false,
        }) satisfies LocalDeckSummary,
    ),
    includeHidden,
    includeArchived,
  ).sort((left, right) => left.title.localeCompare(right.title));
}

export async function isLocalProductDeck(deckId: string): Promise<boolean> {
  return (await localProductRepository())
    .listDecks()
    .then((decks) => decks.some((deck) => deck.id === deckId));
}

export async function getLocalProductDeck(
  deckId: string,
): Promise<DeckDetail | null> {
  const repository = await localProductRepository();
  await ensureLocalLearningPlanMigration();
  const [decks, cards, plan] = await Promise.all([
    repository.listDecks(),
    repository.listCards(deckId),
    activeNamedStudyPlan(repository),
  ]);
  const deck = decks.find((candidate) => candidate.id === deckId);
  if (!deck) return null;
  const direction = effectiveDeckDirections(decks).get(deck.id);
  return {
    ...deckFields(deck, direction, plan.deckIds.includes(deck.id)),
    resolvedContentStyles: resolveContentStyles(
      decks.map((candidate) => ({
        id: candidate.id,
        parentDeckId: candidate.payload.parentDeckId,
        contentStyles: candidate.payload.contentStyles,
      })),
      deck.id,
    ),
    cards: cards
      .filter((card) => card.payload.deckId === deckId)
      .map((card) => localCard(card, deck, direction))
      .sort(
        (left, right) =>
          (left.position ?? 0) - (right.position ?? 0) ||
          left.id.localeCompare(right.id),
      ),
  };
}

const cardMatches = (card: Card, search: string): boolean => {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${localCardContentPlainText(card.front)}\n${localCardContentPlainText(
    card.back,
  )}`
    .toLocaleLowerCase()
    .includes(needle);
};

export async function getLocalProductDeckCardPage(
  deckId: string,
  page: number,
  pageSize: number,
  search = "",
): Promise<DeckCardPage | null> {
  const deck = await getLocalProductDeck(deckId);
  if (!deck) return null;
  const matching = deck.cards.filter((card) => cardMatches(card, search));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const selectedPage = Math.min(Math.max(1, page), totalPages);
  return {
    ...deck,
    cards: matching.slice(
      (selectedPage - 1) * pageSize,
      selectedPage * pageSize,
    ),
    cardPage: {
      page: selectedPage,
      pageSize,
      totalCards: matching.length,
      totalPages,
    },
  };
}

const deckPayloadFromDetail = (deck: DeckDetail): LocalDeckPayload =>
  localDeckPayloadSchema.parse({
    parentDeckId: deck.parentDeckId,
    title: deck.title,
    description: deck.description,
    language: deck.language,
    contentLocales: deck.contentLocales,
    defaultContentLocale: deck.defaultContentLocale,
    sourceLocale: deck.sourceLocale,
    targetLocale: deck.targetLocale,
    languageDirectionMode: deck.languageDirectionMode ?? "OVERRIDE",
    studyOrder: deck.studyOrder ?? "SCHEDULED",
    protectionMode: deck.protectionMode,
    tags: deck.tags,
    favorite: deck.favorite,
    learningEnabled: deck.learningEnabled ?? deck.favorite,
    hiddenAt: deck.hiddenAt,
    archivedAt: deck.archivedAt,
    visual: deck.visual,
    sourceTemplateKey: deck.sourceTemplateKey,
    contentStyles: deck.contentStyles ?? [],
    createdAt: deck.updatedAt,
    updatedAt: deck.updatedAt,
  });

const cardPayloadFromCard = (
  card: Card,
  state = emptyCardState(new Date(card.createdAt)),
): LocalCardPayload =>
  localCardPayloadSchema.parse({
    deckId: card.deckId,
    noteId: card.noteId,
    front: card.front,
    back: card.back,
    questionLocale: card.questionLocale ?? null,
    answerLocale: card.answerLocale ?? null,
    ...(card.languageDirectionMode
      ? { languageDirectionMode: card.languageDirectionMode }
      : {}),
    translations: card.translations,
    kind: card.kind ?? "QUESTION",
    linkedToPrevious: card.linkedToPrevious ?? false,
    position: card.position ?? 0,
    suspended: card.suspended,
    state,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  });

const contentMediaIds = (content: CardContent): string[] =>
  content.blocks.flatMap((block) => {
    if (
      block.type === "image" ||
      block.type === "audio" ||
      block.type === "video"
    ) {
      return [
        block.mediaId,
        ...(block.type === "video" && block.posterMediaId
          ? [block.posterMediaId]
          : []),
      ];
    }
    if (block.type === "imageOverlay") {
      return [block.baseMediaId, block.overlayMediaId];
    }
    return [];
  });

const deckMediaOwners = (deck: DeckDetail): Map<string, string | null> => {
  const owners = new Map<string, string | null>();
  if (deck.visual?.kind === "IMAGE") owners.set(deck.visual.value, null);
  for (const card of deck.cards) {
    const contents = [
      card.front,
      card.back,
      ...Object.values(card.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ];
    for (const content of contents) {
      for (const mediaId of contentMediaIds(content)) {
        if (!owners.has(mediaId)) owners.set(mediaId, card.id);
      }
    }
  }
  return owners;
};

export async function ensureLocalProductDeck(
  deck: DeckDetail,
  dueCards: readonly DueCard[] = [],
  loadMedia?: (mediaId: string) => Promise<Blob>,
): Promise<DeckDetail> {
  const repository = await localProductRepository();
  const existing = await getLocalProductDeck(deck.id);
  if (!existing) {
    const stateByCard = new Map(
      dueCards.map((due) => [due.card.id, due.state] as const),
    );
    await repository.installDeckSnapshot({
      id: deck.id,
      deck: deckPayloadFromDetail(deck),
      cards: deck.cards.map((card) => ({
        id: card.id,
        payload: cardPayloadFromCard(card, stateByCard.get(card.id)),
      })),
    });
  }
  if (loadMedia) {
    const storedIds = new Set(
      (await repository.listMedia()).map((entry) => entry.id),
    );
    for (const [mediaId, cardId] of deckMediaOwners(deck)) {
      if (storedIds.has(mediaId)) continue;
      const blob = await loadMedia(mediaId);
      await repository.addMedia({
        id: mediaId,
        deckId: deck.id,
        cardId,
        fileName: mediaId,
        mimeType: blob.type || "application/octet-stream",
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
    }
  }
  return (await getLocalProductDeck(deck.id))!;
}

export async function installLocalManagedDeckTree(
  seeds: readonly LocalManagedDeckSeed[],
  options: { exactScopePrefix?: string } = {},
): Promise<{ idsByKey: Map<string, string>; installedDeckIds: string[] }> {
  if (!seeds.length) throw new Error("Die lokale Collection ist leer.");
  assertLocalManagedDeckMutationLimit(
    seeds.length + seeds.reduce((sum, seed) => sum + seed.cards.length, 0),
  );
  const repository = await localProductRepository();
  const [activeDecks, activeCards, materialized] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.authority.listEntities({ includeDeleted: true }),
  ]);
  const materializedById = new Map(
    materialized.map((entity) => [entity.winningMutation.entityId, entity]),
  );
  const activeDeckById = new Map(activeDecks.map((deck) => [deck.id, deck]));
  const activeCardById = new Map(activeCards.map((card) => [card.id, card]));
  const idsByKey = new Map<string, string>();
  for (const seed of seeds) {
    idsByKey.set(seed.key, await stableLocalTemplateUuid("deck", seed.key));
  }

  const now = new Date().toISOString();
  const mutations: LocalMutationInput[] = [];
  const retainedDeckIds = new Set(idsByKey.values());
  const retainedCardIds = new Set<string>();

  for (const seed of seeds) {
    const deckId = idsByKey.get(seed.key)!;
    const existing = activeDeckById.get(deckId);
    const current = materializedById.get(deckId);
    mutations.push({
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: current?.currentVersion ?? null,
      payload: localDeckPayloadSchema.parse({
        parentDeckId: seed.parentKey ? idsByKey.get(seed.parentKey)! : null,
        title: seed.title,
        description: seed.description ?? "",
        language: seed.language,
        contentLocales: seed.contentLocales,
        defaultContentLocale: seed.defaultContentLocale,
        sourceLocale: seed.sourceLocale,
        targetLocale: seed.targetLocale,
        studyOrder: seed.studyOrder ?? "SCHEDULED",
        protectionMode: "STANDARD",
        tags: seed.tags ?? [],
        favorite: existing?.payload.favorite ?? false,
        learningEnabled:
          existing?.payload.learningEnabled ??
          existing?.payload.favorite ??
          false,
        hiddenAt: null,
        archivedAt: null,
        visual: seed.visual ?? null,
        sourceTemplateKey: seed.key,
        createdAt: existing?.payload.createdAt ?? now,
        updatedAt: now,
      }),
    });

    for (const [position, cardSeed] of seed.cards.entries()) {
      const cardId = await stableLocalTemplateUuid(
        `deck:${seed.key}`,
        `card:${cardSeed.key}`,
      );
      const noteId = await stableLocalTemplateUuid(
        `deck:${seed.key}`,
        `note:${cardSeed.key}`,
      );
      retainedCardIds.add(cardId);
      const existingCard = activeCardById.get(cardId);
      const currentCard = materializedById.get(cardId);
      mutations.push({
        entityId: cardId,
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: currentCard?.currentVersion ?? null,
        payload: localCardPayloadSchema.parse({
          deckId,
          noteId,
          front: cardSeed.front,
          back: cardSeed.back,
          questionLocale: cardSeed.questionLocale ?? null,
          answerLocale: cardSeed.answerLocale ?? null,
          translations: cardSeed.translations ?? {},
          kind: cardSeed.kind ?? "QUESTION",
          linkedToPrevious: cardSeed.linkedToPrevious ?? false,
          position,
          suspended: existingCard?.payload.suspended ?? false,
          state: existingCard?.payload.state ?? emptyCardState(new Date()),
          introducedAt: existingCard?.payload.introducedAt ?? null,
          createdAt: existingCard?.payload.createdAt ?? now,
          updatedAt: now,
        }),
      });
    }
  }

  if (options.exactScopePrefix) {
    const removedDecks = activeDecks.filter(
      (deck) =>
        deck.payload.sourceTemplateKey?.startsWith(options.exactScopePrefix!) &&
        !retainedDeckIds.has(deck.id),
    );
    const removedDeckIds = new Set(removedDecks.map((deck) => deck.id));
    for (const card of activeCards) {
      if (
        !removedDeckIds.has(card.payload.deckId) ||
        retainedCardIds.has(card.id)
      )
        continue;
      mutations.push({
        entityId: card.id,
        entityType: "CARD",
        operation: "DELETE",
        baseVersion: card.version,
        payload: null,
      });
    }
    for (const deck of removedDecks) {
      mutations.push({
        entityId: deck.id,
        entityType: "DECK",
        operation: "DELETE",
        baseVersion: deck.version,
        payload: null,
      });
    }
  }

  // Signed curated packages can legitimately contain several thousand map
  // cards. Keep their install atomic while using the authority's explicit
  // upper bound instead of the small interactive-edit default.
  assertLocalManagedDeckMutationLimit(mutations.length);
  await repository.authority.commitLocalMutations(mutations, {
    maximumBatchSize: maximumLocalMutationBatchSize,
  });
  return { idsByKey, installedDeckIds: [...idsByKey.values()] };
}

export async function localNumberCollectionTemplate() {
  const installed = (await listLocalProductDecks()).find(
    (deck) => deck.sourceTemplateKey === numberCollectionTemplateKey,
  );
  return {
    ...numberCollectionTemplate,
    installedDeckId: installed?.id ?? null,
  };
}

export async function installLocalNumberCollection(input: {
  sourceLocale: NumberLocale;
  targetLocale: NumberLocale;
  maximum: NumberPracticeMaximum;
  uiLocale: "en" | "de";
}) {
  const seeds = await createNumberCollectionDeckSeeds(input);
  const pairKey = numberCollectionPairKey(
    input.sourceLocale,
    input.targetLocale,
  );
  const result = await installLocalManagedDeckTree(
    seeds.map((seed) => ({
      key: seed.key,
      parentKey: seed.parentKey,
      title: seed.title,
      description: seed.description,
      language: seed.sourceLocale,
      contentLocales: seed.contentLocales,
      defaultContentLocale: seed.sourceLocale,
      sourceLocale: seed.sourceLocale,
      targetLocale: seed.targetLocale,
      tags: seed.tags,
      cards: seed.cards,
    })),
    { exactScopePrefix: pairKey },
  );
  return {
    ...result,
    selectedDeckId: result.idsByKey.get(numberCollectionTemplateKey)!,
    pairDeckId: result.idsByKey.get(pairKey)!,
  };
}

export type CreateLocalDeckInput = {
  parentDeckId?: string | null;
  title: string;
  description?: string;
  language?: string;
  contentLocales?: string[];
  defaultContentLocale?: string;
  sourceLocale?: string;
  targetLocale?: string;
  studyOrder?: "SCHEDULED" | "SEQUENTIAL";
  protectionMode?: "STANDARD" | "ACCOUNT_BOUND";
  tags?: string[];
  visual?: DeckSummary["visual"];
};

export async function createLocalProductDeck(
  input: CreateLocalDeckInput,
): Promise<DeckDetail> {
  const repository = await localProductRepository();
  const id = createId();
  const language = input.language ?? input.targetLocale ?? "de";
  await repository.saveDeck({
    id,
    title: input.title,
    description: input.description,
    language,
    parentDeckId: input.parentDeckId,
    contentLocales: input.contentLocales ?? [language],
    defaultContentLocale: input.defaultContentLocale ?? language,
    sourceLocale: input.sourceLocale ?? language,
    targetLocale: input.targetLocale ?? language,
    studyOrder: input.studyOrder,
    protectionMode: input.protectionMode,
    tags: input.tags,
    visual: input.visual,
  });
  return (await getLocalProductDeck(id))!;
}

export async function importLocalTextDeck(input: {
  title: string;
  sourceLocale: string;
  targetLocale: string;
  cards: Array<{ front: string; back: string; tags?: string[] }>;
}) {
  if (!input.cards.length)
    throw new Error("Die Importdatei enthält keine Karten.");
  if (input.cards.length > 10_000) {
    throw new Error("Ein lokaler Textimport ist auf 10.000 Karten begrenzt.");
  }
  const repository = await localProductRepository();
  const deckId = createId();
  const now = new Date().toISOString();
  const mutations: LocalMutationInput[] = [
    {
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: null,
      payload: localDeckPayloadSchema.parse({
        parentDeckId: null,
        title: input.title,
        description: "",
        language: input.sourceLocale,
        contentLocales: [...new Set([input.sourceLocale, input.targetLocale])],
        defaultContentLocale: input.sourceLocale,
        sourceLocale: input.sourceLocale,
        targetLocale: input.targetLocale,
        studyOrder: "SCHEDULED",
        protectionMode: "STANDARD",
        tags: ["Local import"],
        favorite: false,
        learningEnabled: false,
        hiddenAt: null,
        archivedAt: null,
        visual: null,
        sourceTemplateKey: null,
        createdAt: now,
        updatedAt: now,
      }),
    },
    ...input.cards.map((card, position): LocalMutationInput => ({
      entityId: createId(),
      entityType: "CARD",
      operation: "UPSERT",
      baseVersion: null,
      payload: localCardPayloadSchema.parse({
        deckId,
        noteId: createId(),
        tags: card.tags ?? [],
        front: {
          blocks: [
            {
              type: "markdown" as const,
              revealMode: "ALL" as const,
              source: card.front,
            },
          ],
        },
        back: {
          blocks: [
            {
              type: "markdown" as const,
              revealMode: "ALL" as const,
              source: card.back,
            },
          ],
        },
        questionLocale: input.sourceLocale,
        answerLocale: input.targetLocale,
        translations: {},
        kind: "QUESTION",
        linkedToPrevious: false,
        position,
        suspended: false,
        state: emptyCardState(new Date(now)),
        createdAt: now,
        updatedAt: now,
      }),
    })),
  ];
  await repository.installLocalPackage({ mutations, media: [] });
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  const imported = await getLocalProductDeck(deckId);
  if (!imported)
    throw new Error("Der lokale Textimport konnte nicht gespeichert werden.");
  return imported;
}

const replaceImportedMedia = (
  content: CardContent,
  mediaIds: ReadonlyMap<string, string>,
): CardContent => {
  const blocks = content.blocks.flatMap<unknown>((block) => {
    const candidate = block as unknown as {
      type: string;
      sourceName?: string;
      mediaId?: string;
      alt?: string;
      decorative?: boolean;
      label?: string;
    };
    if (candidate.type === "importImage" && candidate.sourceName) {
      const mediaId = mediaIds.get(candidate.sourceName);
      if (!mediaId) return [];
      return [
        {
          type: "image" as const,
          mediaId,
          alt: candidate.alt ?? "",
          decorative: candidate.decorative ?? false,
        },
      ];
    }
    if (candidate.type === "importAudio" && candidate.sourceName) {
      const mediaId = mediaIds.get(candidate.sourceName);
      if (!mediaId) return [];
      return [
        {
          type: "audio" as const,
          mediaId,
          label: candidate.label ?? candidate.sourceName,
        },
      ];
    }
    const importedOverlay = block as unknown as {
      type?: string;
      baseSourceName?: string;
      overlaySourceName?: string;
      alt?: string;
      decorative?: boolean;
    };
    if (
      importedOverlay.type === "imageOverlay" &&
      importedOverlay.baseSourceName &&
      importedOverlay.overlaySourceName
    ) {
      const baseMediaId = mediaIds.get(importedOverlay.baseSourceName);
      const overlayMediaId = mediaIds.get(importedOverlay.overlaySourceName);
      if (!baseMediaId || !overlayMediaId) {
        return [];
      }
      return [
        {
          type: "imageOverlay" as const,
          baseMediaId,
          overlayMediaId,
          alt: importedOverlay.alt ?? "",
          decorative: importedOverlay.decorative ?? false,
        },
      ];
    }
    if (
      candidate.mediaId &&
      (candidate.type === "image" ||
        candidate.type === "audio" ||
        candidate.type === "video")
    ) {
      const mediaId = mediaIds.get(candidate.mediaId);
      if (!mediaId) throw new Error("Ein FNF-Medium fehlt im Paket.");
      if (block.type === "video" && block.posterMediaId) {
        const posterMediaId = mediaIds.get(block.posterMediaId);
        if (!posterMediaId)
          throw new Error("Ein FNF-Vorschaubild fehlt im Paket.");
        return [{ ...block, mediaId, posterMediaId }];
      }
      return [{ ...block, mediaId }];
    }
    if (block.type === "imageOverlay") {
      const baseMediaId = mediaIds.get(block.baseMediaId);
      const overlayMediaId = mediaIds.get(block.overlayMediaId);
      if (!baseMediaId || !overlayMediaId) {
        throw new Error("Ein FNF-Overlaymedium fehlt im Paket.");
      }
      return [{ ...block, baseMediaId, overlayMediaId }];
    }
    return [block];
  });
  return cardContentSchema.parse({
    blocks: blocks.length
      ? blocks
      : [
          {
            type: "markdown",
            revealMode: "ALL",
            source: "Medium wurde beim Import nicht ausgewählt.",
          },
        ],
  });
};

export async function installOptimizedLocalAudio(input: {
  originalMediaId: string;
  mimeType: "audio/mp4";
  bytes: Uint8Array;
  engine: string;
  engineVersion: string;
  inputMeasurement: AudioQualityMeasurement;
  outputMeasurement: AudioQualityMeasurement;
}): Promise<{ derivativeMediaId: string; outputMediaId: string }> {
  const repository = await localProductRepository();
  const installed = await repository.installMediaDerivative({
    sourceMediaId: input.originalMediaId,
    mimeType: input.mimeType,
    bytes: input.bytes,
    engine: input.engine,
    engineVersion: input.engineVersion,
    inputMeasurement: input.inputMeasurement,
    outputMeasurement: input.outputMeasurement,
  });
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return {
    derivativeMediaId: installed.derivativeId,
    outputMediaId: installed.outputMediaId,
  };
}

export async function importLocalFilePackage(input: {
  parsed: LocalFileImport;
  sourceLocale: string;
  targetLocale: string;
  reimportMode?: "UPDATE" | "COPY";
}): Promise<{
  deckId: string;
  deckCount: number;
  cardCount: number;
  mediaCount: number;
  originalAudioBytes: number;
  audioMediaIds: string[];
  unchangedCardCount: number;
  updatedCardCount: number;
  retainedObsoleteCardCount: number;
}> {
  const repository = await localProductRepository();
  const [existingDecks, existingCards, existingMedia] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.listMedia(),
  ]);
  const existingDeckById = new Map(
    existingDecks.map((deck) => [deck.id, deck]),
  );
  const existingCardById = new Map(
    existingCards.map((card) => [card.id, card]),
  );
  const existingMediaById = new Map(
    existingMedia.map((media) => [media.id, media]),
  );
  const sourceLocale = input.sourceLocale;
  const targetLocale = input.targetLocale;
  const deterministicImport =
    input.parsed.format === "APKG" && Boolean(input.parsed.sourceCollectionKey);
  const existingLineage = deterministicImport
    ? existingCards.find(
        (card) =>
          card.payload.importSource?.sourceCollectionKey ===
          input.parsed.sourceCollectionKey,
      )?.payload.importSource?.importLineageId
    : undefined;
  const importLineageId = deterministicImport
    ? input.reimportMode === "COPY" || !existingLineage
      ? createId()
      : existingLineage
    : createId();
  const stableImportId = (scope: string, key: string): Promise<string> =>
    deterministicImport
      ? stableLocalTemplateUuid(scope, `${importLineageId}:${key}`)
      : Promise.resolve(createId());
  const deckIds = new Map<string, string>();
  const pathTitles = new Map<string, string>();
  const deckPath = (parts: readonly string[]) => parts.join("\u001f");
  const effectivePath = (sourceDeck: LocalFileImport["decks"][number]) =>
    input.parsed.importProfile === "XEFJORD"
      ? [xefjordCollectionTitle, ...sourceDeck.path]
      : sourceDeck.path;
  if (input.parsed.importProfile === "XEFJORD") {
    const existingCollection =
      input.reimportMode === "COPY"
        ? undefined
        : existingDecks.find(
            (deck) =>
              deck.payload.sourceTemplateKey === xefjordCollectionTemplateKey,
          );
    const collectionId =
      existingCollection?.id ??
      (await stableImportId("anki-deck", "xefjord-complete"));
    deckIds.set(xefjordCollectionTitle, collectionId);
    pathTitles.set(xefjordCollectionTitle, xefjordCollectionTitle);
  }
  for (const sourceDeck of input.parsed.decks) {
    const sourcePath = effectivePath(sourceDeck);
    for (let length = 1; length <= sourcePath.length; length += 1) {
      const parts = sourcePath.slice(0, length);
      const key = deckPath(parts);
      if (!deckIds.has(key)) {
        deckIds.set(key, await stableImportId("anki-deck", key));
        pathTitles.set(key, parts.at(-1)!);
      }
    }
  }
  if (!deckIds.size) throw new Error("Das Importpaket enthält keine Lernsets.");
  const rootPaths = [...deckIds.keys()].filter(
    (path) => !path.includes("\u001f"),
  );
  let rootId: string;
  if (rootPaths.length === 1) {
    rootId = deckIds.get(rootPaths[0]!)!;
  } else {
    rootId = await stableImportId("anki-deck", "__import-root__");
    const prefixed = new Map<string, string>([["", rootId]]);
    for (const [path, id] of deckIds) prefixed.set(path, id);
    deckIds.clear();
    for (const [path, id] of prefixed) deckIds.set(path, id);
    pathTitles.set("", input.parsed.title);
  }
  const mediaIds = new Map(
    await Promise.all(
      input.parsed.media.map(
        async (media) =>
          [
            media.sourceName,
            await stableImportId("anki-media", media.sourceName),
          ] as const,
      ),
    ),
  );
  const coverMediaId = input.parsed.coverSourceName
    ? mediaIds.get(input.parsed.coverSourceName)
    : undefined;
  localStorage.setItem(
    incompleteLocalImportMediaKey,
    JSON.stringify([...mediaIds.values()]),
  );
  const now = new Date().toISOString();
  const mutations: LocalMutationInput[] = [];
  const importedNoteIds = new Map<string, string>();
  for (const [path, id] of deckIds) {
    const existing = existingDeckById.get(id);
    const parts = path ? path.split("\u001f") : [];
    const importedDeck = input.parsed.decks.find(
      (deck) => deckPath(effectivePath(deck)) === path,
    );
    const importedVisual = (() => {
      if (!importedDeck?.visual) return null;
      if (importedDeck.visual.kind !== "IMAGE") return importedDeck.visual;
      const value = mediaIds.get(importedDeck.visual.value);
      if (!value) throw new Error("Das FNF-Deckbild fehlt im Paket.");
      return { ...importedDeck.visual, value };
    })();
    const parentPath = parts.length > 1 ? deckPath(parts.slice(0, -1)) : "";
    const parentDeckId =
      path === ""
        ? null
        : deckIds.has(parentPath)
          ? deckIds.get(parentPath)!
          : null;
    const deckPayload = localDeckPayloadSchema.parse({
      parentDeckId,
      title: pathTitles.get(path) ?? input.parsed.title,
      description:
        importedDeck?.description ??
        (path === "" || id === rootId
          ? `${input.parsed.format}-Import · lokal verarbeitet`
          : ""),
      language: importedDeck?.language ?? sourceLocale,
      contentLocales: importedDeck?.contentLocales ?? [
        ...new Set([sourceLocale, targetLocale]),
      ],
      defaultContentLocale: importedDeck?.defaultContentLocale ?? sourceLocale,
      sourceLocale: importedDeck?.sourceLocale ?? sourceLocale,
      targetLocale: importedDeck?.targetLocale ?? targetLocale,
      languageDirectionMode:
        importedDeck?.languageDirectionMode ??
        (id === rootId ? "OVERRIDE" : "INHERIT"),
      sourceLocaleOverride:
        existing?.payload.sourceLocaleOverride ??
        importedDeck?.sourceLocaleOverride ??
        null,
      targetLocaleOverride:
        existing?.payload.targetLocaleOverride ??
        importedDeck?.targetLocaleOverride ??
        null,
      studyOrder: importedDeck?.studyOrder ?? "SCHEDULED",
      protectionMode: "STANDARD",
      tags:
        input.parsed.format === "APKG"
          ? [
              "Anki Import",
              ...(input.parsed.importProfile === "XEFJORD"
                ? ["Xefjord", ...(id === rootId ? ["Collection"] : [])]
                : []),
            ]
          : (importedDeck?.tags ?? ["Local import", input.parsed.format]),
      favorite: existing?.payload.favorite ?? false,
      learningEnabled:
        existing?.payload.learningEnabled ??
        existing?.payload.favorite ??
        false,
      hiddenAt: existing?.payload.hiddenAt ?? null,
      archivedAt: existing?.payload.archivedAt ?? null,
      visual:
        importedVisual ??
        (pathTitles.get(path) === input.parsed.title && coverMediaId
          ? {
              kind: "IMAGE",
              value: coverMediaId,
            }
          : null),
      sourceTemplateKey:
        id === rootId && input.parsed.importProfile === "XEFJORD"
          ? xefjordCollectionTemplateKey
          : (importedDeck?.sourceTemplateKey ?? null),
      contentStyles: (() => {
        const explicit = existing?.payload.contentStyles.length
          ? existing.payload.contentStyles
          : (importedDeck?.contentStyles ?? []);
        return id === rootId
          ? mergeContentStyles(defaultContentStyles, explicit)
          : explicit;
      })(),
      createdAt: existing?.payload.createdAt ?? now,
      updatedAt: existing?.payload.updatedAt ?? now,
    });
    const deckChanged =
      !existing ||
      JSON.stringify(existing.payload) !== JSON.stringify(deckPayload);
    if (deckChanged) {
      mutations.push({
        entityId: id,
        entityType: "DECK",
        operation: "UPSERT",
        baseVersion: existing?.version ?? null,
        payload: existing ? { ...deckPayload, updatedAt: now } : deckPayload,
      });
    }
  }
  let cardCount = 0;
  let unchangedCardCount = 0;
  let updatedCardCount = 0;
  const installedCardIds = new Set<string>();
  for (const sourceDeck of input.parsed.decks) {
    const deckId = deckIds.get(deckPath(effectivePath(sourceDeck)));
    if (!deckId)
      throw new Error("Die importierte Lernset-Hierarchie ist defekt.");
    for (const [position, sourceCard] of sourceDeck.cards.entries()) {
      const sourceNoteIdentity =
        sourceCard.sourceNoteGuid ?? sourceCard.sourceNoteId;
      const generatedOutputIdentity =
        sourceCard.profileRuleId && sourceCard.profileOutputId
          ? `${sourceNoteIdentity}\u001f${sourceCard.profileRuleId}\u001f${sourceCard.profileOutputId}`
          : sourceCard.sourceId;
      const cardId = await stableImportId("anki-card", generatedOutputIdentity);
      installedCardIds.add(cardId);
      const noteKey = sourceNoteIdentity;
      const noteId =
        importedNoteIds.get(noteKey) ??
        (await stableImportId("anki-note", noteKey));
      importedNoteIds.set(noteKey, noteId);
      const existing = existingCardById.get(cardId);
      const importSource =
        input.parsed.format === "APKG"
          ? {
              kind: "ANKI" as const,
              sourceNoteId: sourceCard.sourceNoteId,
              sourceNoteGuid: sourceNoteIdentity,
              sourceFieldText: sourceCard.sourceFieldText ?? {},
              importLineageId,
              ...(input.parsed.sourceCollectionKey
                ? { sourceCollectionKey: input.parsed.sourceCollectionKey }
                : {}),
              ...(input.parsed.packageSha256
                ? { packageSha256: input.parsed.packageSha256 }
                : {}),
              ...(input.parsed.profileId
                ? { profileId: input.parsed.profileId }
                : {}),
              ...(input.parsed.profileVersion !== undefined
                ? { profileVersion: input.parsed.profileVersion }
                : {}),
              ...(sourceCard.sourceId
                ? { sourceCardId: sourceCard.sourceId }
                : {}),
              ...(sourceCard.sourceNoteTypeId
                ? { sourceNoteTypeId: sourceCard.sourceNoteTypeId }
                : {}),
              ...(sourceCard.sourceNoteTypeName
                ? { sourceNoteTypeName: sourceCard.sourceNoteTypeName }
                : {}),
              ...(sourceCard.sourceTemplateOrd !== undefined
                ? { sourceTemplateOrd: sourceCard.sourceTemplateOrd }
                : {}),
              ...(sourceCard.sourceClozeOrdinal !== undefined
                ? { sourceClozeOrdinal: sourceCard.sourceClozeOrdinal }
                : {}),
              ...(sourceCard.sourceTemplateName
                ? { sourceTemplateName: sourceCard.sourceTemplateName }
                : {}),
              ...(sourceCard.sourceOriginalTemplateOrd !== undefined
                ? {
                    sourceOriginalTemplateOrd:
                      sourceCard.sourceOriginalTemplateOrd,
                  }
                : {}),
              ...(sourceCard.sourceOriginalTemplateName
                ? {
                    sourceOriginalTemplateName:
                      sourceCard.sourceOriginalTemplateName,
                  }
                : {}),
              ...(sourceCard.profileRuleId
                ? { profileRuleId: sourceCard.profileRuleId }
                : {}),
              ...(sourceCard.profileOutputId
                ? { profileOutputId: sourceCard.profileOutputId }
                : {}),
              ...(sourceCard.sourceState
                ? { sourceState: sourceCard.sourceState }
                : {}),
            }
          : null;
      const cardPayload = localCardPayloadSchema.parse({
        deckId,
        noteId,
        tags: sourceCard.tags,
        ...(importSource ? { importSource } : {}),
        front: replaceImportedMedia(sourceCard.front, mediaIds),
        back: replaceImportedMedia(sourceCard.back, mediaIds),
        questionLocale: sourceCard.questionLocale ?? sourceLocale,
        answerLocale: sourceCard.answerLocale ?? targetLocale,
        languageDirectionMode:
          sourceCard.languageDirectionMode ??
          (() => {
            const question = sourceCard.questionLocale ?? sourceLocale;
            const answer = sourceCard.answerLocale ?? targetLocale;
            if (question === sourceLocale && answer === targetLocale) {
              return "DECK_DEFAULT" as const;
            }
            if (
              sourceLocale !== targetLocale &&
              question === targetLocale &&
              answer === sourceLocale
            ) {
              return "DECK_REVERSED" as const;
            }
            return "CUSTOM" as const;
          })(),
        translations: sourceCard.translations ?? {},
        kind: sourceCard.kind ?? "QUESTION",
        linkedToPrevious: sourceCard.linkedToPrevious ?? false,
        position,
        suspended:
          sourceCard.suspended === true
            ? true
            : (existing?.payload.suspended ??
              sourceCard.suspended ??
              sourceCard.sourceState?.queue === -1),
        state: existing?.payload.state ?? emptyCardState(new Date()),
        introducedAt: existing?.payload.introducedAt ?? null,
        createdAt: existing?.payload.createdAt ?? now,
        updatedAt: existing?.payload.updatedAt ?? now,
      });
      const cardChanged =
        !existing ||
        JSON.stringify(existing.payload) !== JSON.stringify(cardPayload);
      if (cardChanged) {
        mutations.push({
          entityId: cardId,
          entityType: "CARD",
          operation: "UPSERT",
          baseVersion: existing?.version ?? null,
          payload: existing ? { ...cardPayload, updatedAt: now } : cardPayload,
        });
        if (existing) updatedCardCount += 1;
      } else {
        unchangedCardCount += 1;
      }
      cardCount += 1;
    }
  }
  const mediaToInstall = [];
  for (const media of input.parsed.media) {
    const id = mediaIds.get(media.sourceName)!;
    const existing = existingMediaById.get(id);
    const digestInput = new Uint8Array(media.bytes.byteLength);
    digestInput.set(media.bytes);
    const sha256 = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput)),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (
      existing?.payload.sha256 === sha256 &&
      existing.payload.fileName === media.sourceName &&
      existing.payload.mimeType === media.mimeType &&
      existing.payload.deckId === rootId
    ) {
      continue;
    }
    mediaToInstall.push({
      id,
      deckId: rootId,
      cardId: null,
      fileName: media.sourceName,
      mimeType: media.mimeType,
      bytes: media.bytes,
      baseVersion: existing?.version ?? null,
    });
  }
  if (mutations.length || mediaToInstall.length) {
    await repository.installLocalPackage({
      mutations,
      media: mediaToInstall,
    });
  }
  localStorage.removeItem(incompleteLocalImportMediaKey);
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return {
    deckId: rootId,
    deckCount: deckIds.size,
    cardCount,
    mediaCount: input.parsed.media.length,
    originalAudioBytes: input.parsed.media
      .filter((media) => media.kind === "audio")
      .reduce((sum, media) => sum + media.bytes.byteLength, 0),
    audioMediaIds: input.parsed.media
      .filter((media) => media.kind === "audio")
      .map((media) => mediaIds.get(media.sourceName)!),
    unchangedCardCount,
    updatedCardCount,
    retainedObsoleteCardCount: deterministicImport
      ? existingCards.filter(
          (card) =>
            card.payload.importSource?.importLineageId === importLineageId &&
            !installedCardIds.has(card.id),
        ).length
      : 0,
  };
}

export async function localAnkiImportStatus(
  sourceCollectionKey: string,
): Promise<{
  exists: boolean;
  cardCount: number;
  importLineageId: string | null;
}> {
  const cards = (await (await localProductRepository()).listCards()).filter(
    (card) =>
      card.payload.importSource?.sourceCollectionKey === sourceCollectionKey,
  );
  return {
    exists: cards.length > 0,
    cardCount: cards.length,
    importLineageId: cards[0]?.payload.importSource?.importLineageId ?? null,
  };
}

export async function commitLocalDeckEditor(
  deckId: string,
  input: DeckEditorCommitInput,
): Promise<DeckCardPage> {
  const repository = await localProductRepository();
  const [deck] = (await repository.listDecks()).filter(
    (candidate) => candidate.id === deckId,
  );
  if (!deck || deck.version !== input.version) {
    throw new Error("Das Lernset wurde auf einem anderen Gerät geändert.");
  }
  const existingCards = await repository.listCards(deckId);
  const deleted = new Set(input.deletedCards.map((card) => card.id));
  const updated = new Map(input.updatedCards.map((card) => [card.id, card]));
  const created = new Map(input.createdCards.map((card) => [card.id, card]));
  const order = new Map(
    input.cardOrder.cardIds.map((cardId, index) => [
      cardId,
      (input.cardOrder.cardPage - 1) * input.cardOrder.cardPageSize + index,
    ]),
  );
  const now = new Date().toISOString();
  const mutations: LocalMutationInput[] = [
    {
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: deck.version,
      payload: localDeckPayloadSchema.parse({
        ...deck.payload,
        ...input.deck,
        updatedAt: now,
      }),
    },
  ];
  for (const card of existingCards) {
    if (deleted.has(card.id)) {
      mutations.push({
        entityId: card.id,
        entityType: "CARD",
        operation: "DELETE",
        baseVersion: card.version,
        payload: null,
      });
      continue;
    }
    const change = updated.get(card.id);
    const position = order.get(card.id);
    if (!change && position === undefined) continue;
    const {
      id: _id,
      version: _version,
      ...cardChange
    } = change ?? {
      id: card.id,
      version: card.version,
    };
    mutations.push({
      entityId: card.id,
      entityType: "CARD",
      operation: "UPSERT",
      baseVersion: card.version,
      payload: localCardPayloadSchema.parse({
        ...card.payload,
        ...cardChange,
        position: position ?? card.payload.position,
        updatedAt: now,
      }),
    });
  }
  for (const card of created.values()) {
    mutations.push({
      entityId: card.id,
      entityType: "CARD",
      operation: "UPSERT",
      baseVersion: null,
      payload: localCardPayloadSchema.parse({
        deckId,
        noteId: card.noteId,
        front: card.front,
        back: card.back,
        translations: {},
        kind: card.kind,
        linkedToPrevious: card.linkedToPrevious,
        position: order.get(card.id) ?? existingCards.length,
        suspended: false,
        state: emptyCardState(new Date()),
        createdAt: now,
        updatedAt: now,
      }),
    });
  }
  if (mutations.length > 1_000) {
    throw new Error(
      "Zu viele Kartenänderungen für einen atomaren Speichervorgang.",
    );
  }
  await repository.authority.commitLocalMutations(mutations);
  invalidateStudyBadge();
  return (await getLocalProductDeckCardPage(
    deckId,
    input.cardOrder.cardPage,
    input.cardOrder.cardPageSize,
    input.cardOrder.cardSearch,
  ))!;
}

export async function updateLocalProductDeck(
  deckId: string,
  update: Partial<
    Pick<
      LocalDeckPayload,
      | "favorite"
      | "learningEnabled"
      | "hiddenAt"
      | "archivedAt"
      | "parentDeckId"
      | "languageDirectionMode"
      | "sourceLocaleOverride"
      | "targetLocaleOverride"
    >
  >,
): Promise<void> {
  const repository = await localProductRepository();
  const deck = (await repository.listDecks()).find(
    (candidate) => candidate.id === deckId,
  );
  if (!deck) throw new Error("Das Lernset wurde nicht gefunden.");
  await repository.authority.commitLocalMutation({
    entityId: deck.id,
    entityType: "DECK",
    operation: "UPSERT",
    baseVersion: deck.version,
    payload: localDeckPayloadSchema.parse({
      ...deck.payload,
      ...update,
      updatedAt: new Date().toISOString(),
    }),
  });
  invalidateStudyBadge();
}

export async function updateLocalProductLearningPlan(
  deckId: string,
  learningEnabled: boolean,
): Promise<string[]> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const decks = await repository.listDecks();
  if (!decks.some((candidate) => candidate.id === deckId)) {
    throw new Error("Das Lernset wurde nicht gefunden.");
  }
  const affectedIds = deckDescendantIds(
    decks.map((deck) => ({
      id: deck.id,
      parentDeckId: deck.payload.parentDeckId,
    })),
    deckId,
  );
  const plan = await activeNamedStudyPlan(repository);
  const nextDeckIds = new Set(plan.deckIds);
  for (const id of affectedIds) {
    if (learningEnabled) nextDeckIds.add(id);
    else nextDeckIds.delete(id);
  }
  await repository.saveNamedStudyPlan({
    id: plan.id,
    version: plan.version,
    title: plan.title,
    deckIds: [...nextDeckIds],
    createdAt: plan.createdAt,
  });
  invalidateStudyBadge();
  return [...affectedIds];
}

export async function permanentlyDeleteLocalProductDeck(
  deckId: string,
): Promise<void> {
  await permanentlyDeleteLocalProductDecks(new Set([deckId]));
}

export async function permanentlyDeleteLocalProductDecks(
  deckIds: ReadonlySet<string>,
): Promise<void> {
  if (!deckIds.size) return;
  const repository = await localProductRepository();
  const decks = (await repository.listDecks()).filter((candidate) =>
    deckIds.has(candidate.id),
  );
  if (decks.length) await repository.deleteDecks(decks);
  await repository.discardAllUnreferencedMedia();
  invalidateStudyBadge();
}

let permanentDeleteProcessing: Promise<void> | null = null;

export function resumePendingPermanentDeckDeletes(): Promise<void> {
  permanentDeleteProcessing ??= (async () => {
    for (const job of readPendingPermanentDeckDeletes()) {
      try {
        await permanentlyDeleteLocalProductDecks(new Set(job.deckIds));
        writePendingPermanentDeckDeletes(
          readPendingPermanentDeckDeletes().filter(
            (candidate) => candidate.id !== job.id,
          ),
        );
        window.dispatchEvent(
          new CustomEvent("flash-n-flip:decks-changed", {
            detail: { source: "permanent-delete", jobId: job.id },
          }),
        );
      } catch (cause) {
        window.dispatchEvent(
          new CustomEvent("flash-n-flip:permanent-delete-error", {
            detail: { jobId: job.id, cause },
          }),
        );
        throw cause;
      }
    }
  })().finally(() => {
    permanentDeleteProcessing = null;
  });
  return permanentDeleteProcessing;
}

export function schedulePermanentLocalProductDeckDelete(
  deckIds: ReadonlySet<string>,
): string {
  if (!deckIds.size) throw new Error("Der Löschauftrag enthält keine Decks.");
  const job: PendingPermanentDeckDelete = {
    id: createId(),
    deckIds: [...deckIds].sort(),
    createdAt: new Date().toISOString(),
  };
  writePendingPermanentDeckDeletes([...readPendingPermanentDeckDeletes(), job]);
  return job.id;
}

export async function localDueCards(
  deckId?: string,
  includeAll = false,
  _learningPlanOnly = false,
  excludedCardIds: ReadonlySet<string> = new Set(),
): Promise<DueCard[]> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const [decks, plan] = await Promise.all([
    repository.listDecks(),
    activeNamedStudyPlan(repository),
  ]);
  const hierarchy = decks.map((deck) => ({
    id: deck.id,
    parentDeckId: deck.payload.parentDeckId,
    hiddenAt: deck.payload.hiddenAt,
    archivedAt: deck.payload.archivedAt,
  }));
  const archived = archivedDeckIds(hierarchy);
  const activeDeckIds = new Set(
    [...visibleDeckIds(hierarchy)].filter((id) => !archived.has(id)),
  );
  const learningDeckIds = new Set(plan.deckIds);
  const selectedDeckIds = new Set(
    deckId
      ? deckDescendantIds(hierarchy, deckId)
      : [...activeDeckIds].filter((id) => learningDeckIds.has(id)),
  );
  for (const id of [...selectedDeckIds]) {
    if (!activeDeckIds.has(id)) selectedDeckIds.delete(id);
  }
  if (!selectedDeckIds.size) return [];
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const directions = effectiveDeckDirections(decks);
  const styleDecks = decks.map((deck) => ({
    id: deck.id,
    parentDeckId: deck.payload.parentDeckId,
    contentStyles: deck.payload.contentStyles,
  }));
  const settings = await repository.settings();
  const fallbackDailyGoal = settings?.payload.dailyGoal ?? 10;
  const newDeckIds = [...selectedDeckIds].filter((id) => {
    return includeAll || Boolean(deckId) || learningDeckIds.has(id);
  });
  const now = new Date();
  const reviewLimit = includeAll ? 250 : 500;
  const dailyCounts = includeAll
    ? null
    : await repository.countStudyCards({
        deckIds: [...selectedDeckIds],
        dueBefore: now.toISOString(),
        introducedAfter: localDayStart(now),
        newDeckIds,
        newLimit: 100_000,
      });
  const planDailyNewCards = requiredNewCardsPerStudyDay({
    strategy: plan.strategy,
    remainingNewCards: dailyCounts?.availableNew ?? fallbackDailyGoal,
    fallbackDailyGoal,
    now,
  });
  const newLimit = includeAll
    ? 250
    : Math.max(0, planDailyNewCards - (dailyCounts?.introducedToday ?? 0));
  const newCandidateLimit = includeAll
    ? newLimit
    : Math.min(5_000, Math.max(newLimit, newLimit * 32 + 64));
  const cards = await repository.listStudyCards({
    deckIds: [...selectedDeckIds],
    dueBefore: now.toISOString(),
    introducedAfter: localDayStart(now),
    includeFutureReviews: includeAll,
    excludedCardIds: [...excludedCardIds],
    reviewLimit,
    newDeckIds: newCandidateLimit > 0 ? newDeckIds : [],
    newLimit: newCandidateLimit,
  });
  const queuedWithoutRatings = cards.map(
    (card) =>
      ({
        card: localCard(
          card,
          deckById.get(card.payload.deckId),
          directions.get(card.payload.deckId),
        ),
        studyMode: hasDeveloperReferenceTag(
          deckById.get(card.payload.deckId)?.payload.tags,
        )
          ? "REFERENCE"
          : "LEARNING",
        lastRating: null,
        state: card.payload.state,
        preview: previewRatings(card.payload.state, now),
        contentStyles: resolveContentStyles(styleDecks, card.payload.deckId),
      }) satisfies DueCard,
  );
  const latestRatings = includeAll
    ? await repository.latestReviewRatings(
        queuedWithoutRatings
          .filter((due) => due.state.reps > 0)
          .map((due) => due.card.id),
      )
    : new Map<string, ReviewRating>();
  const queued = queuedWithoutRatings.map((due) => ({
    ...due,
    lastRating: latestRatings.get(due.card.id) ?? null,
  }));
  const dueByCardId = new Map(queued.map((due) => [due.card.id, due]));
  const selectedDeck = deckId ? deckById.get(deckId) : undefined;
  const fairQueue = buildStudyQueue(
    queued.map((due) => ({
      card: {
        ...due.card,
        kind: due.card.kind ?? "QUESTION",
        position: due.card.position ?? 0,
        linkedToPrevious: due.card.linkedToPrevious ?? false,
      },
      studyOrder:
        deckById.get(due.card.deckId)?.payload.studyOrder === "SEQUENTIAL"
          ? ("SEQUENTIAL" as const)
          : ("SCHEDULED" as const),
      dueAt: Date.parse(due.state.due),
      isDueQuestion: due.card.kind !== "EXPLANATION",
      isProblemCard: due.state.reps > 0 && due.state.lapses >= 3,
      queuePriority:
        due.state.reps === 0
          ? ("NEW" as const)
          : Date.parse(due.state.due) <= now.getTime()
            ? ("DUE_REVIEW" as const)
            : ("PRACTICE" as const),
    })),
    {
      shuffleSeed: [
        localDayStart(now),
        deckId ?? "all-decks",
        includeAll ? "practice-all" : "today-plan",
      ].join(":"),
      selectedDeckId: deckId,
      sequentialScopeDeckIds:
        selectedDeck?.payload.studyOrder === "SEQUENTIAL"
          ? [...selectedDeckIds]
          : undefined,
      buryNewSiblings: !includeAll,
      buriedNewSiblingKeys: dailyCounts?.introducedNoteIds,
      newQuestionLimit: includeAll ? undefined : newLimit,
      newReviewOrder: plan.strategy.newReviewOrder,
      maximumReviewStreak: plan.strategy.maximumReviewStreak,
      problemCardLimit:
        includeAll || deckId ? undefined : plan.strategy.problemCardLimit,
    },
  ).map((candidate) => dueByCardId.get(candidate.card.id)!);
  const sequenceProgress = new Map<
    string,
    { completedCount: number; maximum: NumberPracticeMaximum }
  >();
  const usesNumberSequence = fairQueue.some((due) =>
    numberCollectionSequenceFromTags(
      deckById.get(due.card.deckId)?.payload.tags ?? [],
    ),
  );
  const sequenceCards = usesNumberSequence
    ? await repository.listCards()
    : cards;
  for (const card of sequenceCards) {
    if (!selectedDeckIds.has(card.payload.deckId)) continue;
    const definition = numberCollectionSequenceFromTags(
      deckById.get(card.payload.deckId)?.payload.tags ?? [],
    );
    if (!definition) continue;
    const current = sequenceProgress.get(definition.key);
    sequenceProgress.set(definition.key, {
      completedCount: (current?.completedCount ?? 0) + card.payload.state.reps,
      maximum: Math.max(
        current?.maximum ?? definition.categoryMaximum,
        definition.categoryMaximum,
      ) as NumberPracticeMaximum,
    });
  }
  const offsets = new Map<string, number>();
  return Promise.all(
    fairQueue.map(async (due) => {
      const tags = deckById.get(due.card.deckId)?.payload.tags ?? [];
      const definition = numberCollectionSequenceFromTags(tags);
      if (!definition) return due;
      const progress = sequenceProgress.get(definition.key);
      if (!progress) return due;
      const offset = offsets.get(definition.key) ?? 0;
      offsets.set(definition.key, offset + 1);
      return {
        ...due,
        card: await renderNumberExerciseCard(
          due.card,
          tags,
          progress.completedCount + offset,
          { maximum: progress.maximum, sequenceKey: definition.key },
        ),
      };
    }),
  );
}

export type LocalStudyPlanSummary = {
  planId: string;
  planTitle: string;
  strategy: StudyStrategyConfig;
  dueReviews: number;
  deferredReviews: number;
  newCards: number;
  remainingNewCards: number;
  total: number;
  estimatedMinutes: number;
  pace: StudyPaceProjection;
};

export async function localStudyBadgePlan(
  now = new Date(),
): Promise<StudyBadgePlan> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const [decks, plan] = await Promise.all([
    repository.listDecks(),
    activeNamedStudyPlan(repository),
  ]);
  const hierarchy = decks.map((deck) => ({
    id: deck.id,
    parentDeckId: deck.payload.parentDeckId,
    hiddenAt: deck.payload.hiddenAt,
    archivedAt: deck.payload.archivedAt,
  }));
  const archived = archivedDeckIds(hierarchy);
  const planDeckIds = new Set(plan.deckIds);
  const eligibleDeckIds = new Set(
    [...visibleDeckIds(hierarchy)].filter(
      (id) => !archived.has(id) && planDeckIds.has(id),
    ),
  );

  return repository.studyBadgePlan({
    deckIds: [...eligibleDeckIds],
    now,
  });
}

export async function localStudyPlanSummary(): Promise<LocalStudyPlanSummary> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const [decks, settings, plan] = await Promise.all([
    repository.listDecks(),
    repository.settings(),
    activeNamedStudyPlan(repository),
  ]);
  const hierarchy = decks.map((deck) => ({
    id: deck.id,
    parentDeckId: deck.payload.parentDeckId,
    hiddenAt: deck.payload.hiddenAt,
    archivedAt: deck.payload.archivedAt,
  }));
  const archived = archivedDeckIds(hierarchy);
  const planDeckIds = new Set(plan.deckIds);
  const activeDeckIds = [...visibleDeckIds(hierarchy)].filter(
    (id) => !archived.has(id) && planDeckIds.has(id),
  );
  if (!activeDeckIds.length) {
    return {
      planId: plan.id,
      planTitle: plan.title,
      strategy: plan.strategy,
      dueReviews: 0,
      deferredReviews: 0,
      newCards: 0,
      remainingNewCards: 0,
      total: 0,
      estimatedMinutes: 0,
      pace: projectStudyPace({
        strategy: plan.strategy,
        remainingNewCards: 0,
        introducedInWindow: 0,
        observedCalendarDays: 1,
        fallbackDailyGoal: settings?.payload.dailyGoal ?? 10,
        now: new Date(),
      }),
    };
  }
  const newDeckIds = activeDeckIds;
  const now = new Date();
  const observedCalendarDays = Math.min(
    7,
    Math.max(
      1,
      Math.ceil((now.getTime() - Date.parse(plan.createdAt)) / 86_400_000) + 1,
    ),
  );
  const introducedWindowStart = new Date(
    now.getTime() - (observedCalendarDays - 1) * 86_400_000,
  );
  const introducedAfter = localDayStart(introducedWindowStart);
  const [counts, rollingCounts, plannedCards] = await Promise.all([
    repository.countStudyCards({
      deckIds: activeDeckIds,
      dueBefore: now.toISOString(),
      introducedAfter: localDayStart(now),
      newDeckIds,
      newLimit: 100_000,
    }),
    repository.countStudyCards({
      deckIds: activeDeckIds,
      dueBefore: now.toISOString(),
      introducedAfter,
      newDeckIds: [],
      newLimit: 0,
    }),
    localDueCards(undefined, false),
  ]);
  const plannedQuestions = plannedCards.filter(
    (card) => card.card.kind !== "EXPLANATION",
  );
  const dueReviews = plannedQuestions.filter(
    (card) =>
      card.state.reps > 0 && Date.parse(card.state.due) <= now.getTime(),
  ).length;
  const newCards = plannedQuestions.filter(
    (card) => card.state.reps === 0,
  ).length;
  const total = dueReviews + newCards;
  return {
    planId: plan.id,
    planTitle: plan.title,
    strategy: plan.strategy,
    dueReviews,
    deferredReviews: Math.max(0, counts.dueReviews - dueReviews),
    newCards,
    remainingNewCards: counts.availableNew,
    total,
    estimatedMinutes:
      total > 0
        ? Math.max(1, Math.ceil((total * studySecondsPerCard()) / 60))
        : 0,
    pace: projectStudyPace({
      strategy: plan.strategy,
      remainingNewCards: counts.availableNew,
      introducedInWindow: rollingCounts.introducedToday,
      observedCalendarDays,
      fallbackDailyGoal: settings?.payload.dailyGoal ?? 10,
      now,
    }),
  };
}

export async function recordLocalProductReview(input: {
  mutationId: string;
  cardId: string;
  rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
  reviewedAt: string;
  timezone?: string;
  deckId?: string;
  state?: CardState;
  virtualCard?: XefjordCrossLanguageCardRef;
  responseTimeMs?: number;
}): Promise<void> {
  const repository = await localProductRepository();
  if (input.virtualCard) {
    if (!input.deckId || !input.state) {
      throw new Error("Der Zustand der virtuellen Lernkarte fehlt.");
    }
    await repository.reviewVirtualCard({
      reviewId: input.mutationId,
      deckId: input.deckId,
      cardId: input.cardId,
      rating: input.rating,
      reviewedAt: new Date(input.reviewedAt),
      timezone: input.timezone ?? "UTC",
      before: input.state,
      virtualCard: input.virtualCard,
    });
    rememberStudyResponseTime(input.responseTimeMs);
    invalidateStudyBadge();
    return;
  }
  await repository.reviewCard(
    input.cardId,
    input.rating,
    new Date(input.reviewedAt),
    input.mutationId,
  );
  rememberStudyResponseTime(input.responseTimeMs);
  invalidateStudyBadge();
}

export async function resetLocalProductDeckProgress(
  deckId: string,
): Promise<number> {
  const decks = await listLocalProductDecks(true, true);
  const resetCount = await (
    await localProductRepository()
  ).resetDeckProgress(deckDescendantIds(decks, deckId));
  invalidateStudyBadge();
  return resetCount;
}

export async function resetActiveLocalNamedStudyPlanProgress(): Promise<number> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const plan = await activeNamedStudyPlan(repository);
  const resetCount = await repository.resetDeckProgress(new Set(plan.deckIds));
  invalidateStudyBadge();
  return resetCount;
}

export async function saveLocalProductSettings(
  input: Omit<LocalSettingsPayload, "updatedAt">,
): Promise<void> {
  await (await localProductRepository()).saveSettings(input);
}

export async function getLocalProductSettings(): Promise<LocalSettingsPayload | null> {
  return (await (await localProductRepository()).settings())?.payload ?? null;
}

export async function patchLocalProductSettings(
  input: Partial<Omit<LocalSettingsPayload, "updatedAt">>,
): Promise<void> {
  const storedLocale = localStorage.getItem("flash-n-flip.locale.v1");
  const storedTts = localStorage.getItem("flash-n-flip.text-to-speech.v1");
  await (
    await localProductRepository()
  ).patchSettings(input, {
    theme: "SYSTEM",
    locale: storedLocale === "en" ? "en" : "de",
    dailyGoal: 10,
    pagePinchZoom:
      localStorage.getItem("flash-n-flip.page-pinch-zoom.v1") === "enabled",
    textToSpeechMode:
      storedTts === "off" ||
      storedTts === "sentence" ||
      storedTts === "sentence-and-choices"
        ? storedTts
        : "sentence-and-choices",
    showQuestionWithAnswer:
      localStorage.getItem("flash-n-flip.show-question-with-answer.v1") !==
      "hidden",
  });
}

export async function exportLocalProductData(): Promise<Blob> {
  const backup = await exportLocalProductBackupEnvelope();
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

const localPackageBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

export async function exportLocalProductDeckPackage(
  rootDeckId: string,
): Promise<Blob> {
  const repository = await localProductRepository();
  const [decks, cards] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
  ]);
  const root = decks.find((deck) => deck.id === rootDeckId);
  if (!root) throw new Error("Das Lernset ist nicht mehr vorhanden.");
  const selectedIds = deckDescendantIds(
    decks.map((deck) => ({
      id: deck.id,
      parentDeckId: deck.payload.parentDeckId,
    })),
    rootDeckId,
  );
  const selectedDecks = decks.filter((deck) => selectedIds.has(deck.id));
  const selectedCards = cards.filter((card) =>
    selectedIds.has(card.payload.deckId),
  );
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const pathFor = (deckId: string): string[] => {
    const path: string[] = [];
    let current = deckById.get(deckId);
    const seen = new Set<string>();
    while (current && selectedIds.has(current.id) && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current.payload.title);
      current = current.payload.parentDeckId
        ? deckById.get(current.payload.parentDeckId)
        : undefined;
    }
    return path;
  };
  const referencedMediaIds = new Set<string>();
  for (const deck of selectedDecks) {
    if (deck.payload.visual?.kind === "IMAGE") {
      referencedMediaIds.add(deck.payload.visual.value);
    }
  }
  for (const card of selectedCards) {
    for (const content of [
      card.payload.front,
      card.payload.back,
      ...Object.values(card.payload.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ]) {
      for (const mediaId of contentMediaIds(content))
        referencedMediaIds.add(mediaId);
    }
  }
  const media = await Promise.all(
    [...referencedMediaIds].sort().map(async (mediaId) => {
      const stored = await repository.getPlayableMedia(mediaId);
      if (!stored) throw new Error("Ein referenziertes lokales Medium fehlt.");
      return {
        sourceName: mediaId,
        mimeType: stored.mimeType,
        sha256: stored.sha256,
        dataBase64: localPackageBase64(stored.bytes),
      };
    }),
  );
  const packageData = {
    format: "flash-n-flip.local-package",
    version: 1,
    title: root.payload.title,
    decks: selectedDecks.map((deck) => ({
      sourceId: deck.id,
      path: pathFor(deck.id),
      cards: selectedCards
        .filter((card) => card.payload.deckId === deck.id)
        .map((card) => ({
          sourceId: card.id,
          sourceNoteId: card.payload.noteId ?? card.id,
          front: card.payload.front,
          back: card.payload.back,
          tags: card.payload.tags.slice(0, 30),
          questionLocale: card.payload.questionLocale ?? undefined,
          answerLocale: card.payload.answerLocale ?? undefined,
          languageDirectionMode: card.payload.languageDirectionMode,
          linkedToPrevious: card.payload.linkedToPrevious,
          translations: card.payload.translations,
          kind: card.payload.kind,
          suspended: card.payload.suspended,
        })),
      description: deck.payload.description,
      language: deck.payload.language,
      contentLocales: deck.payload.contentLocales,
      defaultContentLocale: deck.payload.defaultContentLocale,
      sourceLocale: deck.payload.sourceLocale,
      targetLocale: deck.payload.targetLocale,
      languageDirectionMode: deck.payload.languageDirectionMode,
      sourceLocaleOverride: deck.payload.sourceLocaleOverride,
      targetLocaleOverride: deck.payload.targetLocaleOverride,
      studyOrder: deck.payload.studyOrder,
      tags: deck.payload.tags,
      visual: deck.payload.visual,
      sourceTemplateKey: deck.payload.sourceTemplateKey,
      contentStyles: deck.payload.contentStyles,
    })),
    media,
  };
  return new Blob([JSON.stringify(packageData)], {
    type: "application/vnd.flash-n-flip.local+json",
  });
}

export async function exportLocalProductBackupEnvelope() {
  return (await localProductRepository()).exportAll();
}

export async function restoreLocalProductBackupEnvelope(
  candidate: unknown,
): Promise<void> {
  await (await localProductRepository()).restoreAll(candidate);
}

export async function restoreLocalProductData(file: Blob): Promise<void> {
  if (file.size > 700 * 1024 * 1024) {
    throw new Error("Die Sicherungsdatei ist zu groß.");
  }
  const parsed = JSON.parse(await file.text()) as unknown;
  await restoreLocalProductBackupEnvelope(parsed);
}

export async function getLocalProductMedia(
  mediaId: string,
): Promise<Blob | null> {
  const media = await (
    await localProductRepository()
  ).getPlayableMedia(mediaId);
  return media
    ? new Blob([media.bytes.slice().buffer as ArrayBuffer], {
        type: media.mimeType,
      })
    : null;
}

export async function getLocalProductOriginalMedia(
  mediaId: string,
): Promise<Blob | null> {
  const media = await (await localProductRepository()).getMedia(mediaId);
  return media
    ? new Blob([media.bytes.slice().buffer as ArrayBuffer], {
        type: media.mimeType,
      })
    : null;
}

export async function getLocalProductAudioComparison(
  mediaId: string,
): Promise<{ original: Blob; optimized: Blob } | null> {
  const repository = await localProductRepository();
  const derivative = selectPreferredAudioDerivative(
    (await repository.listAudioDerivatives(mediaId)).map(
      (entry) => entry.payload,
    ),
  );
  if (!derivative) return null;
  const [original, optimized] = await Promise.all([
    repository.getMedia(mediaId),
    repository.getMedia(derivative.outputMediaId),
  ]);
  if (
    !original ||
    !optimized ||
    original.sha256 !== derivative.sourceSha256 ||
    optimized.sha256 !== derivative.outputSha256 ||
    original.sha256 === optimized.sha256
  ) {
    return null;
  }
  return {
    original: new Blob([original.bytes.slice().buffer as ArrayBuffer], {
      type: original.mimeType,
    }),
    optimized: new Blob([optimized.bytes.slice().buffer as ArrayBuffer], {
      type: optimized.mimeType,
    }),
  };
}

export type LocalProductAudioComparisonCandidate = {
  mediaId: string;
  verifiedAt: string;
  durationSeconds: number;
  originalBytes: number;
  optimizedBytes: number;
};

export async function listLocalProductAudioComparisonCandidates(
  mediaIds: readonly string[],
): Promise<LocalProductAudioComparisonCandidate[]> {
  const requestedMediaIds = new Set(mediaIds);
  if (!requestedMediaIds.size) return [];
  const derivativesBySource = new Map<string, LocalAudioDerivativePayload[]>();
  for (const entry of await (
    await localProductRepository()
  ).listAudioDerivatives()) {
    const derivative = entry.payload;
    if (!requestedMediaIds.has(derivative.sourceMediaId)) continue;
    const sourceDerivatives = derivativesBySource.get(derivative.sourceMediaId);
    if (sourceDerivatives) sourceDerivatives.push(derivative);
    else derivativesBySource.set(derivative.sourceMediaId, [derivative]);
  }
  return [...derivativesBySource.entries()].flatMap(
    ([mediaId, derivatives]) => {
      const derivative = selectPreferredAudioDerivative(derivatives);
      if (!derivative || derivative.sourceSha256 === derivative.outputSha256)
        return [];
      return [
        {
          mediaId,
          verifiedAt: derivative.verifiedAt,
          durationSeconds: derivative.output.durationSeconds,
          originalBytes: derivative.sourceBytes,
          optimizedBytes: derivative.outputBytes,
        },
      ];
    },
  );
}

export async function installTransferredLocalProductDecks(
  decks: readonly DeckDetail[],
  media: ReadonlyMap<string, Blob>,
): Promise<void> {
  const repository = await localProductRepository();
  for (const deck of decks) await ensureLocalProductDeck(deck);
  const existingMedia = new Set(
    (await repository.listMedia()).map((entry) => entry.id),
  );
  const ownerDeckId = decks[0]?.id;
  if (!ownerDeckId) return;
  for (const [id, blob] of media) {
    if (existingMedia.has(id)) continue;
    await repository.addMedia({
      id,
      deckId: ownerDeckId,
      fileName: id,
      mimeType: blob.type || "application/octet-stream",
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
  }
}

export async function localAuthorityJournal() {
  return (await localProductRepository()).authority.listMutationJournal();
}

export async function localAuthorityWatermarks() {
  return (await localProductRepository()).authority.getReplicaWatermarks();
}

export async function applyLocalAuthorityMutations(mutations: PeerMutation[]) {
  const repository = await localProductRepository();
  const watermarks = await repository.authority.applyRemoteMutations(mutations);
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return watermarks;
}

export async function acknowledgeLocalAuthorityWatermarks(
  watermarks: ReplicaWatermarks,
): Promise<void> {
  const repository = await localProductRepository();
  const acknowledged = (await repository.authority.listOutbox())
    .filter(
      (mutation) =>
        mutation.originSequence <= (watermarks[mutation.originDeviceId] ?? 0),
    )
    .map((mutation) => mutation.mutationId);
  await repository.authority.acknowledgeOutbox(acknowledged);
}
