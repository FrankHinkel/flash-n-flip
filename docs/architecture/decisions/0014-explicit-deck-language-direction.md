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
- Anki and text imports require the user to select the default language pair.
  A card may override that pair with `questionLocale` and `answerLocale`.
- The only automatic Anki exception is the Xefjord Complete series. An exact
  collection-title signature enables a dedicated preset; the server derives
  English plus the named learning language from a reviewed locale table and
  applies the safe default field, hierarchy, and media selection. Unknown
  Xefjord language names fall back to the configurable standard Anki import.
  In the normal Anki flow, recognized packages require an explicit choice
  between this preset and standard configuration.
- For the confirmed Xefjord language pair, an exact standalone final line
  matching one of those languages determines the direction per card. `To
<language>` means the answer uses that language; `<language>` means the
  question does. The confirmed marker line is removed. Ambiguous cards and
  other packages retain the selected deck default unchanged.
- `contentLocales` continues to describe complete localized deck variants and
  is not expanded merely because two languages appear on opposite card sides.
- Language-matrix decks keep their dynamic study direction; their selected
  question and answer locales override the stored default pair while studying.
- Protected Flash-n-Flip exports include the deck pair and optional card
  overrides. Older version-1 packages remain readable and fall back to the
  deck pair or default content locale.

## Consequences

Text-to-speech can select a matching voice independently for the question and
answer. Users can correct imported or legacy metadata in the deck editor
without rewriting cards. Import is one explicit step longer, but does not
silently persist an unreliable language guess.
