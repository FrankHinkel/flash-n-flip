CREATE TABLE "virtual_study_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"question_deck_id" uuid NOT NULL,
	"answer_deck_id" uuid NOT NULL,
	"match_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virtual_study_targets" ADD CONSTRAINT "virtual_study_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "virtual_study_targets" ADD CONSTRAINT "virtual_study_targets_question_deck_id_decks_id_fk" FOREIGN KEY ("question_deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "virtual_study_targets" ADD CONSTRAINT "virtual_study_targets_answer_deck_id_decks_id_fk" FOREIGN KEY ("answer_deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_study_target_identity_unique" ON "virtual_study_targets" USING btree ("user_id","kind","question_deck_id","answer_deck_id","match_key");
--> statement-breakpoint
CREATE INDEX "virtual_study_target_question_deck_idx" ON "virtual_study_targets" USING btree ("user_id","question_deck_id");
--> statement-breakpoint
CREATE INDEX "virtual_study_target_answer_deck_idx" ON "virtual_study_targets" USING btree ("user_id","answer_deck_id");
