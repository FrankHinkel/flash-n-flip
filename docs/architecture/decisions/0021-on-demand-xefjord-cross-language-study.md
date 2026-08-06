# ADR 0021: On-demand Xefjord cross-language study views

- Status: Accepted
- Date: 6 August 2026

## Context

Privately imported Xefjord language packages share an English `Phrase
Translation` field. Users can therefore learn between two non-English
languages without duplicating either package. The reference APKG files used to
verify the import shapes are not application assets and must never be bundled,
published, committed, or deployed.

Materializing every language pair would copy cards and media, create thousands
of mostly unused combinations, and couple learning progress to generated deck
records. Matching ambiguous English pivots would also risk showing or speaking
the wrong language.

## Decision

1. Cross-language views are available only for Xefjord packages already
   imported into the authenticated user's private collection. Flash-n-Flip
   does not distribute the source packages.
2. The API detects only note types containing `Phrase` and `Phrase
Translation`. A note type containing `Sentence` or `Sentence Translation`
   is excluded in this first version, as are unrelated Kanji and Hanzi note
   types.
3. `Phrase Translation` is normalized with Unicode NFKC, collapsed whitespace,
   trimming and English case folding. A pivot participates only when it occurs
   exactly once inside each selected language hierarchy. The client receives a
   SHA-256 match key. The normalized pivot remains server-internal; only when
   the learner explicitly enables an English Q or A aid does the API return
   the corresponding original translation as sanitized plain text for that
   due-card response.
4. Pair availability and the three views A to B, B to A and A both ways B are
   computed on demand. No pair or generated deck is persisted.
5. A virtual card uses the source package's `Phrase` and audio as its question
   and the target package's `Phrase`, image and audio as its answer. Dedicated
   `Audio` fields take precedence over inline phrase audio to avoid duplicate
   players. Existing card content and media identifiers are referenced directly
   and are not copied.
6. The pair selector offers independent English aids for question and answer.
   These display preferences change only the due-card presentation and cache
   scope, never the deterministic virtual-card identity or learning progress.
7. Every direction has a deterministic UUID derived from question deck,
   answer deck and match key. The existing scheduler, append-only review log,
   durable Web outbox and synchronization protocol use that UUID unchanged.
8. On the first review only, the API registers the virtual card identity and
   its two source deck identifiers. This minimal record contains no copied
   content, media or English pivot. Deleting either source hierarchy removes
   the registered target and its progress.
9. The Web caches the discovered private languages, selected pair metadata,
   synthesized due cards and queued virtual-card review reference in IndexedDB.
   This keeps an already loaded view usable offline and after restart.

## Consequences

- Counts are exact for the currently selected pair and uniqueness rules.
- Learning state is independent for A to B and B to A; the bidirectional view
  is their union rather than a third copy of progress.
- Editing or deleting an unreviewed source note can remove its virtual card on
  the next online calculation. An already queued review remains idempotently
  deliverable through its registered stable identity.
- The source APKG files remain outside Git and the VPS deployment artifact.
- Supporting sentence or character-specific cross-language views requires a
  later schema-specific decision.
