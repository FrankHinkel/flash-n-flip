# ADR 0014: Wiki table row spans and side headings

## Status

Accepted

## Context

Flash-n-Flip cards use a restricted DokuWiki-inspired table syntax. Horizontal
section headings already use repeated delimiters such as `^^`, but grammar
tables also need compact side headings spanning several rows. The syntax must
remain declarative, round-trip through the shared domain model, and render with
useful table semantics for assistive technology.

## Decision

- A cell whose complete trimmed content is `:::` continues the cell directly
  above it in the same logical column.
- The continuation cell and its origin must have the same column span.
- Consecutive continuations increase the origin cell's `rowspan`, up to 500
  rows. Invalid or orphaned continuations produce a localized card error.
- Continuation placeholders are removed from the structured document. The
  origin cell stores the bounded `rowspan`; serializers recreate `:::` rows.
- Header cells spanning rows render with `scope="rowgroup"`.
- All rendered Markdown table cells use vertical middle alignment.

## Consequences

Mixed side headings and regular data cells can be represented without raw HTML
or executable templates. Parser, validation, renderer, API persistence, and
future platform renderers share one bounded `rowspan` model. Literal `:::` text
inside a table cell must be escaped or combined with other text so it is not
interpreted as a continuation operator.
