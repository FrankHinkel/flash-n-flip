# ADR 0028: Local deck-editor drafts with atomic commits

## Status

Accepted

## Context

The Web deck editor previously wrote card order, card updates, card creation,
and card deletion immediately. The top-level Save action therefore did not
form a trustworthy persistence boundary: leaving the editor could preserve
changes that the learner had never explicitly saved.

Creating a second persisted deck for editing would introduce new deck, note,
and card identities. That would complicate media ownership, learning progress,
version conflicts, synchronization, and cleanup.

## Decision

Existing-deck editing uses an in-memory draft based on the loaded deck version
and card page.

- Card edits, additions, deletions, and reordering update only the draft.
- Navigation warns before discarding a dirty draft.
- The top-level Save action submits deck fields and all staged card operations
  with one stable client-generated mutation identifier.
- The API authorizes the deck owner, validates the canonical deck and card
  schemas, checks deck and card base versions, and applies the complete commit
  in one PostgreSQL transaction.
- The mutation identifier makes a successfully committed retry idempotent.
- A validation or version failure rolls back every deck, note, card, and order
  change.
- Media objects and review progress are not copied or rewritten by the editor
  draft.

Card pagination remains an editor concern. A dirty card page cannot be replaced
by search or pagination before it is saved or discarded.

## Consequences

Save is the sole canonical persistence boundary for an existing deck editor
session. Drafts intentionally disappear when the editor is left without
saving. A later decision may add a separate IndexedDB recovery draft, but such
a recovery object must never become a second synchronization authority.
