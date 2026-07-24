---
name: flashcards-community-publishing-review
description: Review FlashCards community publishing, subscriptions, revisions, reports, and moderation. Use whenever code can submit, approve, publish, update, suspend, restore, rank, recommend, or report public decks or cards.
---

# FlashCards Community Publishing Review

1. Read `references/publication-state-machine.md`.
2. Trace every route capable of changing public visibility.
3. Run `scripts/check-publishing-guardrails.sh`.
4. Verify authorization, immutable revisions, audit entries, reason codes, and appeal paths.
5. Mark every publication bypass as `Release-Blocker`.

## Mandatory guardrails

- Publish only an admin-approved immutable revision.
- Create a new submitted revision for every public content change.
- Keep subscriptions and learner progress independent from the source deck.
- Record actor, time, reason, previous state, and next state for moderation actions.
- Support card-level and deck-level reports.
- Allow immediate suspension without erasing audit evidence.
- Require human review for AI-assisted content and significant restrictions.
