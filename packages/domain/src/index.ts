import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { geographyMapIds } from "@flashcards/domain/geography";
import {
  cardContentSchema,
  localizedCardContentsSchema,
  type CardContent,
  type LocalizedCardContents,
} from "@flashcards/domain/content";

export {
  mermaidDiagramBlockSchema,
  mermaidDiagramExamples,
  mermaidDiagramTypeFromSource,
  mermaidDiagramTypes,
  mermaidDiagramTypeSchema,
  validateMermaidDiagramSource,
} from "./mermaid-diagram.js";
export type {
  MermaidDiagramBlock,
  MermaidDiagramType,
  MermaidSourceMetrics,
} from "./mermaid-diagram.js";
export {
  jsxGraphBlockSchema,
  jsxGraphExamples,
  maximumJsxGraphObjects,
  maximumJsxGraphSliders,
  maximumJsxGraphSourceLength,
  maximumJsxGraphStatements,
  parseJsxGraphExpression,
  parseJsxGraphSource,
  validateJsxGraphSource,
} from "./jsx-graph.js";
export type {
  JsxGraphBlock,
  JsxGraphExpression,
  JsxGraphProgram,
  JsxGraphSourceMetrics,
  JsxGraphStatement,
} from "./jsx-graph.js";
export {
  musicScoreBlockSchema,
  musicScoreKeyboardModes,
  musicScoreStaffScales,
  normalizeMusicScoreAbc,
  validateMusicScoreAbc,
} from "./music-score.js";
export type {
  MusicScoreBlock,
  MusicScoreEvent,
  MusicScoreMetrics,
  MusicScoreKeyboardMode,
  MusicScoreStaffScale,
} from "./music-score.js";

export {
  ankiClozeParts,
  ankiClozePlainText,
  ankiMathToMarkdown,
  normalizeAnkiClozeMath,
  parseAnkiCloze,
  parseAnkiMath,
  type AnkiClozeDeletion,
  type AnkiClozePart,
  type AnkiMathRange,
  type ParsedAnkiMath,
  type ParsedAnkiCloze,
} from "./anki-cloze.js";
export {
  accountPasswordSchema,
  changePasswordSchema,
  normalizePasswordRecoveryCode,
  passwordRecoveryCodeSchema,
  resetPasswordSchema,
} from "@flashcards/domain/auth";
export type {
  ChangePasswordInput,
  ResetPasswordInput,
} from "@flashcards/domain/auth";
export {
  accountShareQrPayloadSchema,
  accountShareSessionSchema,
  accountShareSessionStateSchema,
  cancelAccountShareSessionSchema,
  completeAccountShareSessionSchema,
  confirmAccountShareSessionSchema,
  createAccountShareSessionSchema,
  createAccountShareSignalSchema,
  joinAccountShareSessionSchema,
} from "@flashcards/domain/account-share";
export type {
  AccountShareQrPayload,
  AccountShareSession,
  AccountShareSessionState,
  CreateAccountShareSession,
  CreateAccountShareSignal,
  JoinAccountShareSession,
} from "@flashcards/domain/account-share";
export {
  createRendezvousSessionSchema,
  createRendezvousSignalSchema,
  directSyncInvitationSchema,
  encryptedRendezvousMessageSchema,
  phaseOneDeckSchema,
  phaseOneReviewSchema,
  phaseOneSnapshotSchema,
  rendezvousCapabilityHashSchema,
  rendezvousCapabilitySchema,
  rendezvousCompatibilitySchema,
  rendezvousEncryptedPayloadSchema,
  rendezvousProtocolVersionSchema,
  rendezvousRoleSchema,
  rendezvousSessionSchema,
  rendezvousSessionStateSchema,
  rendezvousSignalsQuerySchema,
  rendezvousSignalSchema,
} from "@flashcards/domain/rendezvous";
export type {
  CreateRendezvousSession,
  CreateRendezvousSignal,
  DirectSyncInvitation,
  EncryptedRendezvousMessage,
  PhaseOneDeck,
  PhaseOneReview,
  PhaseOneSnapshot,
  RendezvousCompatibility,
  RendezvousProtocolVersion,
  RendezvousRole,
  RendezvousSession,
  RendezvousSessionState,
  RendezvousSignal,
} from "@flashcards/domain/rendezvous";
export {
  planDeckHierarchyTransferMerge,
  planDeckTransferMerge,
} from "@flashcards/domain/deck-transfer-merge";
export type {
  DeckTransferMergeDecision,
  TransferDeckIdentity,
} from "@flashcards/domain/deck-transfer-merge";

export {
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
  archivedDeckIds,
  archiveMarkerDeckId,
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  progressUnitDeckTag,
  restorableDeckIds,
  visibleDeckIds,
} from "@flashcards/domain/deck-metrics";
export type {
  AggregatedDeckMetrics,
  DeckArchiveRow,
  DeckMetricRow,
  ProgressUnitDeckMetricRow,
  ProgressUnitMetrics,
  DeckVisibilityRow,
} from "@flashcards/domain/deck-metrics";
export {
  developerReferenceTag,
  hasDeveloperReferenceTag,
  hasOptionalPracticeTag,
  optionalPracticeTag,
} from "@flashcards/domain/deck-study-mode";
export { orderSequentialStudyScope } from "@flashcards/domain/study-order";
export type { StudySequencePosition } from "@flashcards/domain/study-order";
export {
  buildStudyBadgePlan,
  buildStudyBadgePlanFromDueBuckets,
  maximumStudyBadgeTransitions,
} from "@flashcards/domain/study-badge";
export type {
  StudyBadgeCardState,
  StudyBadgeDueBucket,
  StudyBadgePlan,
  StudyBadgeTransition,
} from "@flashcards/domain/study-badge";
export {
  defaultStudyStrategy,
  projectStudyPace,
  requiredNewCardsPerStudyDay,
  resetStudyStrategy,
  studyNewReviewOrderSchema,
  studyPaceStatusSchema,
  studyStrategyConfigSchema,
  studyStrategyPresets,
  studyStrategyPresetSchema,
} from "./study-strategy.js";
export type {
  StudyNewReviewOrder,
  StudyPaceProjection,
  StudyPaceStatus,
  StudyStrategyConfig,
  StudyStrategyPreset,
} from "./study-strategy.js";

export const roleSchema = z.enum(["USER", "AUTHOR", "REVIEWER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "SUSPENDED",
  "ARCHIVED",
]);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

export const ratingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type ReviewRating = z.infer<typeof ratingSchema>;

export const deckStudyOrderSchema = z.enum(["SCHEDULED", "SEQUENTIAL"]);
export type DeckStudyOrder = z.infer<typeof deckStudyOrderSchema>;

export const deckLanguageDirectionModeSchema = z.enum(["OVERRIDE", "INHERIT"]);
export type DeckLanguageDirectionMode = z.infer<
  typeof deckLanguageDirectionModeSchema
>;

export const cardLanguageDirectionModeSchema = z.enum([
  "DECK_DEFAULT",
  "DECK_REVERSED",
  "CUSTOM",
]);
export type CardLanguageDirectionMode = z.infer<
  typeof cardLanguageDirectionModeSchema
>;

export function resolveDeckLanguageDirection(input: {
  sourceLocale?: string | null;
  targetLocale?: string | null;
  fallbackLocale: string;
}): { sourceLocale: string; targetLocale: string } {
  const sourceLocale = input.sourceLocale?.trim() || input.fallbackLocale;
  return {
    sourceLocale,
    targetLocale: input.targetLocale?.trim() || sourceLocale,
  };
}

export function resolveCardLanguageDirection(input: {
  questionLocale?: string | null;
  answerLocale?: string | null;
  sourceLocale: string;
  targetLocale: string;
  mode?: CardLanguageDirectionMode;
  baseSourceLocale?: string | null;
  baseTargetLocale?: string | null;
}): { questionLocale: string; answerLocale: string } {
  const mode =
    input.mode ??
    (() => {
      const question = input.questionLocale?.trim();
      const answer = input.answerLocale?.trim();
      const baseSource = input.baseSourceLocale?.trim() || input.sourceLocale;
      const baseTarget = input.baseTargetLocale?.trim() || input.targetLocale;
      if (!question && !answer) return "DECK_DEFAULT" as const;
      if (question === baseSource && answer === baseTarget) {
        return "DECK_DEFAULT" as const;
      }
      if (
        baseSource !== baseTarget &&
        question === baseTarget &&
        answer === baseSource
      ) {
        return "DECK_REVERSED" as const;
      }
      return "CUSTOM" as const;
    })();
  if (mode === "DECK_DEFAULT") {
    return {
      questionLocale: input.sourceLocale,
      answerLocale: input.targetLocale,
    };
  }
  if (mode === "DECK_REVERSED") {
    return {
      questionLocale: input.targetLocale,
      answerLocale: input.sourceLocale,
    };
  }
  return {
    questionLocale: input.questionLocale?.trim() || input.sourceLocale,
    answerLocale: input.answerLocale?.trim() || input.targetLocale,
  };
}

export const cardKindSchema = z.enum(["QUESTION", "EXPLANATION"]);
export type CardKind = z.infer<typeof cardKindSchema>;

export const cardStateSchema = z.object({
  due: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().min(0).max(10),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  learningState: z.enum(["NEW", "LEARNING", "REVIEW", "RELEARNING"]),
  learningSteps: z.number().int().nonnegative().optional(),
  lastReview: z.string().datetime().nullable(),
});
export type CardState = z.infer<typeof cardStateSchema>;

export const reviewEventSchema = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  userId: z.uuid(),
  cardId: z.uuid(),
  reviewedAt: z.string().datetime(),
  timezone: z.string().min(1),
  rating: ratingSchema,
  schedulerVersion: z.string().min(1),
  parameters: z.array(z.number()),
  before: cardStateSchema,
  after: cardStateSchema,
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export const deckSummarySchema = z.object({
  id: z.uuid(),
  parentDeckId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  language: z.string().trim().min(2).max(16),
  contentLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
  defaultContentLocale: z.string().trim().min(2).max(16),
  sourceLocale: z.string().trim().min(2).max(16),
  targetLocale: z.string().trim().min(2).max(16),
  languageDirectionMode: deckLanguageDirectionModeSchema.default("OVERRIDE"),
  studyOrder: deckStudyOrderSchema.default("SCHEDULED"),
  protectionMode: z.enum(["STANDARD", "ACCOUNT_BOUND"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  favorite: z.boolean(),
  learningEnabled: z.boolean().optional(),
  hiddenAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  visual: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }),
      z.object({
        kind: z.literal("MAP"),
        value: z.enum(geographyMapIds),
      }),
      z.object({
        kind: z.literal("FLAG"),
        value: z.string().regex(/^[A-Z]{2}$/),
      }),
      z.object({
        kind: z.literal("IMAGE"),
        value: z.uuid(),
      }),
    ])
    .nullable(),
  sourceTemplateKey: z.string().nullable(),
  cardCount: z.number().int().nonnegative(),
  reviewedCardCount: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});
export type DeckSummary = z.infer<typeof deckSummarySchema>;

export type TransferableCard = {
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

export const transferableCardSchema: z.ZodType<TransferableCard> = z.object({
  id: z.uuid(),
  deckId: z.uuid(),
  noteId: z.uuid(),
  front: cardContentSchema,
  back: cardContentSchema,
  questionLocale: z.string().trim().min(2).max(16).nullable().optional(),
  answerLocale: z.string().trim().min(2).max(16).nullable().optional(),
  translations: localizedCardContentsSchema,
  kind: cardKindSchema.optional(),
  position: z.number().int().nonnegative().optional(),
  linkedToPrevious: z.boolean().optional(),
  version: z.number().int().positive(),
  suspended: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TransferableDeck = Omit<
  DeckSummary,
  "cardCount" | "reviewedCardCount" | "storageBytes"
> & { cards: TransferableCard[] };

export const transferableDeckSchema: z.ZodType<TransferableDeck> =
  deckSummarySchema
    .omit({ cardCount: true, reviewedCardCount: true, storageBytes: true })
    .extend({ cards: z.array(transferableCardSchema).max(250_000) });

export const parseTransferableDeck = (input: unknown): TransferableDeck =>
  transferableDeckSchema.parse(input);

export {
  europeContentLocales,
  europeCountries,
  getEuropeCountry,
  getEuropeCountryName,
} from "@flashcards/domain/europe-countries";
export type {
  EuropeContentLocale,
  EuropeCountryCode,
} from "@flashcards/domain/europe-countries";
export {
  europeMapShapes,
  europeMapViewBox,
} from "@flashcards/domain/europe-map";
export {
  geographyContentLocales,
  geographyMapIds,
  geographyMapLevels,
  geographyMaps,
  geographyRegions,
  geographyStatisticsSources,
  geographySubdivisionCountries,
  geographyWorldCountryShapes,
  getGeographyMapPoint,
  getGeographyRegion,
  getGeographyRegionName,
} from "@flashcards/domain/geography";
export type {
  GeographyCapitalMarker,
  GeographyContentLocale,
  GeographyMapId,
  GeographyMapLevel,
  GeographyRegion,
} from "@flashcards/domain/geography";
export {
  flagEmoji,
  geographyOverlays,
  natoMemberCountryCodes,
} from "@flashcards/domain/geography-overlays";
export type { GeographyOverlayDefinition } from "@flashcards/domain/geography-overlays";

export {
  confirmPairingSessionSchema,
  completeExistingTrustedDeviceGroups,
  completeTrustedDeviceGroupPairings,
  createAutomaticConnectionSessionSchema,
  createPairingSessionSchema,
  createPairingSignalSchema,
  deviceCapabilitySchema,
  devicePlatformSchema,
  deviceSchema,
  joinPairingSessionSchema,
  maximumTrustedDeviceGroupSize,
  orderedDevicePair,
  pairingQrPayloadSchema,
  pairingSessionSchema,
  pairingSessionModeSchema,
  pairingSessionStateSchema,
  pairingSignalSchema,
  pairingSignalTypeSchema,
  peerEntityTypeSchema,
  peerMutationSchema,
  peerTransferManifestSchema,
  registerDeviceSchema,
  replicaWatermarksSchema,
  transferKindSchema,
  transferMediaSchema,
  transferStateSchema,
  trustedDeviceGroupMembers,
  updateDeviceSchema,
} from "@flashcards/domain/device-sync";

export {
  audioDerivativeCandidateId,
  audioDerivativeQualityScore,
  audioDerivativeReferenceFileName,
  audioJobBelongsToDevice,
  audioOptimizationJobSchema,
  audioOptimizationJobStatusSchema,
  audioQualityMeasurementSchema,
  isAudioDerivativeReferenceFileName,
  localAudioDerivativePayloadSchema,
  parseAudioDerivativeReference,
  selectPreferredAudioDerivative,
  speechAudioPipeline,
} from "./audio-optimization.js";
export type {
  AudioOptimizationJob,
  AudioQualityMeasurement,
  LocalAudioDerivativePayload,
} from "./audio-optimization.js";
export type {
  ConfirmPairingSession,
  CreateAutomaticConnectionSession,
  CreatePairingSession,
  CreatePairingSignal,
  Device,
  DeviceCapability,
  DevicePairingEdge,
  DevicePlatform,
  JoinPairingSession,
  PairingQrPayload,
  PairingSession,
  PairingSessionMode,
  PairingSessionState,
  PairingSignal,
  PeerMutation,
  PeerTransferManifest,
  RegisterDevice,
  ReplicaWatermarks,
  TransferMedia,
  TransferState,
  UpdateDevice,
} from "@flashcards/domain/device-sync";

export {
  localAuthorityExportEnvelopeSchema,
  localAuthorityExportPayloadSchema,
  localAuthorityMetadataSchema,
  localAuthoritySchemaVersion,
  localMaterializedEntitySchema,
  localMutationInputSchema,
} from "./local-authority.js";
export type {
  LocalAuthorityExportEnvelope,
  LocalAuthorityExportPayload,
  LocalAuthorityMetadata,
  LocalMaterializedEntity,
  LocalMutationInput,
} from "./local-authority.js";

export {
  cloudAccountStatusSchema,
  cloudBackupDescriptorSchema,
  encryptedCloudBackupChunkSchema,
  encryptedCloudBackupEnvelopeSchema,
  encryptedCloudBackupManifestSchema,
  familyLibraryDescriptorSchema,
} from "./cloud-backup.js";
export type {
  CloudAccountStatus,
  CloudBackupDescriptor,
  EncryptedCloudBackupEnvelope,
  EncryptedCloudBackupManifest,
  FamilyLibraryDescriptor,
} from "./cloud-backup.js";

export {
  signedWebstackReleaseSchema,
  webstackAssetSchema,
  webstackManifestSchema,
  webstackPeerMessageSchema,
} from "./signed-webstack.js";
export type {
  SignedWebstackRelease,
  WebstackManifest,
  WebstackPeerMessage,
} from "./signed-webstack.js";

export const syncMutationSchema = z.object({
  mutationId: z.uuid(),
  entityId: z.uuid(),
  entityType: z.enum(["DECK", "NOTE", "CARD", "REVIEW", "SUBSCRIPTION"]),
  operation: z.enum(["UPSERT", "DELETE"]),
  baseVersion: z.number().int().nonnegative().nullable(),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const createId = (): string => uuidv7();

export const assertAdmin = (roles: readonly Role[]): void => {
  if (!roles.includes("ADMIN")) {
    throw new Error("Admin role required");
  }
};
