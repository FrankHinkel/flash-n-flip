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
- Unlinked cards with the same `noteId` are siblings. At most one new sibling
  is introduced per local learning day. Already due siblings remain eligible
  and are separated by five other cards where the available tier allows it;
  shorter queues use the largest possible distance.
- `linkedToPrevious` and explicitly sequential material override sibling
  separation because their authored adjacency is semantic.
- Reversibility remains an authoring/import decision. Queue generation never
  synthesizes a reverse card, and every existing direction keeps its own FSRS
  state and immutable review history.
- Sequential child decks retain their internal authored order. A directly
  selected sequential deck runs without interruption before descendant decks.
- The deterministic queue policy lives in the shared scheduler package and is
  consumed by both local-first clients and the API path.
- Web and mobile offline caches preserve the returned queue order.

## Consequences

Refreshing the same scope in the same authenticated session and UTC day
produces the same queue, including offline fallback. A new authentication
session or learning day produces a new order. Scheduling state and immutable
review history remain unchanged. A note may therefore contribute multiple due
cards on one day, but it cannot introduce several unlinked directions as new
cards on that same day.
