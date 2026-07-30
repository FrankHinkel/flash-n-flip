# ADR 0017: Versioned reference collections

## Status

Accepted

## Context

Flash-n-Flip needs curated collections that are primarily references rather
than rated learning decks. The first collection is the KaTeX Developer
Reference: one collection node, fifteen thematic decks, and explanation cards
with rendered formulas and copyable source.

Downloading an updated built-in collection must not duplicate decks or cards,
and content updates must not replace personal scheduling state.

## Decision

- Curated reference collections are exposed by authenticated template metadata
  and install endpoints, then presented in Discover.
- Every collection and child deck has a stable `sourceTemplateKey`.
- Every generated note and card has a deterministic UUID derived from its deck
  ID and stable authored card key.
- Reinstalling a reference collection upserts content into the existing IDs,
  restores hidden or archived template decks, and leaves review state in the
  separate progress tables untouched.
- Reference cards use the `QUESTION` kind with a compact reference title on
  the front and a structured Markdown explanation on the back. This keeps them
  editable and resettable through the normal card workflow.
- Discover opens the collection in explicit `practice=all` mode, so browsing
  the reference does not create ratings or alter existing FSRS intervals.
- `EXPLANATION` cards are not counted as reviewed merely because of their
  content kind; reviewed metrics require a persisted question review.
- KaTeX continues to render through the existing restricted formula renderer;
  reference content does not introduce executable templates or trusted HTML.

## Consequences

Reference collections can grow through additive, stable keys without creating
duplicates. Renaming or correcting their authored content does not change card
identity. Removing an obsolete authored card requires a separate retirement
policy so existing user state is never silently deleted.
