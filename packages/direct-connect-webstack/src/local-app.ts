import { createId, defaultStudyStrategy } from "@flashcards/domain";
import type {
  CardState,
  ReviewRating,
  StudyBadgePlan,
  StudyStrategyConfig,
} from "@flashcards/domain";
import {
  audioDerivativeCandidateId,
  audioDerivativeReferenceFileName,
  localAudioDerivativePayloadSchema,
  parseAudioDerivativeReference,
  selectPreferredAudioDerivative,
  speechAudioPipeline,
} from "@flashcards/domain/audio-optimization";
import type {
  AudioQualityMeasurement,
  LocalAudioDerivativePayload,
} from "@flashcards/domain/audio-optimization";
import type {
  CardContent,
  LocalizedCardContents,
} from "@flashcards/domain/content";
import {
  localAppBackupEnvelopeSchema,
  localAnkiImportProfilePayloadSchema,
  localCardContentPlainText,
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localMediaReferencePayloadSchema,
  localNamedStudyPlanPayloadSchema,
  localReviewPayloadSchema,
  localSettingsPayloadSchema,
  plainLocalCardContent,
} from "@flashcards/domain/local-app-data";
import type {
  LocalAppBackupEnvelope,
  LocalAnkiImportProfilePayload,
  LocalCardPayload,
  LocalDeckPayload,
  LocalMediaReferencePayload,
  LocalNamedStudyPlanPayload,
  LocalReviewPayload,
  LocalSettingsPayload,
} from "@flashcards/domain/local-app-data";
import type {
  LocalMaterializedEntity,
  LocalMutationInput,
} from "@flashcards/domain/local-authority";
import type { PeerMutation } from "@flashcards/domain/device-sync";
import {
  applyRating,
  defaultParameters,
  emptyCardState,
  schedulerVersion,
} from "@flashcards/scheduler";
import {
  LocalAuthorityRepository,
  maximumLocalMutationBatchSize,
} from "@flashcards/sync/local-authority";
import type { LocalAuthorityMutationValidator } from "@flashcards/sync/local-authority";

import {
  createLocalAuthorityStorage,
  type LocalStudyCardCounts,
  type LocalStudyCardQuery,
  type LocalStudyBadgeQuery,
  webCryptoLocalAuthorityHasher,
} from "./local-authority-storage";
import { createLocalMediaStorage } from "./media-storage";
import { cloudFencedStorage, assertLegacyCloudDeletionAllowed } from "./cloud-library-policy";
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
      if (!localSettingsPayloadSchema.safeParse(mutation.payload).success) {
        localAnkiImportProfilePayloadSchema.parse(mutation.payload);
      }
      return;
    case "VIRTUAL_STUDY_TARGET":
      localNamedStudyPlanPayloadSchema.parse(mutation.payload);
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

type LocalMediaReference = {
  id: string;
  payload: LocalMediaReferencePayload;
};

const replacedAudioSourceIds = (
  references: readonly LocalMediaReference[],
  mediaById: ReadonlyMap<
    string,
    Pick<StoredLocalMedia, "mediaId" | "mimeType" | "sha256"> & {
      bytes?: Uint8Array;
      byteSize?: number;
    }
  >,
): Set<string> => {
  const referencesById = new Map(
    references.map((reference) => [reference.id, reference]),
  );
  const replaced = new Set<string>();
  for (const reference of references) {
    const derivative = parseAudioDerivativeReference({
      fileName: reference.payload.fileName,
      outputMediaId: reference.id,
      outputSha256: reference.payload.sha256,
      outputBytes: reference.payload.byteSize,
      verifiedAt: reference.payload.createdAt,
    });
    if (!derivative) continue;
    const sourceReference = referencesById.get(derivative.sourceMediaId);
    const output = mediaById.get(derivative.outputMediaId);
    const outputBytes = output?.bytes?.byteLength ?? output?.byteSize;
    if (
      sourceReference?.payload.sha256 === derivative.sourceSha256 &&
      sourceReference.payload.byteSize === derivative.sourceBytes &&
      output?.sha256 === derivative.outputSha256 &&
      output.mimeType === derivative.outputMimeType &&
      outputBytes === derivative.outputBytes
    ) {
      replaced.add(derivative.sourceMediaId);
    }
  }
  return replaced;
};

export type VersionedLocalEntity<T> = {
  id: string;
  version: number;
  payload: T;
};

export type LocalPeerMediaDescriptor = {
  mediaId: string;
  mimeType: string;
  sha256: string;
  byteSize: number;
  chunkCount: number;
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
    ...(card.supplementalContent ?? []).map((item) => item.content),
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
  readonly cloudAuthority: LocalAuthorityRepository;
  private readonly localAuthorityStorage: ReturnType<
    typeof createLocalAuthorityStorage
  >;

  constructor(
    private readonly deviceId: string,
    private readonly media: LocalMediaStorage = createLocalMediaStorage(),
  ) {
    this.localAuthorityStorage = createLocalAuthorityStorage();
    this.authority = new LocalAuthorityRepository(
      cloudFencedStorage(this.localAuthorityStorage, deviceId),
      deviceId,
      webCryptoLocalAuthorityHasher,
      validateLocalAppMutation,
    );
    this.cloudAuthority = new LocalAuthorityRepository(
      cloudFencedStorage(this.localAuthorityStorage, deviceId, true), deviceId,
      webCryptoLocalAuthorityHasher, validateLocalAppMutation,
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
    const entities = deckId
      ? await this.localAuthorityStorage.listCardEntities(deckId)
      : await this.authority.listEntities({ entityType: "CARD" });
    return entities
      .map((entity) => toVersioned(entity, localCardPayloadSchema.parse))
      .sort(
        (left, right) =>
          left.payload.position - right.payload.position ||
          left.id.localeCompare(right.id),
      );
  }

  async listStudyCards(
    input: LocalStudyCardQuery,
  ): Promise<VersionedLocalEntity<LocalCardPayload>[]> {
    return (await this.localAuthorityStorage.listStudyCardEntities(input)).map(
      (entity) => toVersioned(entity, localCardPayloadSchema.parse),
    );
  }

  async countStudyCards(
    input: Omit<LocalStudyCardQuery, "reviewLimit" | "includeFutureReviews">,
  ): Promise<LocalStudyCardCounts> {
    return this.localAuthorityStorage.countStudyCards(input);
  }

  async studyBadgePlan(input: LocalStudyBadgeQuery): Promise<StudyBadgePlan> {
    return this.localAuthorityStorage.studyBadgePlan(input);
  }

  async latestReviewRatings(
    cardIds: readonly string[],
  ): Promise<Map<string, ReviewRating>> {
    const ratings =
      await this.localAuthorityStorage.listLatestReviewRatings(cardIds);
    return new Map(ratings.map((entry) => [entry.cardId, entry.rating]));
  }

  async getCard(
    cardId: string,
  ): Promise<VersionedLocalEntity<LocalCardPayload> | null> {
    const entity = await this.authority.getEntity(cardId);
    if (!entity || entity.winningMutation.entityType !== "CARD") return null;
    return toVersioned(entity, localCardPayloadSchema.parse);
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

  async listAudioDerivatives(
    sourceMediaId?: string,
  ): Promise<VersionedLocalEntity<LocalAudioDerivativePayload>[]> {
    return (await this.listMedia())
      .map((entity) => {
        const payload = parseAudioDerivativeReference({
          fileName: entity.payload.fileName,
          outputMediaId: entity.id,
          outputSha256: entity.payload.sha256,
          outputBytes: entity.payload.byteSize,
          verifiedAt: entity.payload.createdAt,
        });
        return payload
          ? { id: entity.id, version: entity.version, payload }
          : null;
      })
      .filter(
        (entity): entity is VersionedLocalEntity<LocalAudioDerivativePayload> =>
          entity !== null,
      )
      .filter(
        (entity) =>
          !sourceMediaId || entity.payload.sourceMediaId === sourceMediaId,
      );
  }

  async settings(): Promise<VersionedLocalEntity<LocalSettingsPayload> | null> {
    const settings = (
      await this.authority.listEntities({ entityType: "SETTING" })
    ).find((entity) => entity.winningMutation.entityId === localSettingsId);
    return settings
      ? toVersioned(settings, localSettingsPayloadSchema.parse)
      : null;
  }

  async listAnkiImportProfiles(): Promise<
    VersionedLocalEntity<LocalAnkiImportProfilePayload>[]
  > {
    return (await this.authority.listEntities({ entityType: "SETTING" }))
      .filter((entity) => entity.winningMutation.entityId !== localSettingsId)
      .flatMap((entity) => {
        const parsed = localAnkiImportProfilePayloadSchema.safeParse(
          entity.winningMutation.payload,
        );
        return parsed.success
          ? [
              {
                id: entity.winningMutation.entityId,
                version: entity.currentVersion ?? 0,
                payload: parsed.data,
              },
            ]
          : [];
      })
      .sort((left, right) =>
        left.payload.profile.name.localeCompare(right.payload.profile.name),
      );
  }

  async listNamedStudyPlans(): Promise<
    VersionedLocalEntity<LocalNamedStudyPlanPayload>[]
  > {
    return (
      await this.authority.listEntities({ entityType: "VIRTUAL_STUDY_TARGET" })
    )
      .map((entity) =>
        toVersioned(entity, localNamedStudyPlanPayloadSchema.parse),
      )
      .sort((left, right) =>
        left.payload.title.localeCompare(right.payload.title),
      );
  }

  async saveNamedStudyPlan(input: {
    id: string;
    version?: number;
    title: string;
    deckIds: readonly string[];
    strategy?: StudyStrategyConfig;
    createdAt?: string;
  }): Promise<VersionedLocalEntity<LocalNamedStudyPlanPayload>> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = (await this.listNamedStudyPlans()).find(
        (plan) => plan.id === input.id,
      );
      const now = new Date().toISOString();
      const payload = localNamedStudyPlanPayloadSchema.parse({
        kind: "NAMED_STUDY_PLAN_V2",
        title: input.title,
        deckIds: [...new Set(input.deckIds)].sort(),
        strategy:
          input.strategy ??
          (existing?.payload.kind === "NAMED_STUDY_PLAN_V2"
            ? existing.payload.strategy
            : defaultStudyStrategy()),
        createdAt: input.createdAt ?? existing?.payload.createdAt ?? now,
        updatedAt: now,
      });
      try {
        await this.authority.commitLocalMutation({
          entityId: input.id,
          entityType: "VIRTUAL_STUDY_TARGET",
          operation: "UPSERT",
          baseVersion: input.version ?? existing?.version ?? null,
          payload,
        });
        const saved = (await this.listNamedStudyPlans()).find(
          (plan) => plan.id === input.id,
        );
        if (!saved)
          throw new Error("Der Lernplan konnte nicht gespeichert werden.");
        return saved;
      } catch (cause) {
        const conflict =
          cause instanceof Error &&
          cause.message.includes("Local version conflict");
        if (!conflict || input.version !== undefined || attempt === 7)
          throw cause;
      }
    }
    throw new Error("Der Lernplan konnte nicht gespeichert werden.");
  }

  async deleteNamedStudyPlan(id: string): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = (await this.listNamedStudyPlans()).find(
        (plan) => plan.id === id,
      );
      if (!existing) return;
      try {
        await this.authority.commitLocalMutation({
          entityId: id,
          entityType: "VIRTUAL_STUDY_TARGET",
          operation: "DELETE",
          baseVersion: existing.version,
          payload: null,
        });
        return;
      } catch (cause) {
        const conflict =
          cause instanceof Error &&
          cause.message.includes("Local version conflict");
        if (!conflict || attempt === 7) throw cause;
      }
    }
  }

  async saveAnkiImportProfile(
    candidate: LocalAnkiImportProfilePayload["profile"],
  ): Promise<LocalAnkiImportProfilePayload["profile"]> {
    const payload = localAnkiImportProfilePayloadSchema.parse({
      kind: "ANKI_IMPORT_PROFILE",
      profile: candidate,
    });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = (await this.listAnkiImportProfiles()).find(
        (entity) => entity.id === payload.profile.id,
      );
      if (
        existing &&
        JSON.stringify(existing.payload.profile) ===
          JSON.stringify(payload.profile)
      ) {
        return existing.payload.profile;
      }
      try {
        await this.authority.commitLocalMutation({
          entityId: payload.profile.id,
          entityType: "SETTING",
          operation: "UPSERT",
          baseVersion: existing?.version ?? null,
          payload,
        });
        return payload.profile;
      } catch (cause) {
        const isConcurrentWrite =
          cause instanceof Error &&
          cause.message.includes("Local version conflict");
        if (!isConcurrentWrite || attempt === 7) throw cause;
      }
    }
    return payload.profile;
  }

  async deleteAnkiImportProfile(id: string): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = (await this.listAnkiImportProfiles()).find(
        (entity) => entity.id === id,
      );
      if (!existing) return;
      try {
        await this.authority.commitLocalMutation({
          entityId: id,
          entityType: "SETTING",
          operation: "DELETE",
          baseVersion: existing.version,
          payload: null,
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

  async installLocalPackage(input: {
    mutations: readonly LocalMutationInput[];
    media: ReadonlyArray<{
      id: string;
      deckId: string;
      cardId: string | null;
      fileName: string;
      mimeType: string;
      bytes: Uint8Array;
      baseVersion?: number | null;
    }>;
  }): Promise<void> {
    if (!input.mutations.length && !input.media.length) {
      throw new Error("Das lokale Importpaket enthält keine Datensätze.");
    }
    const activeIds = new Set(
      (await this.authority.listEntities({ includeDeleted: true })).map(
        (entity) => entity.winningMutation.entityId,
      ),
    );
    const incomingIds = new Set<string>();
    for (const mutation of input.mutations) {
      if (
        (activeIds.has(mutation.entityId) && mutation.baseVersion === null) ||
        incomingIds.has(mutation.entityId)
      ) {
        throw new Error(
          "Das lokale Importpaket enthält bereits verwendete IDs.",
        );
      }
      incomingIds.add(mutation.entityId);
    }
    const storedMedia: Array<{
      current: StoredLocalMedia;
      previous: StoredLocalMedia | null;
    }> = [];
    const now = new Date().toISOString();
    const mediaMutations: LocalMutationInput[] = [];
    try {
      for (const item of input.media) {
        if (
          (activeIds.has(item.id) && item.baseVersion == null) ||
          incomingIds.has(item.id)
        ) {
          throw new Error(
            "Das lokale Importpaket enthält bereits verwendete Medien-IDs.",
          );
        }
        incomingIds.add(item.id);
        const stored = {
          mediaId: item.id,
          mimeType: item.mimeType,
          sha256: await sha256(item.bytes),
          bytes: item.bytes,
        } satisfies StoredLocalMedia;
        const previous = await this.media.get(item.id);
        await this.media.put(stored);
        storedMedia.push({ current: stored, previous });
        mediaMutations.push({
          entityId: item.id,
          entityType: "MEDIA_REFERENCE",
          operation: "UPSERT",
          baseVersion: item.baseVersion ?? null,
          payload: localMediaReferencePayloadSchema.parse({
            deckId: item.deckId,
            cardId: item.cardId,
            fileName: item.fileName,
            mimeType: item.mimeType,
            byteSize: item.bytes.byteLength,
            sha256: stored.sha256,
            createdAt: now,
          }),
        });
      }
      await this.authority.commitLocalMutations(
        [...input.mutations, ...mediaMutations],
        { maximumBatchSize: maximumLocalMutationBatchSize },
      );
    } catch (cause) {
      await Promise.all(
        storedMedia.map(({ current, previous }) =>
          (previous
            ? this.media.put(previous)
            : this.media.delete(current.mediaId)
          ).catch(() => undefined),
        ),
      );
      throw cause;
    }
  }

  async discardUnreferencedMedia(mediaIds: readonly string[]): Promise<number> {
    const referenced = new Set((await this.listMedia()).map((item) => item.id));
    for (const derivative of await this.listAudioDerivatives()) {
      if (!(await this.media.get(derivative.payload.outputMediaId)))
        referenced.add(derivative.payload.sourceMediaId);
    }
    let discarded = 0;
    for (const mediaId of new Set(mediaIds)) {
      if (referenced.has(mediaId)) continue;
      if (await this.media.get(mediaId)) {
        await this.media.delete(mediaId);
        discarded += 1;
      }
      await this.media.deleteChunks(mediaId);
    }
    return discarded;
  }

  async discardAllUnreferencedMedia(): Promise<number> {
    return this.discardUnreferencedMedia(await this.media.listIds());
  }

  async deleteUnreferencedMediaReferences(
    mediaIds: readonly string[],
  ): Promise<number> {
    if (!mediaIds.length) return 0;
    const referenced = new Set<string>();
    for (const deck of await this.listDecks()) {
      if (deck.payload.visual?.kind === "IMAGE")
        referenced.add(deck.payload.visual.value);
    }
    for (const card of await this.listCards()) {
      for (const mediaId of cardMediaIds(card.payload)) referenced.add(mediaId);
    }
    const references = new Map(
      (await this.listMedia()).map((reference) => [reference.id, reference]),
    );
    const removable = [...new Set(mediaIds)].filter(
      (mediaId) => !referenced.has(mediaId) && references.has(mediaId),
    );
    const derivativeIds = (
      await Promise.all(
        removable.map(async (mediaId) =>
          (await this.listAudioDerivatives(mediaId)).map((item) => item.id),
        ),
      )
    ).flat();
    const all = [...new Set([...removable, ...derivativeIds])].filter(
      (mediaId) => !referenced.has(mediaId) && references.has(mediaId),
    );
    if (!all.length) return 0;
    await this.authority.commitLocalMutations(
      all.map((mediaId) => ({
        entityId: mediaId,
        entityType: "MEDIA_REFERENCE" as const,
        operation: "DELETE" as const,
        baseVersion: references.get(mediaId)?.version ?? null,
        payload: null,
      })),
    );
    await Promise.all(
      all.map(async (mediaId) => {
        await this.media.delete(mediaId);
        await this.media.deleteChunks(mediaId);
      }),
    );
    return all.length;
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
    learningEnabled?: boolean;
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
      learningEnabled:
        input.learningEnabled ??
        existing?.payload.learningEnabled ??
        existing?.payload.favorite ??
        false,
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
    usage?: "LEARNING" | "REFERENCE";
    linkedToPrevious?: boolean;
    ratingEnabled?: boolean;
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
      usage: input.usage ?? existing?.payload.usage ?? "LEARNING",
      linkedToPrevious:
        input.linkedToPrevious ?? existing?.payload.linkedToPrevious ?? false,
      ratingEnabled:
        input.ratingEnabled ?? existing?.payload.ratingEnabled ?? true,
      position:
        input.position ??
        existing?.payload.position ??
        (await this.listCards(input.deckId)).length,
      suspended: input.suspended ?? existing?.payload.suspended ?? false,
      state:
        input.state ?? existing?.payload.state ?? emptyCardState(new Date()),
      introducedAt: existing?.payload.introducedAt ?? null,
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
    const card = await this.getCard(cardId);
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
          introducedAt:
            card.payload.introducedAt ??
            (card.payload.state.reps === 0 ? reviewedAt.toISOString() : null),
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

  async reviewVirtualCard(input: {
    reviewId: string;
    deckId: string;
    cardId: string;
    rating: ReviewRating;
    reviewedAt: Date;
    timezone: string;
    before: CardState;
    virtualCard: NonNullable<LocalReviewPayload["virtualCard"]>;
  }): Promise<string> {
    const after = applyRating(input.before, input.rating, input.reviewedAt);
    const review = localReviewPayloadSchema.parse({
      reviewId: input.reviewId,
      deckId: input.deckId,
      cardId: input.cardId,
      reviewedAt: input.reviewedAt.toISOString(),
      timezone: input.timezone || "UTC",
      rating: input.rating,
      schedulerVersion,
      parameters: defaultParameters.w,
      before: input.before,
      after,
      virtualCard: input.virtualCard,
    });
    await this.authority.commitLocalMutation({
      entityId: input.reviewId,
      entityType: "REVIEW",
      operation: "UPSERT",
      baseVersion: null,
      payload: review,
    });
    return input.reviewId;
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

  async installMediaDerivative(input: {
    sourceMediaId: string;
    mimeType: "audio/mp4";
    bytes: Uint8Array;
    engine: string;
    engineVersion: string;
    inputMeasurement: AudioQualityMeasurement;
    outputMeasurement: AudioQualityMeasurement;
  }): Promise<{ derivativeId: string; outputMediaId: string }> {
    const reference = (await this.listMedia()).find(
      (item) => item.id === input.sourceMediaId,
    );
    const existing = (
      await this.listAudioDerivatives(input.sourceMediaId)
    ).find(
      (item) => item.payload.pipelineVersion === speechAudioPipeline.version,
    );
    if (existing) {
      const output = await this.media.get(existing.payload.outputMediaId);
      if (
        output?.sha256 === existing.payload.outputSha256 &&
        output.bytes.byteLength === existing.payload.outputBytes
      ) {
        await this.cleanupActivatedAudioOriginals();
        return {
          derivativeId: existing.id,
          outputMediaId: existing.payload.outputMediaId,
        };
      }
    }
    if (!reference) {
      throw new Error("Die Original-Audioreferenz ist nicht mehr vorhanden.");
    }
    const digest = await sha256(input.bytes);
    const outputMediaId = audioDerivativeCandidateId(
      await sha256(
        new TextEncoder().encode(
          `${speechAudioPipeline.id}:${reference.payload.sha256}:${digest}:output`,
        ),
      ),
    );
    const derivativeId = outputMediaId;
    await this.media.put({
      mediaId: outputMediaId,
      mimeType: input.mimeType,
      sha256: digest,
      bytes: input.bytes,
    });
    const now = new Date().toISOString();
    const derivative = localAudioDerivativePayloadSchema.parse({
      sourceMediaId: input.sourceMediaId,
      sourceSha256: reference.payload.sha256,
      sourceBytes: reference.payload.byteSize,
      outputMediaId,
      outputSha256: digest,
      outputMimeType: input.mimeType,
      outputBytes: input.bytes.byteLength,
      pipelineId: speechAudioPipeline.id,
      pipelineVersion: speechAudioPipeline.version,
      engine: input.engine,
      engineVersion: input.engineVersion,
      createdByDeviceId: this.deviceId,
      input: input.inputMeasurement,
      output: input.outputMeasurement,
      verifiedAt: now,
    });
    try {
      await this.authority.commitLocalMutations([
        {
          entityId: outputMediaId,
          entityType: "MEDIA_REFERENCE",
          operation: "UPSERT",
          baseVersion: null,
          payload: localMediaReferencePayloadSchema.parse({
            deckId: reference.payload.deckId,
            cardId: null,
            fileName: audioDerivativeReferenceFileName(derivative),
            mimeType: input.mimeType,
            byteSize: input.bytes.byteLength,
            sha256: digest,
            createdAt: now,
          }),
        },
      ]);
    } catch (cause) {
      await this.media.delete(outputMediaId).catch(() => undefined);
      throw cause;
    }
    await this.cleanupActivatedAudioOriginals();
    return { derivativeId, outputMediaId };
  }

  async getMedia(mediaId: string): Promise<StoredLocalMedia | null> {
    return this.media.get(mediaId);
  }

  async getPlayableMedia(mediaId: string): Promise<StoredLocalMedia | null> {
    const reference = await this.authority.getEntity(mediaId);
    if (
      !reference ||
      reference.winningMutation.entityType !== "MEDIA_REFERENCE"
    ) {
      return this.media.get(mediaId);
    }
    const payload = localMediaReferencePayloadSchema.parse(
      reference.winningMutation.payload,
    );
    if (!payload.mimeType.startsWith("audio/")) return this.media.get(mediaId);
    const candidates = await this.listAudioDerivatives(mediaId);
    const available: LocalAudioDerivativePayload[] = [];
    for (const candidate of candidates) {
      const stored = await this.media.get(candidate.payload.outputMediaId);
      if (
        stored?.sha256 === candidate.payload.outputSha256 &&
        stored.bytes.byteLength === candidate.payload.outputBytes
      ) {
        available.push(candidate.payload);
      }
    }
    const preferred = selectPreferredAudioDerivative(available);
    if (preferred) return this.media.get(preferred.outputMediaId);
    return this.media.get(mediaId);
  }

  async cleanupActivatedAudioOriginals(): Promise<number> {
    const references = await this.listMedia();
    const referencesById = new Map(
      references.map((reference) => [reference.id, reference]),
    );
    const availableBySource = new Map<string, LocalAudioDerivativePayload[]>();
    for (const derivative of await this.listAudioDerivatives()) {
      const output = await this.media.get(derivative.payload.outputMediaId);
      if (
        output?.sha256 !== derivative.payload.outputSha256 ||
        output.bytes.byteLength !== derivative.payload.outputBytes ||
        output.mimeType !== derivative.payload.outputMimeType
      ) {
        continue;
      }
      const candidates = availableBySource.get(
        derivative.payload.sourceMediaId,
      );
      if (candidates) candidates.push(derivative.payload);
      else
        availableBySource.set(derivative.payload.sourceMediaId, [
          derivative.payload,
        ]);
    }
    let removed = 0;
    for (const [sourceMediaId, candidates] of availableBySource) {
      const derivative = selectPreferredAudioDerivative(candidates);
      const sourceReference = referencesById.get(sourceMediaId);
      const original = await this.media.get(sourceMediaId);
      if (
        !derivative ||
        !original ||
        sourceReference?.payload.sha256 !== derivative.sourceSha256 ||
        sourceReference.payload.byteSize !== derivative.sourceBytes ||
        original.sha256 !== derivative.sourceSha256 ||
        original.bytes.byteLength !== derivative.sourceBytes
      ) {
        continue;
      }
      try {
        await this.media.delete(sourceMediaId);
        await this.media.deleteChunks(sourceMediaId).catch(() => undefined);
        removed += 1;
      } catch {
        // A later optimizer or synchronization pass retries local cleanup.
      }
    }
    return removed;
  }

  async peerMediaInventory(
    chunkBytes: number,
  ): Promise<LocalPeerMediaDescriptor[]> {
    const references = await this.listMedia();
    const result: LocalPeerMediaDescriptor[] = [];
    for (const reference of references) {
      const stored = await this.media.get(reference.id);
      if (
        !stored ||
        stored.sha256 !== reference.payload.sha256 ||
        stored.bytes.byteLength !== reference.payload.byteSize
      ) {
        continue;
      }
      result.push({
        mediaId: reference.id,
        mimeType: reference.payload.mimeType,
        sha256: reference.payload.sha256,
        byteSize: reference.payload.byteSize,
        chunkCount: Math.max(
          1,
          Math.ceil(stored.bytes.byteLength / chunkBytes),
        ),
      });
    }
    return result;
  }

  async peerMediaMissingChunks(
    descriptor: LocalPeerMediaDescriptor,
  ): Promise<number[]> {
    const stored = await this.media.get(descriptor.mediaId);
    if (
      stored?.sha256 === descriptor.sha256 &&
      stored.bytes.byteLength === descriptor.byteSize
    ) {
      return [];
    }
    let chunks = await this.media.listChunks(descriptor.mediaId);
    if (
      chunks.some(
        (chunk) =>
          chunk.chunkCount !== descriptor.chunkCount ||
          chunk.sha256 !== descriptor.sha256 ||
          chunk.mimeType !== descriptor.mimeType ||
          chunk.byteSize !== descriptor.byteSize,
      )
    ) {
      await this.media.deleteChunks(descriptor.mediaId);
      chunks = [];
    }
    const present = new Set(chunks.map((chunk) => chunk.index));
    return Array.from(
      { length: descriptor.chunkCount },
      (_value, index) => index,
    ).filter((index) => !present.has(index));
  }

  async peerMediaBytes(mediaId: string): Promise<StoredLocalMedia | null> {
    return this.media.get(mediaId);
  }

  async acceptPeerMediaChunk(
    input: LocalPeerMediaDescriptor & {
      index: number;
      bytes: Uint8Array;
    },
  ): Promise<boolean> {
    const reference = (await this.listMedia()).find(
      (candidate) => candidate.id === input.mediaId,
    );
    if (
      !reference ||
      reference.payload.mimeType !== input.mimeType ||
      reference.payload.sha256 !== input.sha256 ||
      reference.payload.byteSize !== input.byteSize
    ) {
      throw new Error(
        "Peer-Medium stimmt nicht mit seiner lokalen Referenz überein.",
      );
    }
    if (input.index < 0 || input.index >= input.chunkCount) {
      throw new Error("Peer-Medienchunk liegt außerhalb des Manifests.");
    }
    const expectedChunkBytes =
      input.index === input.chunkCount - 1
        ? input.byteSize - input.index * 24 * 1024
        : 24 * 1024;
    if (
      expectedChunkBytes <= 0 ||
      input.bytes.byteLength !== expectedChunkBytes
    ) {
      throw new Error("Peer-Medienchunk hat eine falsche Größe.");
    }
    await this.media.putChunk({
      mediaId: input.mediaId,
      index: input.index,
      chunkCount: input.chunkCount,
      sha256: input.sha256,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      bytes: input.bytes,
    });
    const chunks = await this.media.listChunks(input.mediaId);
    if (
      chunks.length !== input.chunkCount ||
      chunks.some((chunk, index) => chunk.index !== index)
    ) {
      return false;
    }
    const byteLength = chunks.reduce(
      (sum, chunk) => sum + chunk.bytes.byteLength,
      0,
    );
    if (byteLength !== input.byteSize) {
      await this.media.deleteChunks(input.mediaId);
      throw new Error(
        "Peer-Medium hat nach dem Zusammenfügen eine falsche Größe.",
      );
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk.bytes, offset);
      offset += chunk.bytes.byteLength;
    }
    if ((await sha256(bytes)) !== input.sha256) {
      await this.media.deleteChunks(input.mediaId);
      throw new Error("Peer-Medium hat eine falsche Prüfsumme.");
    }
    await this.media.put({
      mediaId: input.mediaId,
      mimeType: input.mimeType,
      sha256: input.sha256,
      bytes,
    });
    await this.media.deleteChunks(input.mediaId);
    return true;
  }

  async resetDeckProgress(deckIds: ReadonlySet<string>): Promise<number> {
    await assertLegacyCloudDeletionAllowed();
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
            introducedAt: null,
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
    await this.deleteDecks([deck]);
  }

  async deleteDecks(
    decks: readonly VersionedLocalEntity<LocalDeckPayload>[],
  ): Promise<void> {
    await assertLegacyCloudDeletionAllowed();
    if (!decks.length) return;
    const deletedDeckIds = new Set(decks.map((deck) => deck.id));
    if (deletedDeckIds.size !== decks.length)
      throw new Error("Die Löschliste enthält ein Deck mehrfach.");
    const [allCards, allMedia, allDecks] = await Promise.all([
      this.listCards(),
      this.listMedia(),
      this.listDecks(),
    ]);
    const currentDecks = new Map(allDecks.map((deck) => [deck.id, deck]));
    for (const deck of decks) {
      const current = currentDecks.get(deck.id);
      if (!current || current.version !== deck.version)
        throw new Error("Das Deck wurde zwischenzeitlich geändert.");
    }
    const cards = allCards.filter((card) =>
      deletedDeckIds.has(card.payload.deckId),
    );
    const deletedCardIds = new Set(cards.map((card) => card.id));
    const retainedCards = allCards.filter(
      (card) => !deletedCardIds.has(card.id),
    );
    const retainedDecks = allDecks.filter(
      (candidate) => !deletedDeckIds.has(candidate.id),
    );
    const referencedByDeletedContent = new Set<string>();
    for (const card of cards) {
      for (const mediaId of cardMediaIds(card.payload))
        referencedByDeletedContent.add(mediaId);
    }
    for (const candidate of decks) {
      if (candidate.payload.visual?.kind === "IMAGE")
        referencedByDeletedContent.add(candidate.payload.visual.value);
    }
    const candidates = allMedia.filter(
      (entry) =>
        deletedDeckIds.has(entry.payload.deckId) ||
        referencedByDeletedContent.has(entry.id),
    );
    const retainedMediaOwners = new Map<
      string,
      { deckId: string; cardId: string | null }
    >();
    for (const card of retainedCards) {
      for (const mediaId of cardMediaIds(card.payload)) {
        if (!retainedMediaOwners.has(mediaId)) {
          retainedMediaOwners.set(mediaId, {
            deckId: card.payload.deckId,
            cardId: card.id,
          });
        }
      }
    }
    for (const candidate of retainedDecks) {
      if (
        candidate.payload.visual?.kind === "IMAGE" &&
        !retainedMediaOwners.has(candidate.payload.visual.value)
      ) {
        retainedMediaOwners.set(candidate.payload.visual.value, {
          deckId: candidate.id,
          cardId: null,
        });
      }
    }
    const media = candidates.filter(
      (entry) => !retainedMediaOwners.has(entry.id),
    );
    const deletedMediaIds = new Set(media.map((entry) => entry.id));
    const retainedMedia = candidates.filter(
      (entry) => !deletedMediaIds.has(entry.id),
    );
    const mutations: LocalMutationInput[] = [
      ...retainedMedia.map((entry) => {
        const owner = retainedMediaOwners.get(entry.id)!;
        return {
          entityId: entry.id,
          entityType: "MEDIA_REFERENCE" as const,
          operation: "UPSERT" as const,
          baseVersion: entry.version,
          payload: {
            ...entry.payload,
            deckId: owner.deckId,
            cardId: owner.cardId,
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
      ...decks.map((entry) => ({
        entityId: entry.id,
        entityType: "DECK" as const,
        operation: "DELETE" as const,
        baseVersion: entry.version,
        payload: null,
      })),
    ];
    if (mutations.length > maximumLocalMutationBatchSize)
      throw new Error(
        `Die Collection überschreitet das Löschlimit von ${maximumLocalMutationBatchSize.toLocaleString("de-DE")} Änderungen.`,
      );
    await this.authority.commitLocalMutations(mutations, {
      maximumBatchSize: maximumLocalMutationBatchSize,
    });
    await Promise.all(
      media.map((entry) => this.media.delete(entry.id).catch(() => undefined)),
    );
  }

  async exportAll(): Promise<LocalAppBackupEnvelope> {
    const [authority, media] = await Promise.all([
      this.authority.exportAll(),
      this.media.list(),
    ]);
    const references = await this.listMedia();
    const mediaById = new Map(media.map((entry) => [entry.mediaId, entry]));
    const replacedSourceIds = replacedAudioSourceIds(references, mediaById);
    for (const reference of references) {
      const entry = mediaById.get(reference.id);
      if (!entry && replacedSourceIds.has(reference.id)) continue;
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
    const referenceIds = new Set(references.map((reference) => reference.id));
    if (media.some((entry) => !referenceIds.has(entry.mediaId)))
      throw new Error("Local backup contains unreferenced media");
    return localAppBackupEnvelopeSchema.parse({
      format: "flash-n-flip-local-backup",
      version: 3,
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
    const [existingEntities, existingJournal, existingOutboxCount] =
      await Promise.all([
        this.authority.listEntities({ includeDeleted: true }),
        this.authority.listMutationJournal(),
        this.authority.countOutbox(),
      ]);
    if (
      existingEntities.length > 0 ||
      existingJournal.length > 0 ||
      existingOutboxCount > 0
    ) {
      throw new Error("Import requires an empty local authority");
    }
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
    const replacedSourceIds = replacedAudioSourceIds(
      references.map((reference) => ({
        id: reference.mediaId,
        payload: reference.payload,
      })),
      backupMediaById,
    );
    for (const reference of references) {
      const entry = backupMediaById.get(reference.mediaId);
      if (!entry && replacedSourceIds.has(reference.mediaId)) continue;
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
    const referenceIds = new Set(
      references.map((reference) => reference.mediaId),
    );
    if (backup.media.some((entry) => !referenceIds.has(entry.mediaId)))
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
    const existingMedia = await this.media.list();
    const expectedMediaById = new Map(
      media.map((entry) => [entry.mediaId, entry]),
    );
    for (const existing of existingMedia) {
      const expected = expectedMediaById.get(existing.mediaId);
      if (
        !expected ||
        existing.mimeType !== expected.mimeType ||
        existing.sha256 !== expected.sha256 ||
        existing.bytes.byteLength !== expected.bytes.byteLength ||
        (await sha256(existing.bytes)) !== expected.sha256
      ) {
        throw new Error("Import contains unrelated or corrupt local media");
      }
    }
    const existingMediaIds = new Set(
      existingMedia.map((entry) => entry.mediaId),
    );
    try {
      for (const entry of media) {
        if (!existingMediaIds.has(entry.mediaId)) await this.media.put(entry);
      }
      await this.authority.restoreAll(backup.authority);
    } catch (cause) {
      const cleanup = await Promise.allSettled(
        media.map((entry) => this.media.delete(entry.mediaId)),
      );
      const cleanupFailures = cleanup.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (cleanupFailures.length > 0) {
        throw new AggregateError(
          [cause, ...cleanupFailures],
          "Backup restore failed and its temporary media could not be removed",
        );
      }
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
