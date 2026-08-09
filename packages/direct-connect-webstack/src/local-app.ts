import { createId } from "@flashcards/domain";
import type { CardState, ReviewRating } from "@flashcards/domain";
import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";
import {
  localAppBackupEnvelopeSchema,
  localCardContentPlainText,
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localMediaReferencePayloadSchema,
  localReviewPayloadSchema,
  localSettingsPayloadSchema,
  plainLocalCardContent,
} from "@flashcards/domain/local-app-data";
import type {
  LocalAppBackupEnvelope,
  LocalCardPayload,
  LocalDeckPayload,
  LocalMediaReferencePayload,
  LocalReviewPayload,
  LocalSettingsPayload,
} from "@flashcards/domain/local-app-data";
import type { LocalMaterializedEntity } from "@flashcards/domain/local-authority";
import type { PeerMutation } from "@flashcards/domain/device-sync";
import {
  applyRating,
  defaultParameters,
  emptyCardState,
  schedulerVersion,
} from "@flashcards/scheduler";
import { LocalAuthorityRepository } from "@flashcards/sync/local-authority";
import type { LocalAuthorityMutationValidator } from "@flashcards/sync/local-authority";

import {
  createLocalAuthorityStorage,
  webCryptoLocalAuthorityHasher,
} from "./local-authority-storage";
import { createLocalMediaStorage } from "./media-storage";
import type { LocalMediaStorage, StoredLocalMedia } from "./media-storage";

export const localSettingsId = "00000000-0000-4000-8000-000000000001";
export { localCardContentPlainText };

const parsePayload = (mutation: PeerMutation): void => {
  if (mutation.operation === "DELETE") {
    if (mutation.payload !== null)
      throw new Error("Tombstone payload must be null");
    if (mutation.entityType === "REVIEW")
      throw new Error("Review events cannot be deleted");
    return;
  }
  switch (mutation.entityType) {
    case "DECK":
      localDeckPayloadSchema.parse(mutation.payload);
      return;
    case "CARD":
      localCardPayloadSchema.parse(mutation.payload);
      return;
    case "REVIEW":
      localReviewPayloadSchema.parse(mutation.payload);
      return;
    case "SETTING":
      localSettingsPayloadSchema.parse(mutation.payload);
      return;
    case "MEDIA_REFERENCE":
      localMediaReferencePayloadSchema.parse(mutation.payload);
      return;
    default:
      throw new Error(`Unsupported local entity type: ${mutation.entityType}`);
  }
};

export const validateLocalAppMutation: LocalAuthorityMutationValidator =
  parsePayload;

export type VersionedLocalEntity<T> = {
  id: string;
  version: number;
  payload: T;
};

type LocalSettingsWriteInput = Pick<
  LocalSettingsPayload,
  "theme" | "locale" | "dailyGoal"
> &
  Partial<
    Pick<
      LocalSettingsPayload,
      "pagePinchZoom" | "textToSpeechMode" | "showQuestionWithAnswer"
    >
  >;

const toVersioned = <T>(
  entity: LocalMaterializedEntity,
  parse: (payload: unknown) => T,
): VersionedLocalEntity<T> => ({
  id: entity.winningMutation.entityId,
  version: entity.currentVersion ?? 0,
  payload: parse(entity.winningMutation.payload),
});

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const sha256 = (bytes: Uint8Array): Promise<string> =>
  webCryptoLocalAuthorityHasher(bytes);

const contentMediaIds = (content: CardContent): Set<string> => {
  const ids = new Set<string>();
  for (const block of content.blocks) {
    if (
      block.type === "image" ||
      block.type === "audio" ||
      block.type === "video"
    ) {
      ids.add(block.mediaId);
      if (block.type === "video" && block.posterMediaId) {
        ids.add(block.posterMediaId);
      }
    } else if (block.type === "imageOverlay") {
      ids.add(block.baseMediaId);
      ids.add(block.overlayMediaId);
    }
  }
  return ids;
};

const cardMediaIds = (card: LocalCardPayload): Set<string> => {
  const ids = new Set<string>();
  for (const content of [
    card.front,
    card.back,
    ...Object.values(card.translations).flatMap((translation) => [
      translation.front,
      translation.back,
    ]),
  ]) {
    for (const id of contentMediaIds(content)) ids.add(id);
  }
  return ids;
};

export class LocalAppRepository {
  readonly authority: LocalAuthorityRepository;

  constructor(
    deviceId: string,
    private readonly media: LocalMediaStorage = createLocalMediaStorage(),
  ) {
    this.authority = new LocalAuthorityRepository(
      createLocalAuthorityStorage(),
      deviceId,
      webCryptoLocalAuthorityHasher,
      validateLocalAppMutation,
    );
  }

  async listDecks(): Promise<VersionedLocalEntity<LocalDeckPayload>[]> {
    return (await this.authority.listEntities({ entityType: "DECK" }))
      .map((entity) => toVersioned(entity, localDeckPayloadSchema.parse))
      .sort((left, right) =>
        left.payload.title.localeCompare(right.payload.title),
      );
  }

  async listCards(
    deckId?: string,
  ): Promise<VersionedLocalEntity<LocalCardPayload>[]> {
    return (await this.authority.listEntities({ entityType: "CARD" }))
      .map((entity) => toVersioned(entity, localCardPayloadSchema.parse))
      .filter((entity) => !deckId || entity.payload.deckId === deckId)
      .sort(
        (left, right) =>
          left.payload.position - right.payload.position ||
          left.id.localeCompare(right.id),
      );
  }

  async listReviews(
    deckId?: string,
  ): Promise<VersionedLocalEntity<LocalReviewPayload>[]> {
    return (await this.authority.listEntities({ entityType: "REVIEW" }))
      .map((entity) => toVersioned(entity, localReviewPayloadSchema.parse))
      .filter((entity) => !deckId || entity.payload.deckId === deckId)
      .sort((left, right) =>
        left.payload.reviewedAt.localeCompare(right.payload.reviewedAt),
      );
  }

  async listMedia(
    deckId?: string,
  ): Promise<VersionedLocalEntity<LocalMediaReferencePayload>[]> {
    return (
      await this.authority.listEntities({ entityType: "MEDIA_REFERENCE" })
    )
      .map((entity) =>
        toVersioned(entity, localMediaReferencePayloadSchema.parse),
      )
      .filter((entity) => !deckId || entity.payload.deckId === deckId);
  }

  async settings(): Promise<VersionedLocalEntity<LocalSettingsPayload> | null> {
    const settings = (
      await this.authority.listEntities({ entityType: "SETTING" })
    ).find((entity) => entity.winningMutation.entityId === localSettingsId);
    return settings
      ? toVersioned(settings, localSettingsPayloadSchema.parse)
      : null;
  }

  async installDeckSnapshot(input: {
    id: string;
    deck: LocalDeckPayload;
    cards: Array<{ id: string; payload: LocalCardPayload }>;
  }): Promise<boolean> {
    if ((await this.listDecks()).some((deck) => deck.id === input.id)) {
      return false;
    }
    if (input.cards.length > 999) {
      throw new Error(
        "A single local deck snapshot is limited to 999 cards during migration",
      );
    }
    await this.authority.commitLocalMutations([
      {
        entityId: input.id,
        entityType: "DECK",
        operation: "UPSERT",
        baseVersion: null,
        payload: localDeckPayloadSchema.parse(input.deck),
      },
      ...input.cards.map((card) => ({
        entityId: card.id,
        entityType: "CARD" as const,
        operation: "UPSERT" as const,
        baseVersion: null,
        payload: localCardPayloadSchema.parse(card.payload),
      })),
    ]);
    return true;
  }

  async saveDeck(input: {
    id?: string;
    version?: number;
    title: string;
    description?: string;
    language?: string;
    parentDeckId?: string | null;
    contentLocales?: string[];
    defaultContentLocale?: string;
    sourceLocale?: string;
    targetLocale?: string;
    studyOrder?: "SCHEDULED" | "SEQUENTIAL";
    protectionMode?: "STANDARD" | "ACCOUNT_BOUND";
    tags?: string[];
    favorite?: boolean;
    hiddenAt?: string | null;
    archivedAt?: string | null;
    visual?: LocalDeckPayload["visual"];
    sourceTemplateKey?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }): Promise<string> {
    const id = input.id ?? createId();
    const now = new Date().toISOString();
    const existing = input.id
      ? (await this.listDecks()).find((deck) => deck.id === input.id)
      : undefined;
    const payload = localDeckPayloadSchema.parse({
      parentDeckId:
        input.parentDeckId !== undefined
          ? input.parentDeckId
          : (existing?.payload.parentDeckId ?? null),
      title: input.title,
      description: input.description ?? existing?.payload.description ?? "",
      language: input.language ?? existing?.payload.language ?? "de",
      contentLocales: input.contentLocales ??
        existing?.payload.contentLocales ?? ["de"],
      defaultContentLocale:
        input.defaultContentLocale ??
        existing?.payload.defaultContentLocale ??
        input.language ??
        "de",
      sourceLocale:
        input.sourceLocale ?? existing?.payload.sourceLocale ?? "de",
      targetLocale:
        input.targetLocale ??
        existing?.payload.targetLocale ??
        input.language ??
        "de",
      studyOrder:
        input.studyOrder ?? existing?.payload.studyOrder ?? "SCHEDULED",
      protectionMode:
        input.protectionMode ??
        existing?.payload.protectionMode ??
        "ACCOUNT_BOUND",
      tags: input.tags ?? existing?.payload.tags ?? [],
      favorite: input.favorite ?? existing?.payload.favorite ?? false,
      hiddenAt:
        input.hiddenAt !== undefined
          ? input.hiddenAt
          : (existing?.payload.hiddenAt ?? null),
      archivedAt:
        input.archivedAt !== undefined
          ? input.archivedAt
          : (existing?.payload.archivedAt ?? null),
      visual:
        input.visual !== undefined
          ? input.visual
          : (existing?.payload.visual ?? null),
      sourceTemplateKey:
        input.sourceTemplateKey !== undefined
          ? input.sourceTemplateKey
          : (existing?.payload.sourceTemplateKey ?? null),
      createdAt: input.createdAt ?? existing?.payload.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
    await this.authority.commitLocalMutation({
      entityId: id,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: input.version ?? null,
      payload,
    });
    return id;
  }

  async saveCard(input: {
    id?: string;
    version?: number;
    deckId: string;
    noteId?: string;
    front: string | CardContent;
    back: string | CardContent;
    questionLocale?: string | null;
    answerLocale?: string | null;
    translations?: LocalizedCardContents;
    kind?: "QUESTION" | "EXPLANATION";
    linkedToPrevious?: boolean;
    position?: number;
    suspended?: boolean;
    state?: CardState;
    createdAt?: string;
    updatedAt?: string;
  }): Promise<string> {
    const id = input.id ?? createId();
    const now = new Date().toISOString();
    const existing = input.id
      ? (await this.listCards()).find((card) => card.id === input.id)
      : undefined;
    const payload = localCardPayloadSchema.parse({
      deckId: input.deckId,
      noteId: input.noteId ?? existing?.payload.noteId ?? createId(),
      front:
        typeof input.front === "string"
          ? existing &&
            localCardContentPlainText(existing.payload.front) ===
              input.front.trim()
            ? existing.payload.front
            : plainLocalCardContent(input.front)
          : input.front,
      back:
        typeof input.back === "string"
          ? existing &&
            localCardContentPlainText(existing.payload.back) ===
              input.back.trim()
            ? existing.payload.back
            : plainLocalCardContent(input.back)
          : input.back,
      questionLocale:
        input.questionLocale !== undefined
          ? input.questionLocale
          : (existing?.payload.questionLocale ?? null),
      answerLocale:
        input.answerLocale !== undefined
          ? input.answerLocale
          : (existing?.payload.answerLocale ?? null),
      translations: input.translations ?? existing?.payload.translations ?? {},
      kind: input.kind ?? existing?.payload.kind ?? "QUESTION",
      linkedToPrevious:
        input.linkedToPrevious ?? existing?.payload.linkedToPrevious ?? false,
      position:
        input.position ??
        existing?.payload.position ??
        (await this.listCards(input.deckId)).length,
      suspended: input.suspended ?? existing?.payload.suspended ?? false,
      state:
        input.state ?? existing?.payload.state ?? emptyCardState(new Date()),
      createdAt: input.createdAt ?? existing?.payload.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
    await this.authority.commitLocalMutation({
      entityId: id,
      entityType: "CARD",
      operation: "UPSERT",
      baseVersion: input.version ?? null,
      payload,
    });
    return id;
  }

  async reviewCard(
    cardId: string,
    rating: ReviewRating,
    reviewedAt = new Date(),
    reviewId = createId(),
  ): Promise<string> {
    const card = (await this.listCards()).find(
      (candidate) => candidate.id === cardId,
    );
    if (!card) throw new Error("Karte wurde nicht gefunden.");
    const after = applyRating(card.payload.state, rating, reviewedAt);
    const review = localReviewPayloadSchema.parse({
      reviewId,
      deckId: card.payload.deckId,
      cardId,
      reviewedAt: reviewedAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      rating,
      schedulerVersion,
      parameters: defaultParameters.w,
      before: card.payload.state,
      after,
    });
    await this.authority.commitLocalMutations([
      {
        entityId: cardId,
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: card.version,
        payload: {
          ...card.payload,
          state: after,
          updatedAt: reviewedAt.toISOString(),
        },
      },
      {
        entityId: reviewId,
        entityType: "REVIEW",
        operation: "UPSERT",
        baseVersion: null,
        payload: review,
      },
    ]);
    return reviewId;
  }

  async saveSettings(input: LocalSettingsWriteInput): Promise<void> {
    await this.writeSettings(() => input);
  }

  async patchSettings(
    input: Partial<Omit<LocalSettingsPayload, "updatedAt">>,
    fallback: Omit<LocalSettingsPayload, "updatedAt">,
  ): Promise<void> {
    await this.writeSettings((existing) => ({
      ...fallback,
      ...existing?.payload,
      ...input,
    }));
  }

  private async writeSettings(
    resolve: (
      existing: VersionedLocalEntity<LocalSettingsPayload> | null,
    ) => LocalSettingsWriteInput,
  ): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = await this.settings();
      const next = localSettingsPayloadSchema.parse({
        ...resolve(existing),
        updatedAt: new Date().toISOString(),
      });
      if (
        existing &&
        existing.payload.theme === next.theme &&
        existing.payload.locale === next.locale &&
        existing.payload.dailyGoal === next.dailyGoal &&
        existing.payload.pagePinchZoom === next.pagePinchZoom &&
        existing.payload.textToSpeechMode === next.textToSpeechMode &&
        existing.payload.showQuestionWithAnswer === next.showQuestionWithAnswer
      ) {
        return;
      }
      try {
        await this.authority.commitLocalMutation({
          entityId: localSettingsId,
          entityType: "SETTING",
          operation: "UPSERT",
          baseVersion: existing?.version ?? null,
          payload: next,
        });
        return;
      } catch (cause) {
        const isConcurrentWrite =
          cause instanceof Error &&
          cause.message.includes("Local version conflict");
        if (!isConcurrentWrite || attempt === 7) throw cause;
      }
    }
  }

  async addMedia(input: {
    id?: string;
    deckId: string;
    cardId?: string | null;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  }): Promise<string> {
    const mediaId = input.id ?? createId();
    const digest = await sha256(input.bytes);
    const stored: StoredLocalMedia = {
      mediaId,
      mimeType: input.mimeType,
      sha256: digest,
      bytes: input.bytes,
    };
    await this.media.put(stored);
    try {
      await this.authority.commitLocalMutation({
        entityId: mediaId,
        entityType: "MEDIA_REFERENCE",
        operation: "UPSERT",
        baseVersion: null,
        payload: localMediaReferencePayloadSchema.parse({
          deckId: input.deckId,
          cardId: input.cardId ?? null,
          fileName: input.fileName,
          mimeType: input.mimeType,
          byteSize: input.bytes.byteLength,
          sha256: digest,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (cause) {
      await this.media.delete(mediaId);
      throw cause;
    }
    return mediaId;
  }

  async getMedia(mediaId: string): Promise<StoredLocalMedia | null> {
    return this.media.get(mediaId);
  }

  async resetDeckProgress(deckIds: ReadonlySet<string>): Promise<number> {
    const cards = (await this.listCards()).filter((card) =>
      deckIds.has(card.payload.deckId),
    );
    const now = new Date();
    for (let offset = 0; offset < cards.length; offset += 1_000) {
      await this.authority.commitLocalMutations(
        cards.slice(offset, offset + 1_000).map((card) => ({
          entityId: card.id,
          entityType: "CARD" as const,
          operation: "UPSERT" as const,
          baseVersion: card.version,
          payload: {
            ...card.payload,
            state: emptyCardState(now),
            updatedAt: now.toISOString(),
          },
        })),
      );
    }
    return cards.length;
  }

  async deleteEntity(
    entity: VersionedLocalEntity<unknown>,
    entityType: "DECK" | "CARD" | "MEDIA_REFERENCE",
  ): Promise<void> {
    await this.authority.commitLocalMutation({
      entityId: entity.id,
      entityType,
      operation: "DELETE",
      baseVersion: entity.version,
      payload: null,
    });
    if (entityType === "MEDIA_REFERENCE") await this.media.delete(entity.id);
  }

  async deleteCard(
    card: VersionedLocalEntity<LocalCardPayload>,
  ): Promise<void> {
    const candidates = (await this.listMedia(card.payload.deckId)).filter(
      (entry) => entry.payload.cardId === card.id,
    );
    const retainedCards = (await this.listCards()).filter(
      (entry) => entry.id !== card.id,
    );
    const retainedDecks = await this.listDecks();
    const media = candidates.filter(
      (entry) =>
        !retainedCards.some((candidate) =>
          cardMediaIds(candidate.payload).has(entry.id),
        ) &&
        !retainedDecks.some(
          (deck) =>
            deck.payload.visual?.kind === "IMAGE" &&
            deck.payload.visual.value === entry.id,
        ),
    );
    const retainedMedia = candidates.filter(
      (entry) => !media.some((deleted) => deleted.id === entry.id),
    );
    await this.authority.commitLocalMutations([
      ...retainedMedia.map((entry) => {
        const ownerCard = retainedCards.find((candidate) =>
          cardMediaIds(candidate.payload).has(entry.id),
        );
        const ownerDeck = retainedDecks.find(
          (deck) =>
            deck.payload.visual?.kind === "IMAGE" &&
            deck.payload.visual.value === entry.id,
        );
        return {
          entityId: entry.id,
          entityType: "MEDIA_REFERENCE" as const,
          operation: "UPSERT" as const,
          baseVersion: entry.version,
          payload: {
            ...entry.payload,
            deckId: ownerCard?.payload.deckId ?? ownerDeck!.id,
            cardId: ownerCard?.id ?? null,
          },
        };
      }),
      ...media.map((entry) => ({
        entityId: entry.id,
        entityType: "MEDIA_REFERENCE" as const,
        operation: "DELETE" as const,
        baseVersion: entry.version,
        payload: null,
      })),
      {
        entityId: card.id,
        entityType: "CARD",
        operation: "DELETE",
        baseVersion: card.version,
        payload: null,
      },
    ]);
    for (const entry of media) await this.media.delete(entry.id);
  }

  async deleteDeck(
    deck: VersionedLocalEntity<LocalDeckPayload>,
  ): Promise<void> {
    const [cards, candidates, allCards, allDecks] = await Promise.all([
      this.listCards(deck.id),
      this.listMedia(deck.id),
      this.listCards(),
      this.listDecks(),
    ]);
    const deletedCardIds = new Set(cards.map((card) => card.id));
    const retainedCards = allCards.filter(
      (card) => !deletedCardIds.has(card.id),
    );
    const media = candidates.filter(
      (entry) =>
        !retainedCards.some((card) =>
          cardMediaIds(card.payload).has(entry.id),
        ) &&
        !allDecks.some(
          (candidate) =>
            candidate.id !== deck.id &&
            candidate.payload.visual?.kind === "IMAGE" &&
            candidate.payload.visual.value === entry.id,
        ),
    );
    const retainedMedia = candidates.filter(
      (entry) => !media.some((deleted) => deleted.id === entry.id),
    );
    if (cards.length + media.length > 999)
      throw new Error(
        "Dieses Deck muss vor dem Löschen in kleinere Decks geteilt werden.",
      );
    await this.authority.commitLocalMutations([
      ...retainedMedia.map((entry) => {
        const ownerCard = retainedCards.find((candidate) =>
          cardMediaIds(candidate.payload).has(entry.id),
        );
        const ownerDeck = allDecks.find(
          (candidate) =>
            candidate.id !== deck.id &&
            candidate.payload.visual?.kind === "IMAGE" &&
            candidate.payload.visual.value === entry.id,
        );
        return {
          entityId: entry.id,
          entityType: "MEDIA_REFERENCE" as const,
          operation: "UPSERT" as const,
          baseVersion: entry.version,
          payload: {
            ...entry.payload,
            deckId: ownerCard?.payload.deckId ?? ownerDeck!.id,
            cardId: ownerCard?.id ?? null,
          },
        };
      }),
      ...media.map((entry) => ({
        entityId: entry.id,
        entityType: "MEDIA_REFERENCE" as const,
        operation: "DELETE" as const,
        baseVersion: entry.version,
        payload: null,
      })),
      ...cards.map((entry) => ({
        entityId: entry.id,
        entityType: "CARD" as const,
        operation: "DELETE" as const,
        baseVersion: entry.version,
        payload: null,
      })),
      {
        entityId: deck.id,
        entityType: "DECK",
        operation: "DELETE",
        baseVersion: deck.version,
        payload: null,
      },
    ]);
    for (const entry of media) await this.media.delete(entry.id);
  }

  async exportAll(): Promise<LocalAppBackupEnvelope> {
    const [authority, media] = await Promise.all([
      this.authority.exportAll(),
      this.media.list(),
    ]);
    const references = await this.listMedia();
    const mediaById = new Map(media.map((entry) => [entry.mediaId, entry]));
    for (const reference of references) {
      const entry = mediaById.get(reference.id);
      if (
        !entry ||
        entry.mimeType !== reference.payload.mimeType ||
        entry.bytes.byteLength !== reference.payload.byteSize ||
        entry.sha256 !== reference.payload.sha256 ||
        (await sha256(entry.bytes)) !== reference.payload.sha256
      ) {
        throw new Error(
          `Local backup is missing or contains corrupt media: ${reference.payload.fileName}`,
        );
      }
    }
    if (media.length !== references.length)
      throw new Error("Local backup contains unreferenced media");
    return localAppBackupEnvelopeSchema.parse({
      format: "flash-n-flip-local-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      authority,
      media: media.map((entry) => ({
        mediaId: entry.mediaId,
        mimeType: entry.mimeType,
        sha256: entry.sha256,
        byteSize: entry.bytes.byteLength,
        dataBase64: bytesToBase64(entry.bytes),
      })),
    });
  }

  async restoreAll(candidate: unknown): Promise<void> {
    const backup = localAppBackupEnvelopeSchema.parse(candidate);
    if (!(await this.media.isEmpty()))
      throw new Error("Import requires empty media storage");
    const references = backup.authority.payload.entities
      .filter(
        (entity) =>
          entity.winningMutation.entityType === "MEDIA_REFERENCE" &&
          entity.winningMutation.operation === "UPSERT",
      )
      .map((entity) => ({
        mediaId: entity.winningMutation.entityId,
        payload: localMediaReferencePayloadSchema.parse(
          entity.winningMutation.payload,
        ),
      }));
    const backupMediaById = new Map(
      backup.media.map((entry) => [entry.mediaId, entry]),
    );
    for (const reference of references) {
      const entry = backupMediaById.get(reference.mediaId);
      if (
        !entry ||
        entry.mimeType !== reference.payload.mimeType ||
        entry.byteSize !== reference.payload.byteSize ||
        entry.sha256 !== reference.payload.sha256
      ) {
        throw new Error(
          `Backup is missing or mismatches media: ${reference.payload.fileName}`,
        );
      }
    }
    if (backup.media.length !== references.length)
      throw new Error("Backup contains unreferenced media");
    const media = await Promise.all(
      backup.media.map(async (entry) => {
        const bytes = base64ToBytes(entry.dataBase64);
        if (
          bytes.byteLength !== entry.byteSize ||
          (await sha256(bytes)) !== entry.sha256
        )
          throw new Error(`Media hash mismatch for ${entry.mediaId}`);
        return {
          mediaId: entry.mediaId,
          mimeType: entry.mimeType,
          sha256: entry.sha256,
          bytes,
        };
      }),
    );
    for (const entry of media) await this.media.put(entry);
    try {
      await this.authority.restoreAll(backup.authority);
    } catch (cause) {
      for (const entry of media) await this.media.delete(entry.mediaId);
      throw cause;
    }
  }

  async migratePhaseOne(
    snapshot: {
      deck: {
        id: string;
        title: string;
        modifiedAt: string;
        cards: Array<{ id: string; front: string; back: string }>;
      };
      review: {
        mutationId: string;
        deckId: string;
        cardId: string;
        rating: ReviewRating;
        reviewedAt: string;
      };
    } | null,
  ): Promise<boolean> {
    if (!snapshot || (await this.listDecks()).length > 0) return false;
    const reviewedAt = new Date(snapshot.review.reviewedAt);
    const before = emptyCardState(reviewedAt);
    const after = applyRating(before, snapshot.review.rating, reviewedAt);
    const card = snapshot.deck.cards[0];
    if (!card) return false;
    await this.authority.commitLocalMutations([
      {
        entityId: snapshot.deck.id,
        entityType: "DECK",
        operation: "UPSERT",
        baseVersion: null,
        payload: localDeckPayloadSchema.parse({
          title: snapshot.deck.title,
          description: "Aus dem Phase-1-Direkttransfer übernommen.",
          language: "de",
          createdAt: snapshot.deck.modifiedAt,
          updatedAt: snapshot.deck.modifiedAt,
        }),
      },
      {
        entityId: card.id,
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: null,
        payload: localCardPayloadSchema.parse({
          deckId: snapshot.deck.id,
          front: plainLocalCardContent(card.front),
          back: plainLocalCardContent(card.back),
          position: 0,
          suspended: false,
          state: after,
          createdAt: snapshot.deck.modifiedAt,
          updatedAt: snapshot.review.reviewedAt,
        }),
      },
      {
        entityId: snapshot.review.mutationId,
        entityType: "REVIEW",
        operation: "UPSERT",
        baseVersion: null,
        payload: localReviewPayloadSchema.parse({
          reviewId: snapshot.review.mutationId,
          deckId: snapshot.review.deckId,
          cardId: snapshot.review.cardId,
          reviewedAt: snapshot.review.reviewedAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          rating: snapshot.review.rating,
          schedulerVersion,
          parameters: defaultParameters.w,
          before,
          after,
        }),
      },
    ]);
    return true;
  }
}
