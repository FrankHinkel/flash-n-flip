ALTER TABLE "cards" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "content_locales" jsonb DEFAULT '["en"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "default_content_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "protection_mode" text DEFAULT 'ACCOUNT_BOUND' NOT NULL;