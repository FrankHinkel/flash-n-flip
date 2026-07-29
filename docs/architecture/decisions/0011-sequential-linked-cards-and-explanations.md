# ADR 0011: Sequential decks, linked cards, and explanations

## Status

Accepted

## Context

Some learning material must retain its authored order. Individual questions may
also depend on the preceding card. Explanatory steps contain no question and
must not create an FSRS rating or review event.

## Decision

- Decks store `studyOrder` as `SCHEDULED` or `SEQUENTIAL`.
- Cards store a stable one-based `position`, a `kind` (`QUESTION` or
  `EXPLANATION`), and `linkedToPrevious`.
- A scheduled deck remains due-date driven. Linked due questions form one
  adjacent queue group.
- A sequential deck orders its due questions by authored position.
- An explanation is added to the normal queue only when the following due card
  is linked to it. Practice-all uses the same relationship rule.
- Continuing from an explanation advances locally without creating a review
  event or card progress.
- A question may omit its back only when its front contains a validated cloze.
  An explanation must have an empty front and non-empty back.

## Consequences

Explanations cannot distort FSRS intervals or remain permanently due. Existing
cards and revisions are migrated to `QUESTION`, keep their creation order, and
remain unlinked. The protected deck format preserves the new metadata while
retaining format-version 1 defaults for older packages.
