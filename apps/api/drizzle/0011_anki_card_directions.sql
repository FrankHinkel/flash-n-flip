WITH "mapped_directions" AS (
  SELECT
    "card"."id",
    CASE
      WHEN "template_direction"."front_role" = 'PRIMARY_B'
        THEN "deck"."target_locale"
      ELSE "deck"."source_locale"
    END AS "question_locale",
    CASE
      WHEN "template_direction"."front_role" = 'PRIMARY_B'
        THEN "deck"."source_locale"
      ELSE "deck"."target_locale"
    END AS "answer_locale"
  FROM "cards" "card"
  INNER JOIN "decks" "deck"
    ON "card"."deck_id" = "deck"."id"
  INNER JOIN "card_templates" "template"
    ON "card"."template_id" = "template"."id"
  CROSS JOIN LATERAL (
    SELECT
      "template"."front"->'fieldRoles'->>"question_field"."name" AS "front_role"
    FROM jsonb_array_elements_text(
      coalesce("template"."front"->'questionFields', '[]'::jsonb)
    ) WITH ORDINALITY AS "question_field"("name", "position")
    WHERE
      "template"."front"->'fieldRoles'->>"question_field"."name"
        IN ('PRIMARY_A', 'PRIMARY_B')
    ORDER BY "question_field"."position"
    LIMIT 1
  ) "template_direction"
  WHERE
    "template"."front"->>'format' = 'ANKI_SAFE_MAPPING_V1'
    AND "card"."question_locale" IS NULL
    AND "card"."answer_locale" IS NULL
    AND "deck"."source_locale" IS NOT NULL
    AND "deck"."target_locale" IS NOT NULL
)
UPDATE "cards" "card"
SET
  "question_locale" = "direction"."question_locale",
  "answer_locale" = "direction"."answer_locale",
  "version" = "card"."version" + 1,
  "updated_at" = now()
FROM "mapped_directions" "direction"
WHERE "card"."id" = "direction"."id";
