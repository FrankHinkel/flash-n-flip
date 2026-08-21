# ADR 0043: Neutral Language Hub and conservative dictionary bases

- Status: Accepted
- Date: 2026-08-21

## Context

ADR 0021 introduced on-demand cross-language study views for separately
imported Xefjord packages. The first implementation also used the collection
root as an inheritable language source. A legacy root such as English to German
could therefore be displayed while a French or Spanish child was active.

Multiple imports for the same target language create a second risk: combining
their entries would make a pivot look unique even though it is ambiguous across
independent dictionary editions. Rebuilding all possible language pairs on
every visit is also unnecessary because each dictionary's phrase index depends
only on that dictionary hierarchy.

## Decision

The persisted collection identity `xefjord-complete-collection` remains stable
for existing installations and synchronized peers, but its product model and
visible title are **Language Hub**. The root is a neutral container with an
English-to-English storage fallback and an explicit `Language Neutral` tag. It
must not supply a direction to a direct dictionary child.

Every direct dictionary child stores an explicit direction and uses
`languageDirectionMode: OVERRIDE`. Generic `Dictionary`,
`dictionary-locale:<locale>` and `dictionary-pivot:<locale>` tags carry its
role. Legacy title recognition remains an import and migration adapter only.

An idempotent local-authority migration repairs existing Language Hub roots and
children. It first validates a legacy child's card locales when generic tags
are absent. A direction is inferred only when exactly two locales exist and one
is the English pivot. Otherwise the child is marked neutral and no direction is
claimed. The migration mutates deck metadata only; cards, scheduler state,
review events, outboxes and watermarks are unchanged.

For each collection and target locale, at most one dictionary hierarchy is a
pivot basis. Existing bases win by original creation time and stable ID.
Additional imports remain normal, directly studyable decks but receive
`Dictionary Pivot Disabled`; their entries are never merged into the basis.
The runtime also groups candidates by collection and locale and rejects a pair
whose two sides resolve to the same locale.

Phrase indexes remain persisted per dictionary hierarchy in IndexedDB and are
fingerprinted from that hierarchy's deck versions, card counts, storage sizes
and update timestamps. Import eagerly refreshes the affected collection;
subsequent visits reuse unchanged indexes. Pair views remain on-demand and do
not materialize cards.

The Study header resolves its language from the current physical card deck or
the virtual card's question deck. It displays a direction only when both sides
are known and distinct. A neutral dataset displays an em dash with the
accessible label “No unambiguous language direction” instead of a misleading
language pair.

The existing Xefjord route parameters, virtual-card kind and deterministic ID
seed remain unchanged. They are wire and learning-progress compatibility
identifiers, not the product model.

## Consequences

- Switching between German, French and Spanish children updates the Study
  direction from the active child without root leakage.
- A duplicate language import does not expand or alter an existing pivot basis.
- Existing virtual review identities and append-only review history remain
  valid.
- A neutral or ambiguous dictionary stays usable for direct study but cannot
  participate in cross-language generation until its metadata is explicit.
- Supporting a non-English pivot in the existing English-aid UI requires a
  separate wire-compatible presentation decision.

## Verification

Focused tests cover neutral roots, fixed child directions, persistent legacy
repair, conservative duplicate selection, same-locale pair rejection, cached
phrase indexes, stable virtual review progress and the neutral Study label.
The real Web flow must additionally be checked after import and restart; native
iOS WebView acceptance remains required before claiming full platform parity.
