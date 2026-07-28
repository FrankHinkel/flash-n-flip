# ADR 0006: Deck metrics, visibility and global map overlays

## Status

Accepted, 27 July 2026.

## Decision

The API owns the canonical deck-overview metrics and returns them with every
deck summary:

- `reviewedCardCount` counts cards whose current derived progress has at least
  one review.
- `storageBytes` estimates the PostgreSQL size of the deck, its cards and notes,
  and adds the exact byte size of media referenced by that deck.
- Every hierarchy node reports the sum of its own metrics and all included
  descendants. Normal library responses exclude hidden branches from these
  totals; management responses requested with `includeHidden` aggregate the
  complete non-archived hierarchy.

The shared domain package owns recursive deck visibility. A hidden deck and all
of its descendants are excluded from normal selectors and lists. Management
views may explicitly request hidden decks so that users can restore them.

Geography overlays store canonical country-code memberships. Continent maps
intersect a global membership with their countries. The World map renders
generated country shapes over its continent-based learning regions so a global
overlay can highlight countries without changing the World deck's cards.

Web and Mobile consume the same summary fields, visibility helper and overlay
definitions. Their geography catalogs expose country subdivision decks through
explicit, expandable continent submenus.

## Rationale

Computing metrics in each client would produce inconsistent values and require
clients to download card and media details. Recursive visibility must also be
consistent so descendants of a hidden collection cannot leak into study or
selection lists.

A canonical global overlay avoids duplicating NATO membership in every
continent definition. Intersecting it at render time keeps continent ownership
based on the geography data while still supporting cross-continent lists on the
World map.

## Consequences

- Storage size is an overview estimate, not the compressed size of an exported
  `.fnfdeck` file.
- Resetting a deck removes its derived card progress, so its displayed reviewed
  count returns to zero without changing scheduler rules.
- Media referenced by several decks contributes to each deck's individual
  estimate and therefore to every containing collection's summed estimate.
- Adding a new global overlay requires one canonical country-code list and no
  duplicated continent membership lists.
