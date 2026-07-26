CREATE TABLE "study_reset_cards" (
	"reset_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	CONSTRAINT "study_reset_cards_reset_id_card_id_pk" PRIMARY KEY("reset_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "study_resets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mutation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"include_descendants" boolean DEFAULT false NOT NULL,
	"reset_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "parent_deck_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "source_template_key" text;--> statement-breakpoint
ALTER TABLE "study_reset_cards" ADD CONSTRAINT "study_reset_cards_reset_id_study_resets_id_fk" FOREIGN KEY ("reset_id") REFERENCES "public"."study_resets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_reset_cards" ADD CONSTRAINT "study_reset_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_resets" ADD CONSTRAINT "study_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_resets" ADD CONSTRAINT "study_resets_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_reset_card_idx" ON "study_reset_cards" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_reset_mutation_unique" ON "study_resets" USING btree ("user_id","mutation_id");--> statement-breakpoint
CREATE INDEX "study_reset_user_time_idx" ON "study_resets" USING btree ("user_id","reset_at");--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_parent_deck_id_decks_id_fk" FOREIGN KEY ("parent_deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decks_parent_idx" ON "decks" USING btree ("owner_id","parent_deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decks_owner_template_unique" ON "decks" USING btree ("owner_id","source_template_key");