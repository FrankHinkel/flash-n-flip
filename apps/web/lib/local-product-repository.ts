"use client";

import type {
  Card,
  DeckCardPage,
  DeckDetail,
  DeckEditorCommitInput,
  DeckSummary,
  DueCard,
} from "@flashcards/api-client";
import { LocalAppRepository } from "@flashcards/direct-connect-webstack/local-app";
import { getOrCreateDeviceIdentity } from "@flashcards/direct-connect-webstack/identity";
import {
  createId,
  deckDescendantIds,
  hasDeveloperReferenceTag,
  type PeerMutation,
  type ReplicaWatermarks,
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
  cardContentSchema,
  type CardContent,
} from "@flashcards/domain/content";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";
import { maximumLocalMutationBatchSize } from "@flashcards/sync/local-authority";

import type { LocalFileImport } from "./local-file-import";

let repositoryPromise: Promise<LocalAppRepository> | null = null;
const incompleteLocalImportMediaKey =
  "flash-n-flip.incomplete-local-import-media.v1";

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

const localProductSnapshot = async () => {
  const repository = await localProductRepository();
  const [decks, cards, reviews, media] = await Promise.all([
    repository.listDecks(),
    repository.listCards(),
    repository.listReviews(),
    repository.listMedia(),
  ]);
  return { repository, decks, cards, reviews, media };
};

export async function listLocalProductDecks(
  includeHidden = false,
  includeArchived = false,
): Promise<DeckSummary[]> {
  const { decks, cards, reviews, media } = await localProductSnapshot();
  const reviewedCards = new Set(reviews.map((review) => review.payload.cardId));
  return decks
    .filter(
      (deck) =>
        (includeHidden || !deck.payload.hiddenAt) &&
        (includeArchived || !deck.payload.archivedAt),
    )
    .map((deck) => {
      const deckCards = cards.filter((card) => card.payload.deckId === deck.id);
      const deckMedia = media.filter(
        (entry) => entry.payload.deckId === deck.id,
      );
      const metadataBytes = new TextEncoder().encode(
        JSON.stringify({ deck: deck.payload, cards: deckCards }),
      ).byteLength;
      return {
        ...deckFields(deck),
        cardCount: deckCards.length,
        reviewedCardCount: deckCards.filter((card) =>
          reviewedCards.has(card.id),
        ).length,
        storageBytes:
          metadataBytes +
          deckMedia.reduce((sum, entry) => sum + entry.payload.byteSize, 0),
      } satisfies DeckSummary;
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function isLocalProductDeck(deckId: string): Promise<boolean> {
  return (await localProductRepository())
    .listDecks()
    .then((decks) => decks.some((deck) => deck.id === deckId));
}

export async function getLocalProductDeck(
  deckId: string,
): Promise<DeckDetail | null> {
  const { decks, cards } = await localProductSnapshot();
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
  cards: Array<{ front: string; back: string }>;
}) {
  if (!input.cards.length)
    throw new Error("Die Importdatei enthält keine Karten.");
  if (input.cards.length > 10_000) {
    throw new Error("Ein lokaler Textimport ist auf 10.000 Karten begrenzt.");
  }
  const deck = await createLocalProductDeck({
    title: input.title,
    language: input.sourceLocale,
    contentLocales: [input.sourceLocale, input.targetLocale],
    defaultContentLocale: input.sourceLocale,
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    tags: ["Local import"],
  });
  const cards = input.cards.map((card) => ({
    id: createId(),
    noteId: createId(),
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
    kind: "QUESTION" as const,
    linkedToPrevious: false,
  }));
  return commitLocalDeckEditor(deck.id, {
    mutationId: createId(),
    version: deck.version,
    deck: {
      title: deck.title,
      description: deck.description,
      language: deck.language,
      parentDeckId: deck.parentDeckId,
      sourceLocale: deck.sourceLocale,
      targetLocale: deck.targetLocale,
      studyOrder: deck.studyOrder,
      tags: deck.tags,
      visual: deck.visual,
    },
    createdCards: cards,
    updatedCards: [],
    deletedCards: [],
    cardOrder: {
      cardIds: cards.map((card) => card.id),
      cardPage: 1,
      cardPageSize: Math.max(1, cards.length),
    },
  });
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

const replaceContentMediaId = (
  content: CardContent,
  originalMediaId: string,
  derivativeMediaId: string,
): { content: CardContent; changed: boolean } => {
  let changed = false;
  const blocks = content.blocks.map((block) => {
    if (
      (block.type === "image" ||
        block.type === "audio" ||
        block.type === "video") &&
      block.mediaId === originalMediaId
    ) {
      changed = true;
      return { ...block, mediaId: derivativeMediaId };
    }
    if (block.type === "imageOverlay") {
      const baseMediaId =
        block.baseMediaId === originalMediaId
          ? derivativeMediaId
          : block.baseMediaId;
      const overlayMediaId =
        block.overlayMediaId === originalMediaId
          ? derivativeMediaId
          : block.overlayMediaId;
      if (
        baseMediaId !== block.baseMediaId ||
        overlayMediaId !== block.overlayMediaId
      ) {
        changed = true;
        return { ...block, baseMediaId, overlayMediaId };
      }
    }
    return block;
  });
  return {
    content: changed ? cardContentSchema.parse({ blocks }) : content,
    changed,
  };
};

export async function installOptimizedLocalAudio(input: {
  originalMediaId: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ derivativeMediaId: string; affectedCards: number }> {
  const repository = await localProductRepository();
  const reference = (await repository.listMedia()).find(
    (item) => item.id === input.originalMediaId,
  );
  if (!reference)
    throw new Error("Das Originalaudio ist nicht mehr vorhanden.");
  const derivativeMediaId = createId();
  const now = new Date().toISOString();
  const cardMutations: LocalMutationInput[] = [];
  for (const card of await repository.listCards()) {
    const front = replaceContentMediaId(
      card.payload.front,
      input.originalMediaId,
      derivativeMediaId,
    );
    const back = replaceContentMediaId(
      card.payload.back,
      input.originalMediaId,
      derivativeMediaId,
    );
    const translations = Object.fromEntries(
      Object.entries(card.payload.translations).map(([locale, translation]) => {
        const translatedFront = replaceContentMediaId(
          translation.front,
          input.originalMediaId,
          derivativeMediaId,
        );
        const translatedBack = replaceContentMediaId(
          translation.back,
          input.originalMediaId,
          derivativeMediaId,
        );
        return [
          locale,
          {
            front: translatedFront.content,
            back: translatedBack.content,
          },
        ];
      }),
    );
    if (
      !front.changed &&
      !back.changed &&
      JSON.stringify(translations) === JSON.stringify(card.payload.translations)
    ) {
      continue;
    }
    cardMutations.push({
      entityId: card.id,
      entityType: "CARD",
      operation: "UPSERT",
      baseVersion: card.version,
      payload: localCardPayloadSchema.parse({
        ...card.payload,
        front: front.content,
        back: back.content,
        translations,
        updatedAt: now,
      }),
    });
  }
  if (!cardMutations.length) {
    throw new Error("Das Originalaudio wird von keiner Karte verwendet.");
  }
  await repository.installMediaDerivative({
    id: derivativeMediaId,
    deckId: reference.payload.deckId,
    fileName: `${reference.payload.fileName}.optimized.m4a`,
    mimeType: input.mimeType,
    bytes: input.bytes,
    cardMutations,
  });
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return { derivativeMediaId, affectedCards: cardMutations.length };
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
  const pathTitles = new Map<string, string>();
  const deckPath = (parts: readonly string[]) => parts.join("\u001f");
  for (const sourceDeck of input.parsed.decks) {
    for (let length = 1; length <= sourceDeck.path.length; length += 1) {
      const parts = sourceDeck.path.slice(0, length);
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
  localStorage.setItem(
    incompleteLocalImportMediaKey,
    JSON.stringify([...mediaIds.values()]),
  );
  const now = new Date().toISOString();
  const mutations: LocalMutationInput[] = [];
  for (const [path, id] of deckIds) {
    const parts = path ? path.split("\u001f") : [];
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
          path === "" || id === rootId
            ? `${input.parsed.format}-Import · lokal verarbeitet`
            : "",
        language: sourceLocale,
        contentLocales: [...new Set([sourceLocale, targetLocale])],
        defaultContentLocale: sourceLocale,
        sourceLocale,
        targetLocale,
        studyOrder: "SCHEDULED",
        protectionMode: "STANDARD",
        tags: ["Local import", input.parsed.format],
        favorite: false,
        hiddenAt: null,
        archivedAt: null,
        visual: null,
        sourceTemplateKey: null,
        createdAt: now,
        updatedAt: now,
      }),
    });
  }
  let cardCount = 0;
  for (const sourceDeck of input.parsed.decks) {
    const deckId = deckIds.get(deckPath(sourceDeck.path));
    if (!deckId)
      throw new Error("Die importierte Lernset-Hierarchie ist defekt.");
    for (const [position, sourceCard] of sourceDeck.cards.entries()) {
      const cardId = createId();
      mutations.push({
        entityId: cardId,
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: null,
        payload: localCardPayloadSchema.parse({
          deckId,
          noteId: createId(),
          front: replaceImportedMedia(sourceCard.front, mediaIds),
          back: replaceImportedMedia(sourceCard.back, mediaIds),
          questionLocale: sourceCard.questionLocale ?? sourceLocale,
          answerLocale: sourceCard.answerLocale ?? targetLocale,
          translations: {},
          kind: "QUESTION",
          linkedToPrevious: sourceCard.linkedToPrevious ?? false,
          position,
          suspended: false,
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
  await repository.saveDeck({
    id: deck.id,
    version: deck.version,
    ...deck.payload,
    ...update,
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
  if (!decks.length) return;
  if (decks.length !== deckIds.size)
    throw new Error("Mindestens ein Lernset wurde nicht gefunden.");
  await repository.deleteDecks(decks);
}

export async function localDueCards(
  deckId?: string,
  includeAll = false,
): Promise<DueCard[]> {
  const { decks, cards } = await localProductSnapshot();
  const selectedDeckIds = deckId
    ? deckDescendantIds(
        decks.map((deck) => ({
          id: deck.id,
          parentDeckId: deck.payload.parentDeckId,
        })),
        deckId,
      )
    : new Set(decks.map((deck) => deck.id));
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
}): Promise<void> {
  await (
    await localProductRepository()
  ).reviewCard(
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
      const stored = await repository.peerMediaBytes(mediaId);
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
          sourceNoteId: card.payload.noteId,
          front: card.payload.front,
          back: card.payload.back,
          tags: deck.payload.tags.slice(0, 30),
        })),
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
  const media = await (await localProductRepository()).getMedia(mediaId);
  return media
    ? new Blob([media.bytes.slice().buffer as ArrayBuffer], {
        type: media.mimeType,
      })
    : null;
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
