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

export const localProductRepository = (): Promise<LocalAppRepository> => {
  repositoryPromise ??= getOrCreateLocalDeviceIdentity().then(
    (identity) => new LocalAppRepository(identity.id),
  );
  return repositoryPromise;
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
  return cards
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
