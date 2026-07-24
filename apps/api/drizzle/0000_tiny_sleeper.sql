CREATE TYPE "public"."learning_state" AS ENUM('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."review_rating" AS ENUM('AGAIN', 'HARD', 'GOOD', 'EASY');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('USER', 'AUTHOR', 'REVIEWER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_progress" (
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" text DEFAULT '0' NOT NULL,
	"difficulty" text DEFAULT '0' NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" "learning_state" DEFAULT 'NEW' NOT NULL,
	"last_review" timestamp with time zone,
	"scheduler_version" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_progress_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "card_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_type_id" uuid,
	"name" text NOT NULL,
	"front" jsonb NOT NULL,
	"back" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"template_id" uuid,
	"front" jsonb NOT NULL,
	"back" jsonb NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"card_id" uuid,
	"category" text NOT NULL,
	"details" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deck_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"tags" jsonb NOT NULL,
	"source_declarations" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'de' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"locale" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"alt_text" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_id" uuid NOT NULL,
	"revision_id" uuid,
	"actor_id" uuid NOT NULL,
	"previous_status" "publication_status" NOT NULL,
	"next_status" "publication_status" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"note_type_id" uuid,
	"fields" jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"revision_id" uuid,
	"status" "publication_status" DEFAULT 'DRAFT' NOT NULL,
	"category" text,
	"slug" text NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mutation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" "review_rating" NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"scheduler_version" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"auto_update" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_publication_id_pk" PRIMARY KEY("user_id","publication_id")
);
--> statement-breakpoint
CREATE TABLE "sync_mutations" (
	"user_id" uuid NOT NULL,
	"mutation_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"cursor" integer GENERATED ALWAYS AS IDENTITY (sequence name "sync_mutations_cursor_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_mutations_user_id_mutation_id_pk" PRIMARY KEY("user_id","mutation_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'de' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_note_type_id_note_types_id_fk" FOREIGN KEY ("note_type_id") REFERENCES "public"."note_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_template_id_card_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."card_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_revisions" ADD CONSTRAINT "deck_revisions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_revisions" ADD CONSTRAINT "deck_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_revision_id_deck_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."deck_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_types" ADD CONSTRAINT "note_types_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_note_type_id_note_types_id_fk" FOREIGN KEY ("note_type_id") REFERENCES "public"."note_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_revision_id_deck_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."deck_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_revision_id_deck_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."deck_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_mutations" ADD CONSTRAINT "sync_mutations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "cards_deck_idx" ON "cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "cards_note_idx" ON "cards" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "content_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_revision_number_unique" ON "deck_revisions" USING btree ("deck_id","number");--> statement-breakpoint
CREATE INDEX "decks_owner_idx" ON "decks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "decks_updated_idx" ON "decks" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptance_unique" ON "legal_acceptances" USING btree ("user_id","document","version");--> statement-breakpoint
CREATE UNIQUE INDEX "media_owner_hash_unique" ON "media" USING btree ("owner_id","sha256");--> statement-breakpoint
CREATE INDEX "moderation_publication_idx" ON "moderation_decisions" USING btree ("publication_id");--> statement-breakpoint
CREATE INDEX "notes_deck_idx" ON "notes" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_deck_unique" ON "publications" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_slug_unique" ON "publications" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "publication_status_idx" ON "publications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_mutation_unique" ON "review_events" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE INDEX "review_card_time_idx" ON "review_events" USING btree ("user_id","card_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_user_cursor_unique" ON "sync_mutations" USING btree ("user_id","cursor");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));