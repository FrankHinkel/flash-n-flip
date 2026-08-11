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
  deckDescendantIds,
  hasDeveloperReferenceTag,
  visibleDeckIds,
  type PeerMutation,
  type ReplicaWatermarks,
  type CardState,
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
  type LocalSettingsPayload,
} from "@flashcards/domain/local-app-data";
import type { LocalMutationInput } from "@flashcards/domain/local-authority";
import {
  selectPreferredAudioDerivative,
  type AudioQualityMeasurement,
  type LocalAudioDerivativePayload,
} from "@flashcards/domain/audio-optimization";
import {
  cardContentSchema,
  type CardContent,
} from "@flashcards/domain/content";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";
import { maximumLocalMutationBatchSize } from "@flashcards/sync/local-authority";

import type { LocalFileImport } from "./local-file-import";
import {
  xefjordCollectionTemplateKey,
  xefjordCollectionTitle,
} from "./xefjord-deck";

let repositoryPromise: Promise<LocalAppRepository> | null = null;
const incompleteLocalImportMediaKey =
  "flash-n-flip.incomplete-local-import-media.v1";
const localDeckMetricsCacheKey = "flash-n-flip.local-deck-metrics.v1";
const pendingPermanentDeckDeletesKey =
  "flash-n-flip.pending-permanent-deck-deletes.v1";

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
): Card => ({
  id: entity.id,
  deckId: entity.payload.deckId,
  noteId: entity.payload.noteId ?? entity.id,
  front: entity.payload.front,
  back: entity.payload.back,
  questionLocale: entity.payload.questionLocale ?? null,
  answerLocale: entity.payload.answerLocale ?? null,
  translations: entity.payload.translations,
  kind: entity.payload.kind,
  position: entity.payload.position,
  linkedToPrevious: entity.payload.linkedToPrevious,
  version: entity.version,
  suspended: entity.payload.suspended,
  createdAt: entity.payload.createdAt,
  updatedAt: entity.payload.updatedAt,
});

const deckFields = (
  entity: Awaited<ReturnType<LocalAppRepository["listDecks"]>>[number],
) => ({
  id: entity.id,
  parentDeckId: entity.payload.parentDeckId,
  title: entity.payload.title,
  description: entity.payload.description,
  language: entity.payload.language,
  contentLocales: entity.payload.contentLocales,
  defaultContentLocale: entity.payload.defaultContentLocale,
  sourceLocale: entity.payload.sourceLocale,
  targetLocale: entity.payload.targetLocale,
  studyOrder: entity.payload.studyOrder,
  protectionMode: entity.payload.protectionMode,
  tags: entity.payload.tags,
  favorite: entity.payload.favorite,
  hiddenAt: entity.payload.hiddenAt,
  archivedAt: entity.payload.archivedAt,
  visual: entity.payload.visual,
  sourceTemplateKey: entity.payload.sourceTemplateKey,
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
  const decks = await (await localProductRepository()).listDecks();
  const cached = readLocalDeckMetrics();
  return filterLocalDeckSummaries(
    decks.map((deck) => {
      const metrics = cached.get(deck.id);
      return {
        ...deckFields(deck),
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
  const repository = await localProductRepository();
  const [decks, cards, reviews, media] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.listReviews(),
    repository.listMedia(),
  ]);
  const reviewedCards = new Set(reviews.map((review) => review.payload.cardId));
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
          ...deckFields(deck),
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
  const [decks, cards] = await Promise.all([
    repository.listDecks(),
    repository.listCards(deckId),
  ]);
  const deck = decks.find((candidate) => candidate.id === deckId);
  if (!deck) return null;
  return {
    ...deckFields(deck),
    cards: cards
      .filter((card) => card.payload.deckId === deckId)
      .map(localCard)
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
    studyOrder: deck.studyOrder ?? "SCHEDULED",
    protectionMode: deck.protectionMode,
    tags: deck.tags,
    favorite: deck.favorite,
    hiddenAt: deck.hiddenAt,
    archivedAt: deck.archivedAt,
    visual: deck.visual,
    sourceTemplateKey: deck.sourceTemplateKey,
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
}): Promise<{
  deckId: string;
  deckCount: number;
  cardCount: number;
  mediaCount: number;
  originalAudioBytes: number;
  audioMediaIds: string[];
}> {
  const repository = await localProductRepository();
  const sourceLocale = input.parsed.suggestedSourceLocale ?? input.sourceLocale;
  const targetLocale = input.parsed.suggestedTargetLocale ?? input.targetLocale;
  const deckIds = new Map<string, string>();
  const existingDeckIds = new Set<string>();
  const pathTitles = new Map<string, string>();
  const deckPath = (parts: readonly string[]) => parts.join("\u001f");
  const effectivePath = (sourceDeck: LocalFileImport["decks"][number]) =>
    input.parsed.importProfile === "XEFJORD"
      ? [xefjordCollectionTitle, ...sourceDeck.path]
      : sourceDeck.path;
  if (input.parsed.importProfile === "XEFJORD") {
    const existingCollection = (await repository.listDecks()).find(
      (deck) => deck.payload.sourceTemplateKey === xefjordCollectionTemplateKey,
    );
    const collectionId = existingCollection?.id ?? createId();
    deckIds.set(xefjordCollectionTitle, collectionId);
    pathTitles.set(xefjordCollectionTitle, xefjordCollectionTitle);
    if (existingCollection) existingDeckIds.add(collectionId);
  }
  for (const sourceDeck of input.parsed.decks) {
    const sourcePath = effectivePath(sourceDeck);
    for (let length = 1; length <= sourcePath.length; length += 1) {
      const parts = sourcePath.slice(0, length);
      const key = deckPath(parts);
      if (!deckIds.has(key)) {
        deckIds.set(key, createId());
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
    rootId = createId();
    const prefixed = new Map<string, string>([["", rootId]]);
    for (const [path, id] of deckIds) prefixed.set(path, id);
    deckIds.clear();
    for (const [path, id] of prefixed) deckIds.set(path, id);
    pathTitles.set("", input.parsed.title);
  }
  const mediaIds = new Map(
    input.parsed.media.map((media) => [media.sourceName, createId()]),
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
    if (existingDeckIds.has(id)) continue;
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
    mutations.push({
      entityId: id,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: null,
      payload: localDeckPayloadSchema.parse({
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
        defaultContentLocale:
          importedDeck?.defaultContentLocale ?? sourceLocale,
        sourceLocale: importedDeck?.sourceLocale ?? sourceLocale,
        targetLocale: importedDeck?.targetLocale ?? targetLocale,
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
        favorite: false,
        hiddenAt: null,
        archivedAt: null,
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
        createdAt: now,
        updatedAt: now,
      }),
    });
  }
  let cardCount = 0;
  for (const sourceDeck of input.parsed.decks) {
    const deckId = deckIds.get(deckPath(effectivePath(sourceDeck)));
    if (!deckId)
      throw new Error("Die importierte Lernset-Hierarchie ist defekt.");
    for (const [position, sourceCard] of sourceDeck.cards.entries()) {
      const cardId = createId();
      const noteKey = `${sourceDeck.sourceId}\u001f${sourceCard.sourceNoteId}`;
      const noteId = importedNoteIds.get(noteKey) ?? createId();
      importedNoteIds.set(noteKey, noteId);
      const importSource =
        input.parsed.format === "APKG"
          ? {
              kind: "ANKI" as const,
              sourceNoteId: sourceCard.sourceNoteId,
              sourceFieldText: sourceCard.sourceFieldText ?? {},
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
              ...(sourceCard.sourceState
                ? { sourceState: sourceCard.sourceState }
                : {}),
            }
          : null;
      mutations.push({
        entityId: cardId,
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: null,
        payload: localCardPayloadSchema.parse({
          deckId,
          noteId,
          tags: sourceCard.tags,
          ...(importSource ? { importSource } : {}),
          front: replaceImportedMedia(sourceCard.front, mediaIds),
          back: replaceImportedMedia(sourceCard.back, mediaIds),
          questionLocale: sourceCard.questionLocale ?? sourceLocale,
          answerLocale: sourceCard.answerLocale ?? targetLocale,
          translations: sourceCard.translations ?? {},
          kind: sourceCard.kind ?? "QUESTION",
          linkedToPrevious: sourceCard.linkedToPrevious ?? false,
          position,
          suspended:
            sourceCard.suspended ?? sourceCard.sourceState?.queue === -1,
          state: emptyCardState(new Date()),
          createdAt: now,
          updatedAt: now,
        }),
      });
      cardCount += 1;
    }
  }
  await repository.installLocalPackage({
    mutations,
    media: input.parsed.media.map((media) => ({
      id: mediaIds.get(media.sourceName)!,
      deckId: rootId,
      cardId: null,
      fileName: media.sourceName,
      mimeType: media.mimeType,
      bytes: media.bytes,
    })),
  });
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
      "favorite" | "hiddenAt" | "archivedAt" | "parentDeckId"
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
): Promise<DueCard[]> {
  const repository = await localProductRepository();
  const [decks, cards] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
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
  const selectedDeckIds = new Set(
    deckId ? deckDescendantIds(hierarchy, deckId) : activeDeckIds,
  );
  for (const id of [...selectedDeckIds]) {
    if (!activeDeckIds.has(id)) selectedDeckIds.delete(id);
  }
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const now = Date.now();
  const queued = cards
    .filter(
      (card) =>
        selectedDeckIds.has(card.payload.deckId) &&
        !card.payload.suspended &&
        (includeAll || Date.parse(card.payload.state.due) <= now),
    )
    .map(
      (card) =>
        ({
          card: localCard(card),
          studyMode: hasDeveloperReferenceTag(
            deckById.get(card.payload.deckId)?.payload.tags,
          )
            ? "REFERENCE"
            : "LEARNING",
          lastRating: null,
          state: card.payload.state,
          preview: previewRatings(card.payload.state, new Date()),
        }) satisfies DueCard,
    )
    .sort(
      (left, right) =>
        Date.parse(left.state.due) - Date.parse(right.state.due) ||
        (left.card.position ?? 0) - (right.card.position ?? 0),
    );
  const sequenceProgress = new Map<
    string,
    { completedCount: number; maximum: NumberPracticeMaximum }
  >();
  for (const card of cards) {
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
    queued.map(async (due) => {
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

export async function recordLocalProductReview(input: {
  mutationId: string;
  cardId: string;
  rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
  reviewedAt: string;
  timezone?: string;
  deckId?: string;
  state?: CardState;
  virtualCard?: XefjordCrossLanguageCardRef;
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
    return;
  }
  await repository.reviewCard(
    input.cardId,
    input.rating,
    new Date(input.reviewedAt),
    input.mutationId,
  );
}

export async function resetLocalProductDeckProgress(
  deckId: string,
): Promise<number> {
  const decks = await listLocalProductDecks(true, true);
  return (await localProductRepository()).resetDeckProgress(
    deckDescendantIds(decks, deckId),
  );
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
    dailyGoal: 20,
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
      studyOrder: deck.payload.studyOrder,
      tags: deck.payload.tags,
      visual: deck.payload.visual,
      sourceTemplateKey: deck.payload.sourceTemplateKey,
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
