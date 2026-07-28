# ADR 0008: Recursive collection study scope

Status: accepted

Selecting a deck for study selects that deck and every visible descendant deck
recursively. This makes a collection an actionable learning scope instead of an
empty technical container. Cards stored directly in the selected collection
are included alongside cards from its subdecks.

The API resolves the hierarchy server-side for due cards and confidence data.
Archived and hidden branches are excluded. Card IDs are de-duplicated before
the queue is created, and the scheduler, review events, ratings, and persisted
progress remain unchanged.

Web and mobile clients display the source subdeck while a collection is being
studied. Practice-all uses the same recursive scope without changing learning
progress. An empty scope is reported as an empty deck or collection; a
non-empty scope with no due cards is reported as reviewed for today.

The Web offline cache stores the card IDs associated with the selected
collection so recursively loaded subdeck cards remain available under the same
selection while offline.
