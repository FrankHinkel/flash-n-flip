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
import type { CardContent } from "@flashcards/domain/content";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";

import { getOrCreateLocalDeviceIdentity } from "./device-identity";

let repositoryPromise: Promise<LocalAppRepository> | null = null;

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

export const localProductRepository = (): Promise<LocalAppRepository> => {
  repositoryPromise ??= getOrCreateLocalDeviceIdentity().then(
    (identity) => new LocalAppRepository(identity.id),
  );
  return repositoryPromise;
};

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

  await repository.authority.commitLocalMutations(mutations);
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
  if (input.cards.length > 900) {
    throw new Error("Ein lokaler Textimport ist auf 900 Karten begrenzt.");
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
  const repository = await localProductRepository();
  const deck = (await repository.listDecks()).find(
    (candidate) => candidate.id === deckId,
  );
  if (!deck) return;
  await repository.deleteDeck(deck);
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
  const backup = await (await localProductRepository()).exportAll();
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

export async function restoreLocalProductData(file: Blob): Promise<void> {
  if (file.size > 700 * 1024 * 1024) {
    throw new Error("Die Sicherungsdatei ist zu groß.");
  }
  const parsed = JSON.parse(await file.text()) as unknown;
  await (await localProductRepository()).restoreAll(parsed);
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
