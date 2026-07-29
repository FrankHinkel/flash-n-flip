# ADR 0013: Shared multilingual concepts and study directions

## Status

Accepted

## Context

Basic language material should be reusable between English, German, French,
and Spanish without maintaining a separate copy for every language pair.
Learners also need to choose the question language independently from the
answer language. Updating a curated collection must neither duplicate cards nor
discard existing learning progress.

## Decision

- A Core 100 concept is stored once and contains matching localized front and
  back content for `en`, `de`, `fr`, and `es`.
- The curated collection contains one root collection and category decks for
  words, verbs, descriptions, and short everyday phrases.
- Cards and notes receive deterministic, installation-scoped UUIDs. Reinstalling
  the template updates the existing records in place, so card identifiers and
  their review history remain stable.
- A `language-matrix` deck tag enables an independent question-language
  selector in the study view.
- The answer language defaults to the UI language when available. The question
  language defaults to a balanced rotation through the other available
  languages, but can be fixed explicitly.
- Question and answer language may not be identical while an alternative
  locale exists.

## Consequences

The same 100 concepts support all twelve directed language pairs without
duplicating source content. Adding another language later requires another
localized value per concept rather than separate pairwise decks. Content
updates preserve scheduling state because the stable card identifier remains
the join point for progress and review logs.
