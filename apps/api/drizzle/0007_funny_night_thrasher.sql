ALTER TABLE "cards" ADD COLUMN "kind" text DEFAULT 'QUESTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "position" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "linked_to_previous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "study_order" text DEFAULT 'SCHEDULED' NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD COLUMN "kind" text DEFAULT 'QUESTION' NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD COLUMN "position" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD COLUMN "linked_to_previous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
WITH ranked_cards AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "deck_id" ORDER BY "created_at", "id"
  )::integer AS "position"
  FROM "cards"
)
UPDATE "cards"
SET "position" = ranked_cards."position"
FROM ranked_cards
WHERE "cards"."id" = ranked_cards."id";--> statement-breakpoint
WITH ranked_revision_cards AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "revision_id", "deck_id" ORDER BY "created_at", "id"
  )::integer AS "position"
  FROM "revision_cards"
)
UPDATE "revision_cards"
SET "position" = ranked_revision_cards."position"
FROM ranked_revision_cards
WHERE "revision_cards"."id" = ranked_revision_cards."id";--> statement-breakpoint
CREATE INDEX "cards_deck_position_idx" ON "cards" USING btree ("deck_id","position");
