# ADR 0012: Deterministic interleaved study queues

## Status

Accepted

## Context

Scheduled decks should avoid predictable authored order, while collection study
should prevent one large child deck from dominating a session. Queue mixing
must not change FSRS eligibility, intervals, review events, linked-card
adjacency, or explicitly sequential material.

## Decision

- FSRS and the current clock determine which questions are eligible.
- Due reviews remain ahead of new cards. Practice-all places future reviews
  after due reviews and new cards.
- Scheduled deck groups are shuffled with a deterministic seed derived from the
  authenticated user session, UTC learning day, selected scope, and practice
  mode.
- Collection tiers use a randomized round-robin across visible child decks.
- Linked cards and explanations remain atomic queue groups.
- Sequential child decks retain their internal authored order. A directly
  selected sequential deck runs without interruption before descendant decks.
- Web and mobile offline caches preserve the returned queue order.

## Consequences

Refreshing the same scope in the same authenticated session and UTC day
produces the same queue, including offline fallback. A new authentication
session or learning day produces a new order. Scheduling state and immutable
review history remain unchanged.
