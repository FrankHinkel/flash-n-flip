WITH "owners_with_multiple_xefjord_decks" AS (
  SELECT "owner_id"
  FROM "decks"
  WHERE
    "parent_deck_id" IS NULL
    AND "archived_at" IS NULL
    AND "title" ~* '^Xefjord[''’]s Complete[[:space:]]+'
    AND "tags" @> '["Anki Import"]'::jsonb
  GROUP BY "owner_id"
  HAVING count(*) >= 2
)
INSERT INTO "decks" (
  "id",
  "owner_id",
  "title",
  "description",
  "language",
  "content_locales",
  "default_content_locale",
  "source_locale",
  "target_locale",
  "protection_mode",
  "tags",
  "source_template_key"
)
SELECT
  gen_random_uuid(),
  "candidate"."owner_id",
  'Xefjord''s Complete',
  'Gemeinsame Collection der importierten Xefjord-Sprachdecks.',
  'en',
  '["en"]'::jsonb,
  'en',
  'en',
  'en',
  'ACCOUNT_BOUND',
  '["Anki Import", "Collection", "Xefjord"]'::jsonb,
  'xefjord-complete-collection'
FROM "owners_with_multiple_xefjord_decks" "candidate"
WHERE NOT EXISTS (
  SELECT 1
  FROM "decks" "existing"
  WHERE
    "existing"."owner_id" = "candidate"."owner_id"
    AND "existing"."source_template_key" = 'xefjord-complete-collection'
);
--> statement-breakpoint
UPDATE "decks" "language_deck"
SET
  "parent_deck_id" = "collection"."id",
  "version" = "language_deck"."version" + 1,
  "updated_at" = now()
FROM "decks" "collection"
WHERE
  "collection"."owner_id" = "language_deck"."owner_id"
  AND "collection"."source_template_key" = 'xefjord-complete-collection'
  AND "language_deck"."parent_deck_id" IS NULL
  AND "language_deck"."archived_at" IS NULL
  AND "language_deck"."title" ~* '^Xefjord[''’]s Complete[[:space:]]+'
  AND "language_deck"."tags" @> '["Anki Import"]'::jsonb;
