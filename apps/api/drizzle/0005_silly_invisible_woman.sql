ALTER TABLE "decks" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "visual" jsonb;--> statement-breakpoint
UPDATE "decks"
SET "visual" = '{"kind":"GLOBE","value":"world"}'::jsonb
WHERE "source_template_key" = 'geography:world:v1';--> statement-breakpoint
UPDATE "decks"
SET "visual" = jsonb_build_object(
	'kind', 'MAP',
	'value', replace(replace("source_template_key", 'geography:', ''), ':v1', '')
)
WHERE "source_template_key" LIKE 'geography:%:v1'
	AND "source_template_key" <> 'geography:world:v1';
