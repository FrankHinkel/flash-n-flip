WITH RECURSIVE "xefjord_decks" AS (
  SELECT
    "deck"."id",
    CASE
      WHEN lower("deck"."source_locale") = 'en'
        THEN "deck"."target_locale"
      WHEN lower("deck"."target_locale") = 'en'
        THEN "deck"."source_locale"
      ELSE "deck"."target_locale"
    END AS "target_locale"
  FROM "decks" "deck"
  WHERE
    "deck"."title" ~* '^Xefjord[''’]s Complete[[:space:]]+'
    AND "deck"."tags" @> '["Anki Import"]'::jsonb
    AND coalesce("deck"."source_template_key", '') <> 'xefjord-complete-collection'

  UNION ALL

  SELECT "child"."id", "parent"."target_locale"
  FROM "decks" "child"
  INNER JOIN "xefjord_decks" "parent"
    ON "child"."parent_deck_id" = "parent"."id"
),
"mapped_cards" AS (
  SELECT
    "card"."id",
    "card"."question_locale",
    "card"."answer_locale",
    "deck"."target_locale",
    coalesce("phrase"."content", "sentence"."content") AS "target_content",
    coalesce(
      "phrase_translation"."content",
      "sentence_translation"."content"
    ) AS "english_content",
    "audio"."content" AS "audio_content",
    "image"."content" AS "image_content"
  FROM "cards" "card"
  INNER JOIN "xefjord_decks" "deck"
    ON "card"."deck_id" = "deck"."id"
  INNER JOIN "notes" "note"
    ON "card"."note_id" = "note"."id"
  INNER JOIN "note_types" "note_type"
    ON "note"."note_type_id" = "note_type"."id"
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'phrase'
    LIMIT 1
  ) "phrase" ON true
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'sentence'
    LIMIT 1
  ) "sentence" ON true
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'phrase translation'
    LIMIT 1
  ) "phrase_translation" ON true
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'sentence translation'
    LIMIT 1
  ) "sentence_translation" ON true
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'audio'
    LIMIT 1
  ) "audio" ON true
  LEFT JOIN LATERAL (
    SELECT "note"."fields"->("field"."value"->>'key') AS "content"
    FROM jsonb_array_elements("note_type"."fields") "field"
    WHERE lower(btrim("field"."value"->>'label')) = 'image'
    LIMIT 1
  ) "image" ON true
  WHERE
    "card"."kind" = 'QUESTION'
    AND coalesce("phrase"."content", "sentence"."content") IS NOT NULL
    AND coalesce(
      "phrase_translation"."content",
      "sentence_translation"."content"
    ) IS NOT NULL
    AND (
      (
        "card"."question_locale" = "deck"."target_locale"
        AND lower("card"."answer_locale") = 'en'
      )
      OR (
        lower("card"."question_locale") = 'en'
        AND "card"."answer_locale" = "deck"."target_locale"
      )
    )
),
"rebuilt_cards" AS (
  SELECT
    "id",
    CASE
      WHEN "question_locale" = "target_locale" THEN
        jsonb_build_object(
          'blocks',
          coalesce("target_content"->'blocks', '[]'::jsonb)
          || coalesce("image_content"->'blocks', '[]'::jsonb)
          || coalesce("audio_content"->'blocks', '[]'::jsonb)
        )
      ELSE "english_content"
    END AS "front",
    CASE
      WHEN "answer_locale" = "target_locale" THEN
        jsonb_build_object(
          'blocks',
          coalesce("target_content"->'blocks', '[]'::jsonb)
          || coalesce("image_content"->'blocks', '[]'::jsonb)
          || coalesce("audio_content"->'blocks', '[]'::jsonb)
        )
      ELSE "english_content"
    END AS "back"
  FROM "mapped_cards"
)
UPDATE "cards" "card"
SET
  "front" = "rebuilt"."front",
  "back" = "rebuilt"."back",
  "version" = "card"."version" + 1,
  "updated_at" = now()
FROM "rebuilt_cards" "rebuilt"
WHERE "card"."id" = "rebuilt"."id";
--> statement-breakpoint
WITH RECURSIVE "xefjord_decks" AS (
  SELECT "deck"."id"
  FROM "decks" "deck"
  WHERE
    "deck"."title" ~* '^Xefjord[''’]s Complete[[:space:]]+'
    AND "deck"."tags" @> '["Anki Import"]'::jsonb
    AND coalesce("deck"."source_template_key", '') <> 'xefjord-complete-collection'

  UNION ALL

  SELECT "child"."id"
  FROM "decks" "child"
  INNER JOIN "xefjord_decks" "parent"
    ON "child"."parent_deck_id" = "parent"."id"
),
"used_templates" AS (
  SELECT DISTINCT "card"."template_id" AS "id"
  FROM "cards" "card"
  INNER JOIN "xefjord_decks" "deck"
    ON "card"."deck_id" = "deck"."id"
  WHERE "card"."template_id" IS NOT NULL
),
"template_roles" AS (
  SELECT
    "template"."id",
    jsonb_object_agg(
      "field"."value"->>'label',
      CASE
        WHEN "field"."value"->>'label' = "chosen"."english_label"
          THEN 'PRIMARY_A'
        WHEN "field"."value"->>'label' = "chosen"."target_label"
          THEN 'PRIMARY_B'
        WHEN lower(btrim("field"."value"->>'label')) IN ('audio', 'image')
          THEN 'MEDIA_B'
        WHEN coalesce(
          "template"."front"->'fieldRoles'->>("field"."value"->>'label'),
          'IGNORE'
        ) IN ('PRIMARY_A', 'PRIMARY_B', 'MEDIA_A', 'MEDIA_B')
          THEN 'IGNORE'
        ELSE coalesce(
          "template"."front"->'fieldRoles'->>("field"."value"->>'label'),
          'IGNORE'
        )
      END
    ) AS "roles"
  FROM "card_templates" "template"
  INNER JOIN "used_templates" "used"
    ON "template"."id" = "used"."id"
  INNER JOIN "note_types" "note_type"
    ON "template"."note_type_id" = "note_type"."id"
  CROSS JOIN LATERAL (
    SELECT
      coalesce(
        max("candidate"."value"->>'label') FILTER (
          WHERE lower(btrim("candidate"."value"->>'label')) = 'phrase'
        ),
        max("candidate"."value"->>'label') FILTER (
          WHERE lower(btrim("candidate"."value"->>'label')) = 'sentence'
        )
      ) AS "target_label",
      coalesce(
        max("candidate"."value"->>'label') FILTER (
          WHERE lower(btrim("candidate"."value"->>'label')) = 'phrase translation'
        ),
        max("candidate"."value"->>'label') FILTER (
          WHERE lower(btrim("candidate"."value"->>'label')) = 'sentence translation'
        )
      ) AS "english_label"
    FROM jsonb_array_elements("note_type"."fields") "candidate"
  ) "chosen"
  CROSS JOIN jsonb_array_elements("note_type"."fields") "field"
  WHERE
    "chosen"."target_label" IS NOT NULL
    AND "chosen"."english_label" IS NOT NULL
  GROUP BY "template"."id"
)
UPDATE "card_templates" "template"
SET
  "front" = jsonb_set("template"."front", '{fieldRoles}', "roles"."roles"),
  "back" = jsonb_set("template"."back", '{fieldRoles}', "roles"."roles")
FROM "template_roles" "roles"
WHERE "template"."id" = "roles"."id";
