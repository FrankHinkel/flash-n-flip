WITH RECURSIVE "xefjord_decks" AS (
  SELECT "id"
  FROM "decks"
  WHERE "title" ~* '^Xefjord[''’]s Complete'

  UNION ALL

  SELECT "deck"."id"
  FROM "decks" "deck"
  INNER JOIN "xefjord_decks" "parent"
    ON "deck"."parent_deck_id" = "parent"."id"
),
"candidates" AS (
  SELECT
    "card"."id",
    "card"."back",
    "card"."front"#>>'{blocks,0,text}' AS "question_text",
    "card"."back"#>>'{blocks,0,text}' AS "answer_text"
  FROM "cards" "card"
  INNER JOIN "xefjord_decks" "deck"
    ON "card"."deck_id" = "deck"."id"
  WHERE
    "card"."question_locale" IS NOT NULL
    AND "card"."answer_locale" IS NOT NULL
    AND "card"."question_locale" <> "card"."answer_locale"
    AND "card"."front"#>>'{blocks,0,type}' IN ('text', 'heading')
    AND "card"."back"#>>'{blocks,0,type}' IN ('text', 'heading')
    AND jsonb_array_length("card"."front"->'blocks') = 1
),
"suffixes" AS (
  SELECT
    "id",
    "back",
    substring(
      "answer_text"
      FROM char_length("question_text") + 1
    ) AS "suffix"
  FROM "candidates"
  WHERE
    "question_text" <> ''
    AND left("answer_text", char_length("question_text")) = "question_text"
),
"cleaned" AS (
  SELECT
    "id",
    "back",
    CASE
      WHEN left("suffix", 1) = chr(1)
        THEN regexp_replace(
          substring("suffix" FROM 2),
          E'^[ \\t\\r\\n]*',
          ''
        )
      WHEN "suffix" ~ E'^\\r?\\n[ \\t]*\\r?\\n'
        THEN regexp_replace(
          "suffix",
          E'^\\r?\\n[ \\t]*\\r?\\n[ \\t\\r\\n]*',
          ''
        )
    END AS "target_text"
  FROM "suffixes"
)
UPDATE "cards" "card"
SET "back" = jsonb_set(
  "cleaned"."back",
  '{blocks,0,text}',
  to_jsonb("cleaned"."target_text")
)
FROM "cleaned"
WHERE
  "card"."id" = "cleaned"."id"
  AND coalesce(length(btrim("cleaned"."target_text")), 0) > 0;
