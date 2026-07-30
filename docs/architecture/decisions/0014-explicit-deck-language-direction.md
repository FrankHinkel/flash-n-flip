# ADR 0014: Explicit deck language direction

## Status

Accepted

## Context

Text-to-speech must not guess the language of a question or answer. Anki
packages and text exports do not provide a dependable, standardized source and
target language. Deck-localized variants also describe a different concern
than the two languages used on the front and back of a translation card.

## Decision

- Every deck stores `sourceLocale` for questions and `targetLocale` for
  answers.
- A missing target is normalized to the source. Existing decks are migrated
  from `defaultContentLocale`, so one-language decks keep identical source and
  target values.
- Anki and text imports require the user to select the direction instead of
  inferring it from deck names, field names, templates, or card text.
- `contentLocales` continues to describe complete localized deck variants and
  is not expanded merely because two languages appear on opposite card sides.
- Language-matrix decks keep their dynamic study direction; their selected
  question and answer locales override the stored default pair while studying.
- Protected Flash-n-Flip exports include the pair. Older version-1 packages
  remain readable and fall back to the default content locale for both sides.

## Consequences

Text-to-speech can select a matching voice independently for the question and
answer. Users can correct imported or legacy metadata in the deck editor
without rewriting cards. Import is one explicit step longer, but does not
silently persist an unreliable language guess.
