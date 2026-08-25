"use client";

import JSZip from "jszip";

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
  developerReferenceDeckIds,
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
  ankiMathToMarkdown,
  cardContentSchema,
  hasCardContent,
  hasInteractiveGeographyOverview,
  normalizeAnkiClozeMath,
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
import {
  fnfV3ContainerMediaType,
  fnfV3DeckSchema,
  fnfV3ManifestSchema,
  stringifyFnfV3JsonLines,
  type FnfV3Card,
  type FnfV3Entry,
  type FnfV3Media,
  type FnfV3Note,
} from "@flashcards/package-format";
import { defaultLocale, isLocale, type Locale } from "@flashcards/i18n";

import type { LocalFileImport } from "./local-file-import";
import {
  dictionaryDeckLocale,
  dictionaryLanguageDeckTags,
  dictionaryPivotDisabledTag,
  isDictionaryLanguageDeck,
  languageHubCollectionTags,
  languageHubTemplateKey,
  languageHubTitle,
} from "./language-hub";
import { clearXefjordPhraseIndexes } from "./offline";

let repositoryPromise: Promise<LocalAppRepository> | null = null;
let learningPlanMigrationPromise: Promise<void> | null = null;
const defaultNamedStudyPlanId = "00000000-0000-4000-8000-000000000002";
const activeNamedStudyPlanKey = "flash-n-flip.active-named-study-plan.v1";
const reverseCardMigrationKey = "flash-n-flip.reverse-card-opt-in.v1";
const ankiFormulaMigrationKey = "flash-n-flip.anki-formula-content.v1";
const ankiPlaceholderMigrationKey = "flash-n-flip.anki-empty-placeholder.v1";
const geographyOverviewMigrationKey =
  "flash-n-flip.geography-overview-suspension.v1";
const unsupportedAnkiContentPlaceholder = "Nicht unterstützter Anki-Inhalt.";
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

export const repairImportedAnkiFormulaContent = (
  content: CardContent,
): CardContent => ({
  ...content,
  blocks: content.blocks.map((block) => {
    if (block.type === "cloze" && block.presentation === "ANKI") {
      if (block.mathRanges?.length) return block;
      const normalized = normalizeAnkiClozeMath(block);
      if (
        normalized.text === block.text &&
        JSON.stringify(normalized.deletions) ===
          JSON.stringify(block.deletions) &&
        JSON.stringify(normalized.mathRanges) ===
          JSON.stringify(block.mathRanges ?? [])
      ) {
        return block;
      }
      return {
        ...block,
        text: normalized.text,
        deletions: normalized.deletions,
        mathRanges: normalized.mathRanges,
      };
    }
    if (block.type === "markdown") {
      const normalized = ankiMathToMarkdown(block.source);
      return normalized.text === block.source
        ? block
        : { ...block, source: normalized.text };
    }
    if (block.type === "text") {
      const normalized = ankiMathToMarkdown(block.text);
      if (!normalized.mathRanges.length) return block;
      return {
        type: "markdown" as const,
        revealMode: "ALL" as const,
        source: normalized.text,
      };
    }
    return block;
  }),
});

export const stripGeneratedAnkiPlaceholder = (
  content: CardContent,
): CardContent => {
  const blocks = content.blocks.filter(
    (block) =>
      !(
        (block.type === "text" &&
          block.text.trim() === unsupportedAnkiContentPlaceholder) ||
        (block.type === "markdown" &&
          block.source.trim() === unsupportedAnkiContentPlaceholder)
      ),
  );
  if (!blocks.length || blocks.length === content.blocks.length) return content;
  return { ...content, blocks };
};

export const stripGeneratedAnkiPlaceholderFromPayload = <
  T extends LocalCardPayload,
>(
  payload: T,
): T => {
  const front = stripGeneratedAnkiPlaceholder(payload.front);
  const back = stripGeneratedAnkiPlaceholder(payload.back);
  return front === payload.front && back === payload.back
    ? payload
    : { ...payload, front, back };
};

export const repairImportedAnkiFormulaPayload = <T extends LocalCardPayload>(
  payload: T,
): T => {
  const front = repairImportedAnkiFormulaContent(payload.front);
  const back = repairImportedAnkiFormulaContent(payload.back);
  return JSON.stringify(front) === JSON.stringify(payload.front) &&
    JSON.stringify(back) === JSON.stringify(payload.back)
    ? payload
    : { ...payload, front, back };
};

export type LocalManagedCardSeed = {
  key: string;
  front: CardContent;
  back: CardContent;
  questionLocale?: string | null;
  answerLocale?: string | null;
  translations?: Card["translations"];
  kind?: Card["kind"];
  usage?: Card["usage"];
  linkedToPrevious?: boolean;
  suspended?: boolean;
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

const repairPersistedLanguageHubDecks = async (
  repository: LocalAppRepository,
  storedDecks: Awaited<ReturnType<LocalAppRepository["listDecks"]>>,
): Promise<typeof storedDecks> => {
  const collections = storedDecks.filter(
    (deck) => deck.payload.sourceTemplateKey === languageHubTemplateKey,
  );
  if (!collections.length) return storedDecks;
  const children = storedDecks.filter((deck) =>
    collections.some(
      (collection) => collection.id === deck.payload.parentDeckId,
    ),
  );
  const needsCardInference = children.some(
    (deck) => !deck.payload.tags.includes("Dictionary"),
  );
  const cards = needsCardInference ? await repository.listCards() : [];
  const hierarchy = storedDecks.map((deck) => ({
    id: deck.id,
    parentDeckId: deck.payload.parentDeckId,
  }));
  const inferredDirection = (deckId: string) => {
    const descendantIds = deckDescendantIds(hierarchy, deckId);
    const locales = new Set<string>();
    for (const card of cards) {
      if (!descendantIds.has(card.payload.deckId)) continue;
      const question = card.payload.questionLocale?.trim().toLocaleLowerCase();
      const answer = card.payload.answerLocale?.trim().toLocaleLowerCase();
      if (question) locales.add(question);
      if (answer) locales.add(answer);
    }
    if (locales.size !== 2 || !locales.has("en")) return null;
    const targetLocale = [...locales].find((locale) => locale !== "en");
    return targetLocale ? { sourceLocale: "en", targetLocale } : null;
  };
  const directions = new Map<
    string,
    { sourceLocale: string; targetLocale: string } | null
  >();
  for (const child of children) {
    const own = {
      sourceLocale:
        child.payload.sourceLocaleOverride ?? child.payload.sourceLocale,
      targetLocale:
        child.payload.targetLocaleOverride ?? child.payload.targetLocale,
    };
    const ownLocales = new Set([
      own.sourceLocale.toLocaleLowerCase(),
      own.targetLocale.toLocaleLowerCase(),
    ]);
    const inferred = needsCardInference ? inferredDirection(child.id) : null;
    directions.set(
      child.id,
      inferred ?? (ownLocales.size === 2 && ownLocales.has("en") ? own : null),
    );
  }
  const canonicalByCollectionAndLocale = new Map<string, string>();
  for (const child of [...children].sort(
    (left, right) =>
      Number(left.payload.tags.includes(dictionaryPivotDisabledTag)) -
        Number(right.payload.tags.includes(dictionaryPivotDisabledTag)) ||
      left.payload.createdAt.localeCompare(right.payload.createdAt) ||
      left.id.localeCompare(right.id),
  )) {
    const direction = directions.get(child.id);
    if (!direction) continue;
    const key = `${child.payload.parentDeckId}:${direction.targetLocale}`;
    if (!canonicalByCollectionAndLocale.has(key)) {
      canonicalByCollectionAndLocale.set(key, child.id);
    }
  }
  const desiredPayloads = new Map<string, LocalDeckPayload>();
  for (const collection of collections) {
    desiredPayloads.set(
      collection.id,
      localDeckPayloadSchema.parse({
        ...collection.payload,
        title: languageHubTitle,
        language: "en",
        contentLocales: ["en"],
        defaultContentLocale: "en",
        sourceLocale: "en",
        targetLocale: "en",
        sourceLocaleOverride: null,
        targetLocaleOverride: null,
        languageDirectionMode: "OVERRIDE",
        tags: languageHubCollectionTags(collection.payload.tags),
      }),
    );
  }
  for (const child of children) {
    const direction = directions.get(child.id) ?? null;
    const neutral = !direction;
    const sourceLocale = direction?.sourceLocale ?? child.payload.sourceLocale;
    const targetLocale = direction?.targetLocale ?? sourceLocale;
    const canonicalKey = direction
      ? `${child.payload.parentDeckId}:${direction.targetLocale}`
      : null;
    const pivotDisabled = Boolean(
      canonicalKey &&
      canonicalByCollectionAndLocale.get(canonicalKey) !== child.id,
    );
    desiredPayloads.set(
      child.id,
      localDeckPayloadSchema.parse({
        ...child.payload,
        language: targetLocale,
        contentLocales: direction
          ? [...new Set([sourceLocale, targetLocale])]
          : child.payload.contentLocales,
        defaultContentLocale: targetLocale,
        sourceLocale,
        targetLocale,
        sourceLocaleOverride: null,
        targetLocaleOverride: null,
        languageDirectionMode: "OVERRIDE",
        tags: dictionaryLanguageDeckTags({
          tags: child.payload.tags,
          locale: direction?.targetLocale ?? null,
          pivotLocale: direction?.sourceLocale,
          pivotDisabled,
          neutral,
        }),
      }),
    );
  }
  const changes = storedDecks.flatMap((deck) => {
    const desired = desiredPayloads.get(deck.id);
    if (!desired || JSON.stringify(desired) === JSON.stringify(deck.payload)) {
      return [];
    }
    return [{ deck, desired }];
  });
  if (!changes.length) return storedDecks;
  const now = new Date().toISOString();
  await repository.authority.commitLocalMutations(
    changes.map(({ deck, desired }) => ({
      entityId: deck.id,
      entityType: "DECK" as const,
      operation: "UPSERT" as const,
      baseVersion: deck.version,
      payload: localDeckPayloadSchema.parse({ ...desired, updatedAt: now }),
    })),
    { maximumBatchSize: maximumLocalMutationBatchSize },
  );
  return repository.listDecks();
};

const languageHubDictionaryRootId = (
  decks: Awaited<ReturnType<LocalAppRepository["listDecks"]>>,
  deckId: string,
): string | null => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  let current = byId.get(deckId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = current.payload.parentDeckId
      ? byId.get(current.payload.parentDeckId)
      : undefined;
    if (parent?.payload.sourceTemplateKey === languageHubTemplateKey) {
      return current.id;
    }
    current = parent;
  }
  return null;
};

const localDeveloperReferenceDeckIds = (
  decks: Awaited<ReturnType<LocalAppRepository["listDecks"]>>,
): Set<string> =>
  developerReferenceDeckIds(
    decks.map((deck) => ({
      id: deck.id,
      parentDeckId: deck.payload.parentDeckId,
      tags: deck.payload.tags,
    })),
  );

const removeReferencesFromNamedStudyPlans = async (
  repository: LocalAppRepository,
  decks: Awaited<ReturnType<LocalAppRepository["listDecks"]>>,
  plans: Awaited<ReturnType<LocalAppRepository["listNamedStudyPlans"]>>,
) => {
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  let changed = false;
  for (const plan of plans) {
    const deckIds = plan.payload.deckIds.filter(
      (deckId) => !referenceDeckIds.has(deckId),
    );
    if (deckIds.length === plan.payload.deckIds.length) continue;
    changed = true;
    await repository.saveNamedStudyPlan({
      id: plan.id,
      version: plan.version,
      title: plan.payload.title,
      deckIds,
      ...(plan.payload.kind === "NAMED_STUDY_PLAN_V2"
        ? { strategy: plan.payload.strategy }
        : {}),
      createdAt: plan.payload.createdAt,
    });
  }
  return changed ? repository.listNamedStudyPlans() : plans;
};

export const ensureLocalLearningPlanMigration = (): Promise<void> => {
  if (learningPlanMigrationPromise) return learningPlanMigrationPromise;
  let tracked: Promise<void>;
  tracked = (async () => {
    const repository = await localProductRepository();
    let decks = await repository.listDecks();
    decks = await repairPersistedLanguageHubDecks(repository, decks);
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
    const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
    const referenceLearningDecks = decks.filter(
      (deck) =>
        referenceDeckIds.has(deck.id) && deck.payload.learningEnabled === true,
    );
    if (referenceLearningDecks.length) {
      const now = new Date().toISOString();
      await repository.authority.commitLocalMutations(
        referenceLearningDecks.map((deck) => ({
          entityId: deck.id,
          entityType: "DECK" as const,
          operation: "UPSERT" as const,
          baseVersion: deck.version,
          payload: localDeckPayloadSchema.parse({
            ...deck.payload,
            learningEnabled: false,
            updatedAt: now,
          }),
        })),
        { maximumBatchSize: maximumLocalMutationBatchSize },
      );
      decks = await repository.listDecks();
    }
    let plans = await repository.listNamedStudyPlans();
    if (!plans.length) {
      const currentReferenceDeckIds = localDeveloperReferenceDeckIds(decks);
      await repository.saveNamedStudyPlan({
        id: defaultNamedStudyPlanId,
        title: "Mein Lernplan",
        deckIds: [
          ...new Set(
            decks
              .filter(
                (deck) =>
                  deck.payload.learningEnabled &&
                  !currentReferenceDeckIds.has(deck.id),
              )
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
      const currentReferenceDeckIds = localDeveloperReferenceDeckIds(decks);
      await repository.saveNamedStudyPlan({
        id: target.id,
        version: target.version,
        title: target.payload.title,
        deckIds: [
          ...new Set(
            [...target.payload.deckIds, ...migratedFavoriteIds].filter(
              (deckId) => !currentReferenceDeckIds.has(deckId),
            ),
          ),
        ],
        createdAt: target.payload.createdAt,
      });
      plans = await repository.listNamedStudyPlans();
    }
    plans = await removeReferencesFromNamedStudyPlans(repository, decks, plans);
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
    let formulaMigrationComplete = false;
    try {
      formulaMigrationComplete =
        localStorage.getItem(ankiFormulaMigrationKey) === "done";
    } catch {
      // Run the idempotent content migration when the marker cannot be read.
    }
    if (!formulaMigrationComplete) {
      const cards = await repository.listCards();
      const repairs = cards.flatMap((card) => {
        if (card.payload.importSource?.kind !== "ANKI") return [];
        const payload = repairImportedAnkiFormulaPayload(card.payload);
        return payload === card.payload ? [] : [{ card, payload }];
      });
      const now = new Date().toISOString();
      for (let offset = 0; offset < repairs.length; offset += 1_000) {
        await repository.authority.commitLocalMutations(
          repairs.slice(offset, offset + 1_000).map(({ card, payload }) => ({
            entityId: card.id,
            entityType: "CARD" as const,
            operation: "UPSERT" as const,
            baseVersion: card.version,
            payload: localCardPayloadSchema.parse({
              ...payload,
              updatedAt: now,
            }),
          })),
          { maximumBatchSize: maximumLocalMutationBatchSize },
        );
      }
      try {
        localStorage.setItem(ankiFormulaMigrationKey, "done");
      } catch {
        // The mutations remain idempotent and will be checked again on restart.
      }
    }
    let placeholderMigrationComplete = false;
    try {
      placeholderMigrationComplete =
        localStorage.getItem(ankiPlaceholderMigrationKey) === "done";
    } catch {
      // Run the idempotent content migration when the marker cannot be read.
    }
    if (!placeholderMigrationComplete) {
      const cards = await repository.listCards();
      const repairs = cards.flatMap((card) => {
        if (card.payload.importSource?.kind !== "ANKI") return [];
        const payload = stripGeneratedAnkiPlaceholderFromPayload(card.payload);
        return payload === card.payload ? [] : [{ card, payload }];
      });
      const now = new Date().toISOString();
      for (let offset = 0; offset < repairs.length; offset += 1_000) {
        await repository.authority.commitLocalMutations(
          repairs.slice(offset, offset + 1_000).map(({ card, payload }) => ({
            entityId: card.id,
            entityType: "CARD" as const,
            operation: "UPSERT" as const,
            baseVersion: card.version,
            payload: localCardPayloadSchema.parse({
              ...payload,
              updatedAt: now,
            }),
          })),
          { maximumBatchSize: maximumLocalMutationBatchSize },
        );
      }
      try {
        localStorage.setItem(ankiPlaceholderMigrationKey, "done");
      } catch {
        // The mutations remain idempotent and will be checked again on restart.
      }
    }
    let geographyOverviewMigrationComplete = false;
    try {
      geographyOverviewMigrationComplete =
        localStorage.getItem(geographyOverviewMigrationKey) === "done";
    } catch {
      // Run the idempotent overview migration when the marker cannot be read.
    }
    if (!geographyOverviewMigrationComplete) {
      const cards = await repository.listCards();
      const overviews = cards.filter(
        (card) =>
          !card.payload.suspended &&
          hasInteractiveGeographyOverview(card.payload),
      );
      const now = new Date().toISOString();
      for (let offset = 0; offset < overviews.length; offset += 1_000) {
        await repository.authority.commitLocalMutations(
          overviews.slice(offset, offset + 1_000).map((card) => ({
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
          { maximumBatchSize: maximumLocalMutationBatchSize },
        );
      }
      if (overviews.length > 0) {
        try {
          localStorage.removeItem(localDeckMetricsCacheKey);
        } catch {
          // The derived deck metrics will be recalculated by the next full read.
        }
      }
      try {
        localStorage.setItem(geographyOverviewMigrationKey, "done");
      } catch {
        // The mutations remain idempotent and will be checked again on restart.
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
  const repository = await localProductRepository();
  const [decks, storedPlans] = await Promise.all([
    repository.listDecks(),
    repository.listNamedStudyPlans(),
  ]);
  const plans = (
    await removeReferencesFromNamedStudyPlans(repository, decks, storedPlans)
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
  const [decks, storedPlans] = await Promise.all([
    repository.listDecks(),
    repository.listNamedStudyPlans(),
  ]);
  const plans = (
    await removeReferencesFromNamedStudyPlans(repository, decks, storedPlans)
  ).map(publicNamedStudyPlan);
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
  supplementalContent: entity.payload.supplementalContent,
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
  usage: entity.payload.usage,
  position: entity.payload.position,
  linkedToPrevious: entity.payload.linkedToPrevious,
  ratingEnabled: entity.payload.ratingEnabled,
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
    const parent = deck.payload.parentDeckId
      ? byId.get(deck.payload.parentDeckId)
      : undefined;
    const isXefjordLanguageRoot = Boolean(
      parent?.payload.sourceTemplateKey === languageHubTemplateKey &&
      isDictionaryLanguageDeck(deck.payload),
    );
    if (
      deck.payload.languageDirectionMode !== "INHERIT" ||
      !deck.payload.parentDeckId ||
      isXefjordLanguageRoot ||
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

export async function listLocalInstalledTemplateDecks(): Promise<
  Array<{ id: string; sourceTemplateKey: string | null }>
> {
  const repository = await localProductRepository();
  const pendingDeletes = pendingPermanentDeleteDeckIds();
  return (await repository.listDecks())
    .filter((deck) => !pendingDeletes.has(deck.id))
    .map((deck) => ({
      id: deck.id,
      sourceTemplateKey: deck.payload.sourceTemplateKey,
    }));
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
    if (!hasInteractiveGeographyOverview(card.payload)) {
      current.cardCount += 1;
      if (reviewedCards.has(card.id)) current.reviewedCardCount += 1;
    }
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
    supplementalContent: card.supplementalContent ?? [],
    questionLocale: card.questionLocale ?? null,
    answerLocale: card.answerLocale ?? null,
    ...(card.languageDirectionMode
      ? { languageDirectionMode: card.languageDirectionMode }
      : {}),
    translations: card.translations,
    kind: card.kind ?? "QUESTION",
    usage: card.usage ?? "LEARNING",
    linkedToPrevious: card.linkedToPrevious ?? false,
    ratingEnabled: card.ratingEnabled ?? true,
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
      ...(card.supplementalContent ?? []).map((item) => item.content),
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
    if (isDictionaryLanguageDeck(deck)) {
      await clearXefjordPhraseIndexes(new Set([deck.id]));
    }
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
  const referenceSeedDeckIds = developerReferenceDeckIds(
    seeds.map((seed) => ({
      id: idsByKey.get(seed.key)!,
      parentDeckId: seed.parentKey ? idsByKey.get(seed.parentKey)! : null,
      tags: seed.tags,
    })),
  );
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
        learningEnabled: referenceSeedDeckIds.has(deckId)
          ? false
          : (existing?.payload.learningEnabled ??
            existing?.payload.favorite ??
            false),
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
          usage: cardSeed.usage ?? "LEARNING",
          linkedToPrevious: cardSeed.linkedToPrevious ?? false,
          position,
          suspended:
            cardSeed.suspended ?? existingCard?.payload.suspended ?? false,
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
  const installed = (await listLocalInstalledTemplateDecks()).find(
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
  uiLocale: Locale;
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
  content: { blocks: readonly unknown[] },
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
      const storedBlock = block as CardContent["blocks"][number];
      const mediaId = mediaIds.get(candidate.mediaId);
      if (!mediaId) throw new Error("Ein FNF-Medium fehlt im Paket.");
      if (storedBlock.type === "video" && storedBlock.posterMediaId) {
        const posterMediaId = mediaIds.get(storedBlock.posterMediaId);
        if (!posterMediaId)
          throw new Error("Ein FNF-Vorschaubild fehlt im Paket.");
        return [{ ...storedBlock, mediaId, posterMediaId }];
      }
      return [{ ...storedBlock, mediaId }];
    }
    const storedBlock = block as CardContent["blocks"][number];
    if (storedBlock.type === "imageOverlay") {
      const baseMediaId = mediaIds.get(storedBlock.baseMediaId);
      const overlayMediaId = mediaIds.get(storedBlock.overlayMediaId);
      if (!baseMediaId || !overlayMediaId) {
        throw new Error("Ein FNF-Overlaymedium fehlt im Paket.");
      }
      return [{ ...storedBlock, baseMediaId, overlayMediaId }];
    }
    return [storedBlock];
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
  dictionaryDeckIds: string[];
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
      ? [languageHubTitle, ...sourceDeck.path]
      : sourceDeck.path;
  if (input.parsed.importProfile === "XEFJORD") {
    const existingCollection =
      input.reimportMode === "COPY"
        ? undefined
        : existingDecks.find(
            (deck) => deck.payload.sourceTemplateKey === languageHubTemplateKey,
          );
    const collectionId =
      existingCollection?.id ??
      (await stableImportId("anki-deck", "xefjord-complete"));
    deckIds.set(languageHubTitle, collectionId);
    pathTitles.set(languageHubTitle, languageHubTitle);
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
  const dictionaryDeckIds = new Set<string>();
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
    const isXefjordCollection =
      input.parsed.importProfile === "XEFJORD" && id === rootId;
    const isXefjordLanguageRoot =
      input.parsed.importProfile === "XEFJORD" && parentDeckId === rootId;
    if (isXefjordLanguageRoot) dictionaryDeckIds.add(id);
    const existingDictionaryBasis = isXefjordLanguageRoot
      ? existingDecks.find(
          (deck) =>
            deck.id !== id &&
            deck.payload.parentDeckId === rootId &&
            dictionaryDeckLocale(deck.payload) === targetLocale &&
            !deck.payload.tags.includes(dictionaryPivotDisabledTag) &&
            !deck.payload.archivedAt,
        )
      : undefined;
    const deckPayload = localDeckPayloadSchema.parse({
      parentDeckId,
      title: pathTitles.get(path) ?? input.parsed.title,
      description:
        importedDeck?.description ??
        (path === "" || id === rootId
          ? `${input.parsed.format}-Import · lokal verarbeitet`
          : ""),
      language: isXefjordCollection
        ? "en"
        : (importedDeck?.language ?? sourceLocale),
      contentLocales: isXefjordCollection
        ? ["en"]
        : (importedDeck?.contentLocales ?? [
            ...new Set([sourceLocale, targetLocale]),
          ]),
      defaultContentLocale: isXefjordCollection
        ? "en"
        : (importedDeck?.defaultContentLocale ?? sourceLocale),
      sourceLocale: isXefjordCollection
        ? "en"
        : (importedDeck?.sourceLocale ?? sourceLocale),
      targetLocale: isXefjordCollection
        ? "en"
        : (importedDeck?.targetLocale ?? targetLocale),
      languageDirectionMode:
        importedDeck?.languageDirectionMode ??
        (id === rootId || isXefjordLanguageRoot ? "OVERRIDE" : "INHERIT"),
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
          ? isXefjordCollection
            ? languageHubCollectionTags(existing?.payload.tags)
            : isXefjordLanguageRoot
              ? dictionaryLanguageDeckTags({
                  tags: existing?.payload.tags ?? ["Xefjord"],
                  locale: targetLocale,
                  pivotLocale: sourceLocale,
                  pivotDisabled: Boolean(existingDictionaryBasis),
                })
              : [
                  "Anki Import",
                  ...(input.parsed.importProfile === "XEFJORD"
                    ? ["Xefjord"]
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
          ? languageHubTemplateKey
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
        supplementalContent: (
          sourceCard.supplementalContent ??
          Object.entries(sourceCard.sourceFields ?? {})
            .filter(
              ([label, content]) =>
                !(sourceCard.sourceDisplayedFields ?? []).includes(label) &&
                !(sourceCard.sourceTechnicalFields ?? []).includes(label) &&
                content.blocks.length > 0,
            )
            .map(([label, content]) => ({ label, content }))
        )
          .map(({ label, content }) => ({
            label,
            content: replaceImportedMedia(content, mediaIds),
          }))
          .filter(({ content }) => hasCardContent(content))
          .slice(0, 200),
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
        usage: sourceCard.usage ?? existing?.payload.usage ?? "LEARNING",
        linkedToPrevious: sourceCard.linkedToPrevious ?? false,
        ratingEnabled:
          "ratingEnabled" in sourceCard ? sourceCard.ratingEnabled : true,
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
  if (dictionaryDeckIds.size) {
    await clearXefjordPhraseIndexes(dictionaryDeckIds);
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
    dictionaryDeckIds: [...dictionaryDeckIds],
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
  const storedDecks = await repository.listDecks();
  const [deck] = storedDecks.filter((candidate) => candidate.id === deckId);
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
        usage: card.usage ?? "LEARNING",
        linkedToPrevious: card.linkedToPrevious,
        ratingEnabled: card.ratingEnabled ?? true,
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
  const dictionaryRootId = languageHubDictionaryRootId(storedDecks, deckId);
  if (dictionaryRootId) {
    await clearXefjordPhraseIndexes(new Set([dictionaryRootId]));
  }
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
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  const plan = await activeNamedStudyPlan(repository);
  const nextDeckIds = new Set(plan.deckIds);
  for (const id of affectedIds) {
    if (learningEnabled && !referenceDeckIds.has(id)) nextDeckIds.add(id);
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

export async function updateLocalProductLearningPlanDecks(
  deckIds: ReadonlySet<string>,
  learningEnabled: boolean,
): Promise<string[]> {
  await ensureLocalLearningPlanMigration();
  const repository = await localProductRepository();
  const decks = await repository.listDecks();
  const knownIds = new Set(decks.map((deck) => deck.id));
  if (deckIds.size === 0 || [...deckIds].some((id) => !knownIds.has(id))) {
    throw new Error("Das Lernset wurde nicht gefunden.");
  }
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  const plan = await activeNamedStudyPlan(repository);
  const nextDeckIds = new Set(plan.deckIds);
  for (const id of deckIds) {
    if (learningEnabled && !referenceDeckIds.has(id)) nextDeckIds.add(id);
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
  return [...deckIds];
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
  if (decks.length) await clearXefjordPhraseIndexes(deckIds);
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
  learningPlanOnly = false,
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
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  const selectedDeckIds = new Set(
    deckId
      ? deckDescendantIds(hierarchy, deckId)
      : [...activeDeckIds].filter(
          (id) => learningDeckIds.has(id) && !referenceDeckIds.has(id),
        ),
  );
  for (const id of [...selectedDeckIds]) {
    if (
      !activeDeckIds.has(id) ||
      (learningPlanOnly && !learningDeckIds.has(id))
    ) {
      selectedDeckIds.delete(id);
    }
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
  const cards = (
    await repository.listStudyCards({
      deckIds: [...selectedDeckIds],
      dueBefore: now.toISOString(),
      introducedAfter: localDayStart(now),
      includeFutureReviews: includeAll,
      excludedCardIds: [...excludedCardIds],
      reviewLimit,
      newDeckIds: newCandidateLimit > 0 ? newDeckIds : [],
      newLimit: newCandidateLimit,
    })
  ).filter((card) => !hasInteractiveGeographyOverview(card.payload));
  const queuedWithoutRatings = cards.map(
    (card) =>
      ({
        card: localCard(
          card,
          deckById.get(card.payload.deckId),
          directions.get(card.payload.deckId),
        ),
        studyMode:
          card.payload.usage === "REFERENCE" ||
          referenceDeckIds.has(card.payload.deckId)
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
      isDueQuestion:
        due.studyMode === "REFERENCE" || due.card.kind !== "EXPLANATION",
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
  paceContext: {
    introducedInWindow: number;
    observedCalendarDays: number;
    fallbackDailyGoal: number;
  };
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
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  const eligibleDeckIds = new Set(
    [...visibleDeckIds(hierarchy)].filter(
      (id) =>
        !archived.has(id) && planDeckIds.has(id) && !referenceDeckIds.has(id),
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
  const referenceDeckIds = localDeveloperReferenceDeckIds(decks);
  const activeDeckIds = [...visibleDeckIds(hierarchy)].filter(
    (id) =>
      !archived.has(id) && planDeckIds.has(id) && !referenceDeckIds.has(id),
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
      paceContext: {
        introducedInWindow: 0,
        observedCalendarDays: 1,
        fallbackDailyGoal: settings?.payload.dailyGoal ?? 10,
      },
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
    paceContext: {
      introducedInWindow: rollingCounts.introducedToday,
      observedCalendarDays,
      fallbackDailyGoal: settings?.payload.dailyGoal ?? 10,
    },
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
    locale: isLocale(storedLocale) ? storedLocale : defaultLocale,
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

const fnfSha256Hex = async (bytes: BufferSource): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function exportLocalProductDeckPackage(
  rootDeckId: string,
): Promise<Blob> {
  const repository = await localProductRepository();
  const [decks, cards, mediaReferences] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.listMedia(),
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
      ...(card.payload.supplementalContent ?? []).map((item) => item.content),
      ...Object.values(card.payload.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ]) {
      for (const mediaId of contentMediaIds(content))
        referencedMediaIds.add(mediaId);
    }
  }
  const referenceById = new Map(
    mediaReferences.map((entry) => [entry.id, entry]),
  );
  const mediaFiles = await Promise.all(
    [...referencedMediaIds].sort().map(async (mediaId) => {
      const stored = await repository.getMedia(mediaId);
      if (!stored) throw new Error("Ein referenziertes lokales Medium fehlt.");
      const reference = referenceById.get(mediaId);
      return {
        id: mediaId,
        fileName: reference?.payload.fileName ?? null,
        mimeType: stored.mimeType,
        sha256: stored.sha256,
        bytes: stored.bytes,
      };
    }),
  );
  const deckRecords = selectedDecks.map((deck) =>
    fnfV3DeckSchema.parse({
      schemaVersion: 1,
      id: deck.id,
      parentId:
        deck.payload.parentDeckId && selectedIds.has(deck.payload.parentDeckId)
          ? deck.payload.parentDeckId
          : null,
      title: deck.payload.title,
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
    }),
  );
  const noteRecords: FnfV3Note[] = [
    ...new Map(
      selectedCards.map((card) => {
        const id = card.payload.noteId ?? card.id;
        return [id, { schemaVersion: 1 as const, id }];
      }),
    ).values(),
  ];
  const cardRecords: FnfV3Card[] = selectedCards.map((card) => ({
    schemaVersion: 1,
    id: card.id,
    deckId: card.payload.deckId,
    noteId: card.payload.noteId ?? card.id,
    position: card.payload.position,
    front: card.payload.front,
    back: card.payload.back,
    supplementalContent: card.payload.supplementalContent ?? [],
    tags: card.payload.tags,
    questionLocale: card.payload.questionLocale,
    answerLocale: card.payload.answerLocale,
    languageDirectionMode: card.payload.languageDirectionMode,
    linkedToPrevious: card.payload.linkedToPrevious,
    ratingEnabled: card.payload.ratingEnabled,
    translations: card.payload.translations,
    kind: card.payload.kind,
    usage: card.payload.usage,
    suspended: card.payload.suspended,
  }));
  const mediaRecords: FnfV3Media[] = mediaFiles.map((media) => ({
    schemaVersion: 1,
    id: media.id,
    path: `media/sha256/${media.sha256}`,
    fileName: media.fileName,
    mimeType: media.mimeType,
    byteSize: media.bytes.byteLength,
    sha256: media.sha256,
  }));
  const encoder = new TextEncoder();
  const structuredEntries = new Map<string, Uint8Array>([
    [
      "content/decks.jsonl",
      encoder.encode(stringifyFnfV3JsonLines(deckRecords)),
    ],
    [
      "content/notes.jsonl",
      encoder.encode(stringifyFnfV3JsonLines(noteRecords)),
    ],
    [
      "content/cards.jsonl",
      encoder.encode(stringifyFnfV3JsonLines(cardRecords)),
    ],
    [
      "content/media.jsonl",
      encoder.encode(stringifyFnfV3JsonLines(mediaRecords)),
    ],
  ]);
  const entryRecords: FnfV3Entry[] = [];
  for (const [path, bytes] of structuredEntries) {
    entryRecords.push({
      path,
      mediaType: "application/x-ndjson",
      byteSize: bytes.byteLength,
      sha256: await fnfSha256Hex(bytes.slice().buffer),
    });
  }
  for (const media of mediaFiles) {
    const path = `media/sha256/${media.sha256}`;
    if (entryRecords.some((entry) => entry.path === path)) continue;
    entryRecords.push({
      path,
      mediaType: media.mimeType,
      byteSize: media.bytes.byteLength,
      sha256: media.sha256,
    });
  }
  const manifest = fnfV3ManifestSchema.parse({
    format: "flash-n-flip.package",
    formatVersion: 3,
    packageId: crypto.randomUUID(),
    lineageId: root.id,
    createdAt: new Date().toISOString(),
    generator: {
      name: "Flash-n-Flip",
      version: process.env.NEXT_PUBLIC_FNF_APP_VERSION ?? "development",
    },
    profile: "CONTENT_ONLY",
    requiredFeatures: [
      "core-content-v1",
      "structured-blocks-v1",
      "mermaid-diagram-v1",
      "music-score-v1",
      "jsx-graph-v1",
      "reference-card-v1",
    ],
    optionalFeatures: [],
    roots: [root.id],
    entries: entryRecords,
  });
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.flash-n-flip.package+zip;version=3", {
    compression: "STORE",
  });
  zip.file("manifest.json", JSON.stringify(manifest), {
    compression: "DEFLATE",
  });
  for (const [path, bytes] of structuredEntries) {
    zip.file(path, bytes, { compression: "DEFLATE" });
  }
  for (const media of mediaFiles) {
    const path = `media/sha256/${media.sha256}`;
    if (!zip.file(path)) zip.file(path, media.bytes, { compression: "STORE" });
  }
  return zip.generateAsync({ type: "blob", mimeType: fnfV3ContainerMediaType });
}

export async function exportLocalProductBackupEnvelope() {
  return (await localProductRepository()).exportAll();
}

export async function restoreLocalProductBackupEnvelope(
  candidate: unknown,
): Promise<void> {
  await (await localProductRepository()).restoreAll(candidate);
  await clearXefjordPhraseIndexes();
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
  if (
    mutations.some(
      (mutation) =>
        mutation.entityType === "DECK" || mutation.entityType === "CARD",
    )
  ) {
    await clearXefjordPhraseIndexes();
  }
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
