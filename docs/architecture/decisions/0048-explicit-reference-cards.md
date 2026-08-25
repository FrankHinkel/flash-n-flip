# ADR 0048: Explicit reference cards

- Status: Accepted
- Date: 2026-08-25

## Context

Flash-n-Flip already used the deck tag `Developer reference` to browse curated
help cards without ratings. Editing one of those cards could, however, turn an
empty-front question into an explanation. The scheduler then omitted the
standalone explanation from the reference sequence. Users also had no explicit
way to create their own reference cards.

## Decision

Cards persist a separate `usage` value: `LEARNING` or `REFERENCE`. `kind`
continues to describe presentation and linking (`QUESTION` or `EXPLANATION`). A
reference card may contain content on either side, is shown directly with
previous/next navigation, and never emits a review event or changes FSRS state.

The existing `Developer reference` tag remains the compatible deck-level marker
for a reference collection. The editor exposes it as a named option instead of
requiring users to know the tag. Cards in such a deck are treated as references
even when older data has no card-level `usage`, repairing existing FnF Help
libraries without a destructive migration.

FNF v3 stores `usage` and declares `reference-card-v1`. Missing values default
to `LEARNING`. Local peer protocol version 18 carries the expanded local card
payload so the choice survives device synchronization.

## Consequences

- Existing cards and older FNF packages remain learning cards by default.
- Reference navigation is scheduler-neutral and does not create artificial
  progress.
- Curated help cards explicitly carry `REFERENCE`, while the deck tag remains a
  fallback for already-installed libraries.
- Devices on protocol version 17 must update before synchronizing with version
  18; silent field loss is not accepted.
