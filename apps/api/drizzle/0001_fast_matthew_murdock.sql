CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"source_card_id" uuid NOT NULL,
	"front" jsonb NOT NULL,
	"back" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_progress" DROP CONSTRAINT "card_progress_card_id_cards_id_fk";
--> statement-breakpoint
ALTER TABLE "review_events" DROP CONSTRAINT "review_events_card_id_cards_id_fk";
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD CONSTRAINT "revision_cards_revision_id_deck_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."deck_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD CONSTRAINT "revision_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_unique" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revision_cards_revision_idx" ON "revision_cards" USING btree ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_source_card_unique" ON "revision_cards" USING btree ("revision_id","source_card_id");