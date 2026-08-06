import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { GeographyMapId } from "@flashcards/domain";
import type { LocalizedCardContents } from "@flashcards/domain/content";

export const roleEnum = pgEnum("role", ["USER", "AUTHOR", "REVIEWER", "ADMIN"]);

export const publicationStatusEnum = pgEnum("publication_status", [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "SUSPENDED",
  "ARCHIVED",
]);

export const learningStateEnum = pgEnum("learning_state", [
  "NEW",
  "LEARNING",
  "REVIEW",
  "RELEARNING",
]);

export const ratingEnum = pgEnum("review_rating", [
  "AGAIN",
  "HARD",
  "GOOD",
  "EASY",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    locale: text("locale").notNull().default("en"),
    emailVerified: boolean("email_verified").notNull().default(false),
    passwordChangeRequired: boolean("password_change_required")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    platform: text("platform").notNull(),
    publicKey: text("public_key").notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("user_devices_user_idx").on(table.userId),
    uniqueIndex("user_devices_user_public_key_unique").on(
      table.userId,
      table.publicKey,
    ),
  ],
);

export const devicePairings = pgTable(
  "device_pairings",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceAId: uuid("device_a_id")
      .notNull()
      .references(() => userDevices.id, { onDelete: "cascade" }),
    deviceBId: uuid("device_b_id")
      .notNull()
      .references(() => userDevices.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("device_pairings_identity_unique").on(
      table.userId,
      table.deviceAId,
      table.deviceBId,
    ),
    index("device_pairings_device_a_idx").on(table.userId, table.deviceAId),
    index("device_pairings_device_b_idx").on(table.userId, table.deviceBId),
  ],
);

export const pairingSessions = pgTable(
  "pairing_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    initiatorDeviceId: uuid("initiator_device_id")
      .notNull()
      .references(() => userDevices.id, { onDelete: "cascade" }),
    joiningDeviceId: uuid("joining_device_id").references(
      () => userDevices.id,
      { onDelete: "cascade" },
    ),
    state: text("state").notNull().default("CREATED"),
    initiatorEphemeralPublicKey: text(
      "initiator_ephemeral_public_key",
    ).notNull(),
    initiatorFingerprintProof: text("initiator_fingerprint_proof").notNull(),
    joiningEphemeralPublicKey: text("joining_ephemeral_public_key"),
    joiningFingerprintProof: text("joining_fingerprint_proof"),
    initiatorConfirmationProof: text("initiator_confirmation_proof"),
    joiningConfirmationProof: text("joining_confirmation_proof"),
    initiatorConfirmed: boolean("initiator_confirmed").notNull().default(false),
    joiningConfirmed: boolean("joining_confirmed").notNull().default(false),
    attemptCount: integer("attempt_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    index("pairing_sessions_user_idx").on(table.userId),
    index("pairing_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const pairingSignals = pgTable(
  "pairing_signals",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => pairingSessions.id, { onDelete: "cascade" }),
    senderDeviceId: uuid("sender_device_id")
      .notNull()
      .references(() => userDevices.id, { onDelete: "cascade" }),
    recipientDeviceId: uuid("recipient_device_id")
      .notNull()
      .references(() => userDevices.id, { onDelete: "cascade" }),
    sequence: integer("sequence").generatedAlwaysAsIdentity(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pairing_signals_session_sequence_idx").on(
      table.sessionId,
      table.sequence,
    ),
    index("pairing_signals_recipient_idx").on(
      table.recipientDeviceId,
      table.sequence,
    ),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_tokens_hash_unique").on(table.tokenHash),
    index("auth_tokens_user_idx").on(table.userId),
  ],
);

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document: text("document").notNull(),
    version: text("version").notNull(),
    locale: text("locale").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_acceptance_unique").on(
      table.userId,
      table.document,
      table.version,
    ),
  ],
);

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentDeckId: uuid("parent_deck_id").references(
      (): AnyPgColumn => decks.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    language: text("language").notNull().default("en"),
    contentLocales: jsonb("content_locales")
      .$type<string[]>()
      .notNull()
      .default(["en"]),
    defaultContentLocale: text("default_content_locale")
      .notNull()
      .default("en"),
    sourceLocale: text("source_locale").notNull().default("en"),
    targetLocale: text("target_locale").notNull().default("en"),
    studyOrder: text("study_order").notNull().default("SCHEDULED"),
    protectionMode: text("protection_mode").notNull().default("ACCOUNT_BOUND"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    favorite: boolean("favorite").notNull().default(false),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    visual: jsonb("visual").$type<
      | { kind: "GLOBE"; value: "world" }
      | {
          kind: "MAP";
          value: GeographyMapId;
        }
      | { kind: "FLAG"; value: string }
      | { kind: "IMAGE"; value: string }
      | null
    >(),
    sourceTemplateKey: text("source_template_key"),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("decks_owner_idx").on(table.ownerId),
    index("decks_parent_idx").on(table.ownerId, table.parentDeckId),
    index("decks_updated_idx").on(table.updatedAt),
    uniqueIndex("decks_owner_template_unique").on(
      table.ownerId,
      table.sourceTemplateKey,
    ),
  ],
);

export const noteTypes = pgTable("note_types", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fields: jsonb("fields")
    .$type<Array<{ key: string; label: string }>>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    noteTypeId: uuid("note_type_id").references(() => noteTypes.id, {
      onDelete: "set null",
    }),
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notes_deck_idx").on(table.deckId)],
);

export const cardTemplates = pgTable("card_templates", {
  id: uuid("id").primaryKey(),
  noteTypeId: uuid("note_type_id").references(() => noteTypes.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  front: jsonb("front").$type<Record<string, unknown>>().notNull(),
  back: jsonb("back").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => cardTemplates.id, {
      onDelete: "set null",
    }),
    front: jsonb("front").$type<Record<string, unknown>>().notNull(),
    back: jsonb("back").$type<Record<string, unknown>>().notNull(),
    translations: jsonb("translations")
      .$type<LocalizedCardContents>()
      .notNull()
      .default({}),
    questionLocale: text("question_locale"),
    answerLocale: text("answer_locale"),
    kind: text("kind").notNull().default("QUESTION"),
    position: integer("position").notNull().default(1),
    linkedToPrevious: boolean("linked_to_previous").notNull().default(false),
    suspended: boolean("suspended").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cards_deck_idx").on(table.deckId),
    index("cards_deck_position_idx").on(table.deckId, table.position),
    index("cards_note_idx").on(table.noteId),
  ],
);

export const cardProgress = pgTable(
  "card_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: text("stability").notNull().default("0"),
    difficulty: text("difficulty").notNull().default("0"),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: learningStateEnum("state").notNull().default("NEW"),
    lastReview: timestamp("last_review", { withTimezone: true }),
    schedulerVersion: text("scheduler_version").notNull(),
    parameters: jsonb("parameters").$type<number[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cardId] })],
);

export const reviewEvents = pgTable(
  "review_events",
  {
    id: uuid("id").primaryKey(),
    mutationId: uuid("mutation_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").notNull(),
    rating: ratingEnum("rating").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    schedulerVersion: text("scheduler_version").notNull(),
    parameters: jsonb("parameters").$type<number[]>().notNull(),
    before: jsonb("before").$type<Record<string, unknown>>().notNull(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("review_mutation_unique").on(table.userId, table.mutationId),
    index("review_card_time_idx").on(
      table.userId,
      table.cardId,
      table.reviewedAt,
    ),
  ],
);

export const virtualStudyTargets = pgTable(
  "virtual_study_targets",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    questionDeckId: uuid("question_deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    answerDeckId: uuid("answer_deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    matchKey: text("match_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("virtual_study_target_identity_unique").on(
      table.userId,
      table.kind,
      table.questionDeckId,
      table.answerDeckId,
      table.matchKey,
    ),
    index("virtual_study_target_question_deck_idx").on(
      table.userId,
      table.questionDeckId,
    ),
    index("virtual_study_target_answer_deck_idx").on(
      table.userId,
      table.answerDeckId,
    ),
  ],
);

export const studyResets = pgTable(
  "study_resets",
  {
    id: uuid("id").primaryKey(),
    mutationId: uuid("mutation_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    includeDescendants: boolean("include_descendants").notNull().default(false),
    resetAt: timestamp("reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("study_reset_mutation_unique").on(
      table.userId,
      table.mutationId,
    ),
    index("study_reset_user_time_idx").on(table.userId, table.resetAt),
  ],
);

export const studyResetCards = pgTable(
  "study_reset_cards",
  {
    resetId: uuid("reset_id")
      .notNull()
      .references(() => studyResets.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resetId, table.cardId] }),
    index("study_reset_card_idx").on(table.cardId),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    altText: text("alt_text"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("media_owner_hash_unique").on(table.ownerId, table.sha256),
  ],
);

export const deckRevisions = pgTable(
  "deck_revisions",
  {
    id: uuid("id").primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    language: text("language").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    sourceDeclarations: jsonb("source_declarations")
      .$type<Array<{ label: string; url?: string; license: string }>>()
      .notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("deck_revision_number_unique").on(table.deckId, table.number),
  ],
);

export const revisionCards = pgTable(
  "revision_cards",
  {
    id: uuid("id").primaryKey(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => deckRevisions.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    sourceCardId: uuid("source_card_id").notNull(),
    front: jsonb("front").$type<Record<string, unknown>>().notNull(),
    back: jsonb("back").$type<Record<string, unknown>>().notNull(),
    questionLocale: text("question_locale"),
    answerLocale: text("answer_locale"),
    kind: text("kind").notNull().default("QUESTION"),
    position: integer("position").notNull().default(1),
    linkedToPrevious: boolean("linked_to_previous").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("revision_cards_revision_idx").on(table.revisionId),
    uniqueIndex("revision_source_card_unique").on(
      table.revisionId,
      table.sourceCardId,
    ),
  ],
);

export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").references(() => deckRevisions.id, {
      onDelete: "restrict",
    }),
    status: publicationStatusEnum("status").notNull().default("DRAFT"),
    category: text("category"),
    slug: text("slug").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("publication_deck_unique").on(table.deckId),
    uniqueIndex("publication_slug_unique").on(table.slug),
    index("publication_status_idx").on(table.status),
  ],
);

export const moderationDecisions = pgTable(
  "moderation_decisions",
  {
    id: uuid("id").primaryKey(),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").references(() => deckRevisions.id, {
      onDelete: "restrict",
    }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    previousStatus: publicationStatusEnum("previous_status").notNull(),
    nextStatus: publicationStatusEnum("next_status").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("moderation_publication_idx").on(table.publicationId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => deckRevisions.id, { onDelete: "restrict" }),
    autoUpdate: boolean("auto_update").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.publicationId] })],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").references(() => cards.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    details: text("details").notNull(),
    status: text("status").notNull().default("OPEN"),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("reports_status_idx").on(table.status)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);

export const syncMutations = pgTable(
  "sync_mutations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mutationId: uuid("mutation_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    cursor: integer("cursor").generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mutationId] }),
    uniqueIndex("sync_user_cursor_unique").on(table.userId, table.cursor),
  ],
);
