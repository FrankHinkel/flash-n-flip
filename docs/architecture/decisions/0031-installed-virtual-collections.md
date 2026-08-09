# ADR 0031: Installed virtual collections with category progress

- Status: Accepted
- Date: 9 August 2026

## Context

Some curated learning domains have a tiny rule set but an enormous or
unbounded exercise space. Materializing every number up to one million would
waste storage, make installation and synchronization expensive, and expose a
misleading card-count progress metric. A standalone generator, however, does
not behave like an installed Flash-n-Flip collection and cannot use the normal
Decks, scheduling, reset, transfer, and offline flows.

## Decision

1. A virtual collection installs ordinary, deterministic collection and deck
   records. It is listed under Decks and participates in recursive study,
   archive, reset, transfer, and synchronization like other private content.
2. The reusable virtual-collection synchronizer owns stable template, note,
   and card identities. A provider supplies the hierarchy, tags, competency
   slots, locales, and placeholder content.
3. Provider tags identify cards whose visible exercise is synthesized when a
   due queue is built. The stored card identity remains unchanged.
4. A synthesized exercise is deterministic for the directed language pair and
   its persisted aggregate review count. Reloading, an offline cache, or a
   process restart therefore resumes the same round. Each queued review gets
   the next value without rewriting the competency card or its history.
5. The number provider installs one root collection, one child deck per
   directed language pair, and structural category decks below each pair.
   Adding DE to ES never reuses or resets DE to FR or either reverse direction.
6. Each category owns a small bounded set of competency cards. Concrete
   numbers are stimuli, not scheduling identities. Large number spaces use a
   deterministic category sampler instead of materialized cards.
7. A deck tagged `virtual-progress-unit` is one visible progress category.
   Generic deck metrics aggregate completed category decks and expose category
   totals separately from physical card counts. A category is complete only
   after every competency slot has persisted progress.
8. Review events remain append-only and FSRS remains card based. The category
   metric is a presentation aggregate and never rewrites scheduler state.
9. The number provider consumes a complete deterministic round before starting
   another. Up to 100, every round begins with `0` through `20` in order, then
   covers every full decade and at least one additional value per decade
   without duplicates. Larger spaces retain their structural anchor sampler.
10. Parenthetical card text is a visible, non-spoken annotation. Number cards
    use it for digits so text-to-speech reads the number word only.
11. Generation 2 uses the platform-neutral domain provider and deterministic
    local identities. Installation, deletion, and reinstallation are local
    authority mutations and never call a VPS collection endpoint.

## Consequences

- Installed number collections consume only a few deck and competency records
  regardless of the selected numeric upper bound.
- Different language directions retain independent FSRS histories while the
  collection can display their aggregate category completion.
- The same installation and progress-unit infrastructure can support future
  rule-generated domains such as dates, times, measures, currencies, and
  arithmetic. Each provider still owns its domain-specific classifier and
  sampler.
- Editing generated exercises as ordinary authored content is intentionally
  unsupported; configuration changes add or update provider-managed language
  directions without replacing progress identities.
