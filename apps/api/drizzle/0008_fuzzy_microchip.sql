ALTER TABLE "decks" ADD COLUMN "source_locale" text;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "target_locale" text;--> statement-breakpoint
UPDATE "decks"
SET
  "source_locale" = "default_content_locale",
  "target_locale" = "default_content_locale";--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "source_locale" SET DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "source_locale" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "target_locale" SET DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "target_locale" SET NOT NULL;
