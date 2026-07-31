ALTER TABLE "cards" ADD COLUMN "question_locale" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "answer_locale" text;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD COLUMN "question_locale" text;--> statement-breakpoint
ALTER TABLE "revision_cards" ADD COLUMN "answer_locale" text;--> statement-breakpoint

CREATE TEMP TABLE "fnf_xefjord_directions" ON COMMIT DROP AS
WITH RECURSIVE "xefjord_decks" AS (
  SELECT "id"
  FROM "decks"
  WHERE "title" ~* '^Xefjord[''’]s Complete'
  UNION ALL
  SELECT "child"."id"
  FROM "decks" "child"
  INNER JOIN "xefjord_decks" "parent"
    ON "child"."parent_deck_id" = "parent"."id"
),
"front_lines" AS (
  SELECT
    "card"."id",
    lower(btrim("line"."value")) AS "line"
  FROM "cards" "card"
  INNER JOIN "xefjord_decks" "deck" ON "deck"."id" = "card"."deck_id"
  CROSS JOIN LATERAL jsonb_array_elements("card"."front"->'blocks') "block"("value")
  CROSS JOIN LATERAL regexp_split_to_table(
    coalesce("block"."value"->>'text', ''),
    E'\\r?\\n'
  ) "line"("value")
),
"detected" AS (
  SELECT
    "id",
    CASE
      WHEN bool_or("line" = 'to french') THEN 'To French'
      WHEN bool_or("line" = 'french') THEN 'French'
      WHEN bool_or("line" = 'to spanish (castilian)') THEN 'To Spanish (Castilian)'
      WHEN bool_or("line" = 'spanish (castilian)') THEN 'Spanish (Castilian)'
    END AS "marker"
  FROM "front_lines"
  GROUP BY "id"
)
SELECT
  "id",
  "marker",
  CASE
    WHEN "marker" = 'To French' THEN 'en'
    WHEN "marker" = 'French' THEN 'fr'
    WHEN "marker" = 'To Spanish (Castilian)' THEN 'en'
    WHEN "marker" = 'Spanish (Castilian)' THEN 'es'
  END AS "question_locale",
  CASE
    WHEN "marker" = 'To French' THEN 'fr'
    WHEN "marker" = 'French' THEN 'en'
    WHEN "marker" = 'To Spanish (Castilian)' THEN 'es'
    WHEN "marker" = 'Spanish (Castilian)' THEN 'en'
  END AS "answer_locale"
FROM "detected"
WHERE "marker" IS NOT NULL;--> statement-breakpoint

CREATE FUNCTION "fnf_remove_xefjord_marker"("content" jsonb, "marker" text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_set(
    "content",
    '{blocks}',
    coalesce(
      (
        SELECT jsonb_agg(
          CASE
            WHEN "block"."value"->>'type' IN ('text', 'heading')
              THEN jsonb_set(
                "block"."value",
                '{text}',
                to_jsonb(
                  rtrim(
                    regexp_replace(
                      "block"."value"->>'text',
                      E'(^|\\r?\\n)[ \\t]*'
                        || replace(
                          replace("marker", '(', chr(92) || '('),
                          ')',
                          chr(92) || ')'
                        )
                        || E'[ \\t]*(\\r?\\n|$)',
                      chr(92) || '1',
                      'i'
                    )
                  )
                )
              )
            ELSE "block"."value"
          END
          ORDER BY "block"."ordinality"
        )
        FROM jsonb_array_elements("content"->'blocks')
          WITH ORDINALITY AS "block"("value", "ordinality")
      ),
      '[]'::jsonb
    )
  );
$$;--> statement-breakpoint

UPDATE "cards" "card"
SET
  "question_locale" = "detected"."question_locale",
  "answer_locale" = "detected"."answer_locale",
  "front" = "fnf_remove_xefjord_marker"("card"."front", "detected"."marker"),
  "back" = CASE
    WHEN "detected"."marker" LIKE 'To %'
      THEN "fnf_remove_xefjord_marker"("card"."back", "detected"."marker")
    ELSE "card"."back"
  END
FROM "fnf_xefjord_directions" "detected"
WHERE "card"."id" = "detected"."id";--> statement-breakpoint

DROP FUNCTION "fnf_remove_xefjord_marker"(jsonb, text);
